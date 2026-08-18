'use client';

import { mergeProps } from '@base-ui/react/merge-props';
import * as React from 'react';

import { LightboxContentCssVars } from './lightbox-css-vars';
import { LightboxContentDataAttributes } from './lightbox-data-attributes';
import { useLightboxContext } from './lightbox-context';
import { useLightboxPortalContext } from './lightbox-portal';
import { useLightboxZoomPublish } from './lightbox-zoom-context';
import {
  getPullRuntimeSync,
  loadPullRuntime,
  type PullRuntime,
} from './lightbox-pull-loader';
import { useContentKeyboard } from './use-content-keyboard';
import { useNativePinchGuard } from './use-native-pinch-guard';
import { useTouchScrollContainment } from './use-touch-scroll-containment';

/** Imperative chrome vars (pull / zoom) — React style reconciliation must not wipe them. */
const CONTENT_CHROME_STYLE_VARS = [
  LightboxContentCssVars.pullProgress,
  LightboxContentCssVars.pullSnapDuration,
  LightboxContentCssVars.pullSnapEasing,
  LightboxContentCssVars.zoomProgress,
] as const;

function readPreservedChromeStyle(el: HTMLElement | null): React.CSSProperties | null {
  if (!el) return null;
  let preserved: React.CSSProperties | null = null;
  for (const name of CONTENT_CHROME_STYLE_VARS) {
    const value = el.style.getPropertyValue(name);
    if (!value) continue;
    if (!preserved) preserved = {};
    (preserved as Record<string, string>)[name] = value;
  }
  return preserved;
}

const useLayoutEffect = typeof window !== 'undefined' ? React.useLayoutEffect : React.useEffect;

const TABBABLE_SELECTOR = [
  'a[href]',
  'area[href]',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'button:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

function getTabbableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(TABBABLE_SELECTOR)).filter(
    (el) => !el.hasAttribute('data-focus-guard'),
  );
}

/** Focus ejected to `<body>` when a slide goes inert — not a portaled overlay. */
function isStrandedFocus(node: Element | null | undefined): boolean {
  return !node || node === document.body || node === document.documentElement;
}

const focusGuardStyle: React.CSSProperties = {
  position: 'fixed',
  overflow: 'hidden',
  width: 1,
  height: 1,
  top: 0,
  left: 0,
  padding: 0,
  border: 0,
  clip: 'rect(0, 0, 0, 0)',
  whiteSpace: 'nowrap',
};

interface LightboxContentProps extends React.ComponentPropsWithRef<'div'> {
  className?: string;
  /** Dialog contents (close, slides/items, chrome). */
  children?: React.ReactNode;
  /**
   * Enable pull-to-close on touch and trackpad wheel. Starts from anywhere in
   * Stage (or Content when Stage is omitted), except interactive controls.
   * Publishes `data-pulling`, `data-pull-snapping`, `data-pull-dismissing`, and
   * `--lightbox-pull-progress` while active. The engine loads when Content
   * first mounts with this on — pass `false` to skip that download.
   * @default true
   */
  pullToClose?: boolean;
}

const LightboxContent = React.forwardRef<HTMLDivElement, LightboxContentProps>(
  function LightboxContent(props, forwardedRef) {
    const { className, children, pullToClose = true, style, ...rest } = props;

    const {
      open,
      mounted,
      preparing,
      setOpen,
      activeIndex,
      navigate,
      itemCount,
      loop,
      dialogElementRef,
      stageElementRef,
      backdropElementRef,
      activeItemElementRef,
      navigationLockedRef,
      baseId,
    } = useLightboxContext();
    const { keepMounted } = useLightboxPortalContext();
    // Present while open/animating, or parked closed when Portal.keepMounted.
    const present = mounted || keepMounted;
    const parked = keepMounted && !mounted;
    // The active slide's zoom is exposed via the Root-owned bridge (not the
    // per-slide ZoomContext, which is a descendant and unreadable here).
    const { activeZoomRef } = useLightboxZoomPublish();

    const contentRef = React.useRef<HTMLDivElement | null>(null);

    // Latest `open` for use inside async callbacks (focus containment microtask)
    // so we never fight a legitimate focus move that happens while closing.
    const openRef = React.useRef(open);
    openRef.current = open;

    const mergedRef = React.useCallback(
      (node: HTMLDivElement | null) => {
        contentRef.current = node;
        dialogElementRef.current = node;
        if (typeof forwardedRef === 'function') {
          forwardedRef(node);
        } else if (forwardedRef) {
          forwardedRef.current = node;
        }
      },
      [forwardedRef, dialogElementRef],
    );

    // Focus the content element once revealed so keyboard events work
    // immediately. Held off during the VT pre-mount phase (`preparing`) so we
    // don't move focus (and possibly scroll) while the viewer is still hidden;
    // it fires when `preparing` flips false at reveal.
    //
    // `preventScroll: true` matters for perf: the content is `position: fixed`
    // covering the viewport, so it's already fully visible — but a default
    // `focus()` still runs the browser's "scroll focused element into view"
    // pass, which forces a synchronous whole-page layout right inside the reveal
    // commit (measured at ~6ms @6× / ~14ms @20× CPU). Skipping it removes that
    // forced reflow with no behavioral change. See LIGHTBOX_PERF.md.
    useLayoutEffect(() => {
      if (mounted && !preparing) {
        contentRef.current?.focus({ preventScroll: true });
      }
    }, [mounted, preparing]);

    // Dev-only: a modal dialog must have an accessible name (WAI-ARIA APG
    // Dialog pattern requires `aria-label` or `aria-labelledby`). The library
    // stays unopinionated about the wording, but a nameless dialog is a real
    // WCAG failure for screen reader users, so nudge consumers in development.
    React.useEffect(() => {
      if (process.env.NODE_ENV === 'production') return;
      if (!mounted || parked) return;
      const el = contentRef.current;
      if (!el) return;
      const hasName =
        !!el.getAttribute('aria-label')?.trim() || !!el.getAttribute('aria-labelledby')?.trim();
      if (!hasName) {
        // eslint-disable-next-line no-console
        console.warn(
          '[ramka] Lightbox.Content (role="dialog") has no accessible name. ' +
            'Pass `aria-label` (e.g. aria-label="Image viewer") or `aria-labelledby` ' +
            'so screen readers announce the dialog. See the WAI-ARIA APG dialog pattern.',
        );
      }
    }, [mounted, parked]);

    // Focus containment (canonical modal focus trap, completing the Tab guards
    // below). Slides are non-focusable, so normal usage never strands focus.
    // But a consumer may place a focusable control inside a slide; when that
    // slide deactivates it becomes `inert` and the browser ejects focus to
    // `<body>`. If focus lands on `<body>`, pull it back so keyboard control
    // can never be lost.
    //
    // Portaled overlays opened from inside the dialog (Base UI menu/dialog,
    // Radix popovers, etc.) live outside this element's DOM subtree — allow
    // focus to stay there so their own dismiss handlers (Escape) run first.
    React.useEffect(() => {
      if (!mounted) return;
      const el = contentRef.current;
      if (!el) return;
      const handleFocusOut = (event: FocusEvent) => {
        if (!openRef.current) return;
        const next = event.relatedTarget as Element | null;
        if (next && el.contains(next)) return;
        if (next && !isStrandedFocus(next)) return;
        queueMicrotask(() => {
          if (!openRef.current) return;
          const active = document.activeElement;
          if (active && el.contains(active)) return;
          if (active && !isStrandedFocus(active)) return;
          el.focus({ preventScroll: true });
        });
      };
      el.addEventListener('focusout', handleFocusOut);
      return () => el.removeEventListener('focusout', handleFocusOut);
    }, [mounted]);

    // NOTE: the document scroll lock lives in Lightbox.Root (not here). During
    // VT close Content stays mounted (paint-suppressed via `preparing`) until
    // `finished`, but `open` is already false — a lock tied to Content would
    // still release too early. Root holds the lock until close completes.

    useNativePinchGuard(mounted);

    // Pull-to-dismiss: drag the image vertically to close the lightbox.
    // The active slide's live zoom level comes from the Root-owned bridge; the
    // callback identity is stable (reads a ref) so the pull effect never churns.
    const getZoom = React.useCallback(() => activeZoomRef.current?.getZoom() ?? 1, [activeZoomRef]);
    // Pull-to-dismiss is a touch gesture — restore focus to the trigger without
    // a focus ring (the user never used the keyboard). This is the mobile case
    // where a programmatic focus would otherwise inherit `:focus-visible`.
    const stableSetOpen = React.useCallback(() => setOpen(false, { focusVisible: false }), [setOpen]);

    const cachedPull = getPullRuntimeSync();
    const [PullRuntime, setPullRuntime] = React.useState<PullRuntime['PullToDismiss'] | null>(
      () => cachedPull?.PullToDismiss ?? null,
    );
    React.useEffect(() => {
      if (!pullToClose || PullRuntime) return;
      let cancelled = false;
      void loadPullRuntime().then((runtime) => {
        if (!cancelled) setPullRuntime(() => runtime.PullToDismiss);
      });
      return () => {
        cancelled = true;
      };
    }, [pullToClose, PullRuntime]);

    // Vertical touch drags that start on interactive chrome (Close / Prev /
    // Next / links / `[data-ramka-no-pull]`) are ignored by the pull gesture
    // above, so nothing canceled their moves — and on iOS Safari a vertical
    // pan with no scrollable ancestor is handed to the browser UI, expanding
    // the collapsed address bar over the open viewer. This containment layer
    // cancels exactly those drags (inner scroll containers and horizontal
    // gestures stay native). The backdrop scrim gets the same treatment for
    // skins where Content doesn't cover the whole viewport.
    useTouchScrollContainment({ hostRef: contentRef, disabled: !mounted });
    useTouchScrollContainment({ hostRef: backdropElementRef, disabled: !mounted });

    const handleKeyDown = useContentKeyboard({
      mounted,
      contentRef,
      setOpen,
      activeZoomRef,
      stageElementRef,
      itemCount,
      loop,
      activeIndex,
      navigate,
      isScrollingRef: navigationLockedRef,
    });

    // Click on the content container itself (not children) closes the
    // lightbox, matching native <dialog> backdrop click behavior. A
    // visible scrim is provided by the optional `Lightbox.Backdrop`
    // primitive, which also closes on click.
    //
    // Require the press to *start* on the scrim too. Browsers retarget
    // `click` to the nearest common ancestor of mousedown/mouseup — so a
    // drag from the image onto chrome (caption, strip, sidebar, …) fires
    // `click` on Content with target === currentTarget and would otherwise
    // false-dismiss.
    const dismissPressOnScrimRef = React.useRef(false);
    const handlePointerDown = React.useCallback((event: React.PointerEvent) => {
      dismissPressOnScrimRef.current = event.target === event.currentTarget;
    }, []);
    const handleClick = React.useCallback(
      (event: React.MouseEvent) => {
        if (!mounted) return;
        const startedOnScrim = dismissPressOnScrimRef.current;
        dismissPressOnScrimRef.current = false;
        if (startedOnScrim && event.target === event.currentTarget) {
          // Background (scrim) click is a pointer interaction → no focus ring.
          setOpen(false, { focusVisible: false });
        }
      },
      [mounted, setOpen],
    );

    // Focus guard handlers — redirect Tab past the edges back into the content.
    // Before-guard: user Shift+Tabbed past the first element → focus the last.
    // After-guard: user Tabbed past the last element → focus the first.
    const handleBeforeGuardFocus = React.useCallback(() => {
      const el = contentRef.current;
      if (!el) return;
      const tabbables = getTabbableElements(el);
      const target = tabbables[tabbables.length - 1] ?? el;
      target.focus();
    }, []);

    const handleAfterGuardFocus = React.useCallback(() => {
      const el = contentRef.current;
      if (!el) return;
      const tabbables = getTabbableElements(el);
      const target = tabbables[0] ?? el;
      target.focus();
    }, []);

    if (!present) return null;

    // Merge internal dialog props with consumer-provided props. `mergeProps`
    // composes event handlers (consumer `onKeyDown`/`onClick` run alongside the
    // internal keyboard-nav and backdrop-close handlers rather than replacing
    // them) and merges `style`/`className`, matching the convention used by
    // every other primitive. Consumer props win for plain scalar attributes.
    // Render inside `Lightbox.Portal` — Content itself does not portal.
    const dialogProps = mergeProps<'div'>(
      {
        role: 'dialog',
        // Stable id so `Lightbox.Trigger` can point `aria-controls` at this
        // dialog (Base UI Dialog pattern). Consumer-provided `id` wins via
        // mergeProps; the Trigger derives the same default from `baseId`.
        id: `${baseId}-content`,
        'aria-modal': parked ? undefined : 'true',
        'aria-hidden': parked ? true : undefined,
        // Parked keepMounted content must not steal clicks/focus from the page.
        inert: parked || undefined,
        className,
        // Establish a scroll-containment boundary. `overflow: hidden` makes
        // the content a scroll container that is permanently at its scroll
        // boundary, which is the prerequisite for `overscroll-behavior:
        // contain` to actually take effect (it is inert on a non-scroll
        // container). Together they stop wheel/touch scroll — and, crucially,
        // the macOS trackpad momentum tail latched to this container — from
        // chaining out to the page, including after the lightbox closes.
        // Consumers can still override via the `style` prop.
        //
        // While `preparing` (VT open pre-mount / VT close hold) or parked
        // closed with keepMounted, force `visibility: hidden` (+ pointer-events
        // none when parked) so the node can stay mounted without painting or
        // intercepting input.
        style: {
          overflow: 'hidden',
          overscrollBehavior: 'contain',
          // Prevent accidental text selection when performing touch gestures.
          // Library consumers will have to explicitly mark selectable elements in their implementations.
          userSelect: 'none',
          WebkitUserSelect: 'none',
          // Pull/zoom chrome sets these imperatively; keep them across React
          // style updates (otherwise discrete zoom-in loses --lightbox-zoom-progress).
          ...readPreservedChromeStyle(contentRef.current),
          ...style,
          ...(preparing || parked ? { visibility: 'hidden' as const } : null),
          ...(parked ? { pointerEvents: 'none' as const } : null),
        },
        ...(open
          ? { [LightboxContentDataAttributes.open]: '' }
          : { [LightboxContentDataAttributes.closed]: '' }),
        onKeyDown: handleKeyDown,
        onPointerDown: handlePointerDown,
        onClick: handleClick,
        tabIndex: parked ? undefined : -1,
      } as React.ComponentPropsWithRef<'div'>,
      // Identity marker is a separate merge so the enum key isn't checked as an
      // excess property on the DetailedHTMLProps cast above.
      { [LightboxContentDataAttributes.content]: '' } as React.ComponentPropsWithRef<'div'>,
      rest as React.ComponentPropsWithRef<'div'>,
    );

    return (
      <>
        {!parked ? (
          <span
            tabIndex={0}
            aria-hidden="true"
            data-focus-guard=""
            style={focusGuardStyle}
            onFocus={handleBeforeGuardFocus}
          />
        ) : null}
        <div ref={mergedRef} {...dialogProps}>
          {children}
        </div>
        {pullToClose && mounted && PullRuntime ? (
          <PullRuntime
            contentRef={contentRef}
            // Backdrop is provided by the optional `Lightbox.Backdrop` primitive.
            // When the consumer doesn't render one, `backdropElementRef.current`
            // stays null and the hook gracefully skips backdrop opacity updates.
            backdropRef={backdropElementRef}
            // The active slide element, tracked in context (Item sets it on activate).
            // The wheel/trackpad pull path reads it directly instead of re-querying
            // the DOM for `[data-ramka-item][data-active]`.
            activeItemRef={activeItemElementRef}
            // Optional Stage scopes touch + wheel pull to the media pane; null → Content.
            stageRef={stageElementRef}
            getZoom={getZoom}
            onClose={stableSetOpen}
            // Suppress the pull gesture while a Lightbox.Slides swipe/fling is running.
            isScrollingRef={navigationLockedRef}
          />
        ) : null}
        {!parked ? (
          <span
            tabIndex={0}
            aria-hidden="true"
            data-focus-guard=""
            style={focusGuardStyle}
            onFocus={handleAfterGuardFocus}
          />
        ) : null}
      </>
    );
  },
);

LightboxContent.displayName = 'LightboxContent';

export { LightboxContent };
export type { LightboxContentProps };
