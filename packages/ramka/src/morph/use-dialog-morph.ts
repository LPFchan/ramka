'use client';

import * as React from 'react';
import { flushSync } from 'react-dom';

import {
  resolveMorphBorderRadius,
  startViewTransition,
} from '../lightbox/use-view-transition-morph';

// ---------------------------------------------------------------------------
// Contract constants
// ---------------------------------------------------------------------------
// All names are distinct from the Lightbox morph contract (`lightbox-morph`,
// `data-ramka-view-transition`, `--lightbox-*`) so both can coexist on a page.

/** view-transition-name applied to the source/target for the morph. A single
 * fixed name is deliberate: only one dialog morph runs at a time, the name is
 * applied inline only for the duration of the transition, and a static name
 * lets the injected CSS target `::view-transition-group(...)` without
 * `view-transition-class` (not yet reliable cross-browser). */
const MORPH_NAME = 'ramka-dialog-morph';

/** view-transition-name for the dialog overlay/backdrop, when registered.
 * Safari and Firefox don't paint `backdrop-filter` into view-transition
 * snapshot layers (WebKit bug 293393, Gecko bug 1996597), so an overlay blur
 * would pop in only after the transition finishes. Per the CSSWG resolution
 * for csswg-drafts#9358, the fix is to move the backdrop-filter onto the
 * element's `::view-transition-group()` pseudo — group pseudos are painted
 * live every frame and blur whatever renders beneath them in the pseudo
 * tree. The hook copies the overlay's computed backdrop-filter into
 * `--ramka-dialog-morph-overlay-backdrop` and the injected CSS animates it
 * on the group. */
const OVERLAY_NAME = 'ramka-dialog-morph-overlay';

/** `<html>` attribute carrying the morph phase (`opening` | `closing`). */
const DOC_ATTR = 'data-ramka-dialog-morph';

/** Present on the source element while the dialog is open — the injected CSS
 * hides it so the trigger doesn't peek out from behind the dialog. */
const SOURCE_HIDDEN_ATTR = 'data-ramka-dialog-morph-source';

/** Set on the panel inside the close transition. Dialog libraries keep the
 * panel mounted after `open=false` to wait out their exit animation — but the
 * `::view-transition-new(root)` layer renders the LIVE page, so a lingering
 * panel would show next to the morphing snapshot like a clone. The injected
 * CSS `display: none`s it (attribute + `!important` so a library re-render
 * can't wipe it, unlike an inline style), which also cancels any exit
 * animation/transition so unmount-on-animation-end resolves immediately.
 * Sticky until the element unmounts. */
const TARGET_EXITING_ATTR = 'data-ramka-dialog-morph-exiting';

const VAR_RADIUS_FROM = '--ramka-dialog-morph-radius-from';
const VAR_RADIUS_TO = '--ramka-dialog-morph-radius-to';
const VAR_DURATION = '--ramka-dialog-morph-duration';
const VAR_OVERLAY_BACKDROP = '--ramka-dialog-morph-overlay-backdrop';

const STYLE_ELEMENT_ID = 'ramka-dialog-morph-styles';

// ---------------------------------------------------------------------------
// Injected stylesheet
// ---------------------------------------------------------------------------
// Self-contained so the primitive is a single import. Theme via CSS vars on
// :root — `--ramka-dialog-morph-duration` / `--ramka-dialog-morph-easing` /
// `--ramka-dialog-morph-root-easing`.

const MORPH_CSS = /* css */ `
[${SOURCE_HIDDEN_ATTR}] {
  opacity: 0 !important;
}

[${TARGET_EXITING_ATTR}] {
  display: none !important;
}

@media (prefers-reduced-motion: no-preference) {
  /* Isolation: while a dialog morph runs, no other element keeps a
     view-transition-name (the morph elements are named inline with
     !important, which outranks this rule). Prevents unrelated named elements
     from tearing out of the root crossfade mid-morph. */
  :root[${DOC_ATTR}] * {
    view-transition-name: none !important;
  }

  :root[${DOC_ATTR}]::view-transition-old(root),
  :root[${DOC_ATTR}]::view-transition-new(root) {
    animation-duration: var(${VAR_DURATION}, 320ms);
    animation-timing-function: var(--ramka-dialog-morph-root-easing, cubic-bezier(0.16, 1, 0.3, 1));
  }

  @keyframes ramka-dialog-morph-radius {
    to {
      border-radius: var(${VAR_RADIUS_TO}, 0px);
    }
  }

  :root[${DOC_ATTR}]::view-transition-group(${MORPH_NAME}) {
    overflow: hidden;
    border-radius: var(${VAR_RADIUS_FROM}, 0px);
    animation-name: -ua-view-transition-group-anim-${MORPH_NAME}, ramka-dialog-morph-radius;
    animation-duration: var(${VAR_DURATION}, 320ms);
    animation-timing-function: var(--ramka-dialog-morph-easing, cubic-bezier(0.32, 0.72, 0, 1));
    animation-fill-mode: both;
    z-index: 2;
  }

  /* Both snapshots stretch to the morphing box; the dissolve hides the
     stretch. Normal blending (not the UA's plus-lighter): a light trigger
     must never glow through a dark panel or vice versa. */
  :root[${DOC_ATTR}]::view-transition-old(${MORPH_NAME}),
  :root[${DOC_ATTR}]::view-transition-new(${MORPH_NAME}) {
    width: 100%;
    height: 100%;
    object-fit: fill;
    mix-blend-mode: normal;
  }

  @keyframes ramka-dialog-morph-fade-out {
    from { opacity: 1; }
    to { opacity: 0; }
  }
  @keyframes ramka-dialog-morph-fade-in {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  /* Opening is front-loaded: trigger gone by ~35% of the morph, panel opaque
     by ~55% — the rest is a pure morph of the opaque panel. */
  :root[${DOC_ATTR}='opening']::view-transition-old(${MORPH_NAME}) {
    animation: ramka-dialog-morph-fade-out calc(var(${VAR_DURATION}, 320ms) * 0.35) ease-out both;
  }
  :root[${DOC_ATTR}='opening']::view-transition-new(${MORPH_NAME}) {
    animation: ramka-dialog-morph-fade-in calc(var(${VAR_DURATION}, 320ms) * 0.55) ease-out both;
  }

  /* Closing mirrors it: panel holds while the trigger fades back in early. */
  :root[${DOC_ATTR}='closing']::view-transition-old(${MORPH_NAME}) {
    animation: ramka-dialog-morph-fade-out calc(var(${VAR_DURATION}, 320ms) * 0.55) ease-out both;
  }
  :root[${DOC_ATTR}='closing']::view-transition-new(${MORPH_NAME}) {
    animation: ramka-dialog-morph-fade-in var(${VAR_DURATION}, 320ms) ease-out both;
  }

  /* Overlay backdrop-filter — see OVERLAY_NAME. The filter lives on the
     group pseudo (live-rendered, so it blurs the root layer beneath it even
     in engines that drop backdrop-filter from snapshot captures) and is
     animated so the blur ramps with the morph instead of popping. The
     overlay's own snapshots (the tint) crossfade over the full duration. */
  :root[${DOC_ATTR}]::view-transition-group(${OVERLAY_NAME}) {
    z-index: 1;
  }
  :root[${DOC_ATTR}]::view-transition-old(${OVERLAY_NAME}),
  :root[${DOC_ATTR}]::view-transition-new(${OVERLAY_NAME}) {
    animation-duration: var(${VAR_DURATION}, 320ms);
  }

  @keyframes ramka-dialog-morph-backdrop-in {
    from {
      -webkit-backdrop-filter: none;
      backdrop-filter: none;
    }
    to {
      -webkit-backdrop-filter: var(${VAR_OVERLAY_BACKDROP}, none);
      backdrop-filter: var(${VAR_OVERLAY_BACKDROP}, none);
    }
  }
  @keyframes ramka-dialog-morph-backdrop-out {
    from {
      -webkit-backdrop-filter: var(${VAR_OVERLAY_BACKDROP}, none);
      backdrop-filter: var(${VAR_OVERLAY_BACKDROP}, none);
    }
    to {
      -webkit-backdrop-filter: none;
      backdrop-filter: none;
    }
  }

  :root[${DOC_ATTR}='opening']::view-transition-group(${OVERLAY_NAME}) {
    animation: ramka-dialog-morph-backdrop-in var(${VAR_DURATION}, 320ms) ease-out both;
  }
  :root[${DOC_ATTR}='closing']::view-transition-group(${OVERLAY_NAME}) {
    animation: ramka-dialog-morph-backdrop-out var(${VAR_DURATION}, 320ms) ease-out both;
  }
}
`;

/** Injects the morph stylesheet once per document (no-op on re-mounts). */
function ensureMorphStyles() {
  if (typeof document === 'undefined') return;
  if (document.getElementById(STYLE_ELEMENT_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ELEMENT_ID;
  style.textContent = MORPH_CSS;
  document.head.appendChild(style);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function supportsViewTransitions(): boolean {
  return (
    typeof document !== 'undefined' &&
    'startViewTransition' in document &&
    !window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

/** Inline `!important` so the isolation rule can't neutralize the morph
 * elements — mirrors the Lightbox morph naming. */
function setMorphName(el: HTMLElement, name: string = MORPH_NAME) {
  el.style.setProperty('view-transition-name', name, 'important');
}

function clearMorphName(el: HTMLElement | null) {
  el?.style.removeProperty('view-transition-name');
}

/** The dialog's own open/close animations (e.g. shadcn's `zoom-in-95` /
 * `fade-in-0`) must not run inside the morphing snapshot — the new snapshot
 * renders the LIVE element, so a mount animation would play inside the
 * morphing group and fight the geometry animation. Suppressed for the
 * element's whole lifetime, NOT restored when the morph finishes: removing
 * the override would re-apply the library's `animation` declaration, and a
 * freshly applied CSS animation restarts from frame 0 — the settled dialog
 * would replay its mount animation as a visible flash. The dialog keeps its
 * normal animations whenever the morph can't run (reduced motion, no browser
 * support, no trigger), since this is never called on those paths. */
function suppressAnimations(el: HTMLElement) {
  el.style.setProperty('animation', 'none', 'important');
}

/** Copies the overlay's computed backdrop-filter to a root var (consumed by
 * the injected group-pseudo keyframes) and lifts the overlay into its own
 * view-transition group — see OVERLAY_NAME for why. Reading the computed
 * value keeps the primitive agnostic to how the consumer styles the blur. */
function captureOverlayBackdrop(docEl: HTMLElement, overlay: HTMLElement) {
  const style = getComputedStyle(overlay) as CSSStyleDeclaration & {
    webkitBackdropFilter?: string;
  };
  const backdrop = style.backdropFilter || style.webkitBackdropFilter || 'none';
  if (backdrop !== 'none') {
    docEl.style.setProperty(VAR_OVERLAY_BACKDROP, backdrop);
  }
  setMorphName(overlay, OVERLAY_NAME);
}

function clearDocumentState(docEl: HTMLElement) {
  docEl.removeAttribute(DOC_ATTR);
  docEl.style.removeProperty(VAR_RADIUS_FROM);
  docEl.style.removeProperty(VAR_RADIUS_TO);
  docEl.style.removeProperty(VAR_OVERLAY_BACKDROP);
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

interface UseDialogMorphOptions {
  /**
   * Master switch — `false` returns an inert passthrough (plain state, no
   * view transitions, refs do nothing). Lets component libraries call the
   * hook unconditionally and expose morphing as an opt-in prop.
   * @default true
   */
  enabled?: boolean;
  /** Controlled open state. */
  open?: boolean;
  /** Uncontrolled initial open state. @default false */
  defaultOpen?: boolean;
  /** Called when the open state changes. Extra arguments from the dialog
   * library's own `onOpenChange` (e.g. Base UI event details) are forwarded.
   * Typed `any[]` so callbacks with library-specific detail params (like Base
   * UI's `DialogRootChangeEventDetails`) stay assignable. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onOpenChange?: (open: boolean, ...meta: any[]) => void;
}

interface DialogMorph {
  /** Resolved open state — pass to the dialog root's `open`. */
  open: boolean;
  /**
   * Routed setter — pass to the dialog root's `onOpenChange`. Flips the state
   * inside `document.startViewTransition` so the source morphs into the panel
   * (and back). Falls back to a plain flip without browser support, with
   * reduced motion, or when no source element is registered.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onOpenChange: (open: boolean, ...meta: any[]) => void;
  /** Callback ref for the morph source (the trigger element). */
  sourceRef: (el: HTMLElement | null) => void;
  /** Callback ref for the morph target (the dialog panel element). */
  targetRef: (el: HTMLElement | null) => void;
  /**
   * Optional callback ref for the dialog overlay/backdrop. Only needed when
   * the overlay uses `backdrop-filter`: Safari and Firefox don't paint
   * backdrop filters into view-transition snapshots, so an unregistered
   * blurred overlay pops in only after the morph finishes. Registering it
   * lets the hook re-create the blur on a live `::view-transition-group()`
   * pseudo and ramp it with the morph.
   */
  overlayRef: (el: HTMLElement | null) => void;
  /** Echo of `options.enabled` — handy for conditional context values. */
  enabled: boolean;
}

/**
 * Standalone trigger → dialog morph for any dialog with a controlled
 * `open`/`onOpenChange` (Base UI, Radix, shadcn wrappers, react-aria…).
 *
 * Extracted from the Lightbox's View Transition morph, minus everything
 * gallery-shaped: no index tracking, image decode waits, zoom, or gestures —
 * just the naming dance, radius interpolation, and crossfade contract.
 *
 * Wire three points, typically inside a component-library dialog definition:
 *
 * ```tsx
 * const morph = useDialogMorph({ enabled: props.morph, open, defaultOpen, onOpenChange });
 *
 * <DialogPrimitive.Root open={morph.open} onOpenChange={morph.onOpenChange}>
 *   <DialogPrimitive.Trigger ref={morph.sourceRef} />
 *   <DialogPrimitive.Backdrop ref={morph.overlayRef} />
 *   <DialogPrimitive.Popup ref={morph.targetRef} />
 * ```
 *
 * Styling is self-contained (a stylesheet is injected once per document);
 * theme with `--ramka-dialog-morph-duration` / `--ramka-dialog-morph-easing`
 * on `:root`. While the dialog is open the source carries
 * `data-ramka-dialog-morph-source` and is hidden.
 */
function useDialogMorph(options: UseDialogMorphOptions = {}): DialogMorph {
  const { enabled = true, open: openProp, defaultOpen = false, onOpenChange } = options;

  const isControlled = openProp !== undefined;
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(defaultOpen);
  const open = isControlled ? openProp : uncontrolledOpen;

  const openRef = React.useRef(open);
  openRef.current = open;
  const enabledRef = React.useRef(enabled);
  enabledRef.current = enabled;
  const isControlledRef = React.useRef(isControlled);
  isControlledRef.current = isControlled;
  const onOpenChangeRef = React.useRef(onOpenChange);
  onOpenChangeRef.current = onOpenChange;

  const sourceElRef = React.useRef<HTMLElement | null>(null);
  const targetElRef = React.useRef<HTMLElement | null>(null);
  const overlayElRef = React.useRef<HTMLElement | null>(null);
  /** Generation guard: a superseding transition owns cleanup from then on. */
  const genRef = React.useRef(0);

  React.useEffect(() => {
    if (enabled) ensureMorphStyles();
  }, [enabled]);

  const sourceRef = React.useCallback((el: HTMLElement | null) => {
    sourceElRef.current = el;
    // A source (re)mounted while open must be hidden immediately (e.g. a
    // list re-render swapping the trigger element behind the open dialog).
    if (el && enabledRef.current && openRef.current) {
      el.setAttribute(SOURCE_HIDDEN_ATTR, '');
    }
  }, []);

  const targetRef = React.useCallback((el: HTMLElement | null) => {
    targetElRef.current = el;
    // Defensive: if a dialog library ever reuses the panel element across
    // close/open cycles, it must not inherit the sticky exit state.
    el?.removeAttribute(TARGET_EXITING_ATTR);
  }, []);

  const overlayRef = React.useCallback((el: HTMLElement | null) => {
    overlayElRef.current = el;
    el?.removeAttribute(TARGET_EXITING_ATTR);
  }, []);

  const commit = React.useCallback((value: boolean, meta: unknown[]) => {
    if (!isControlledRef.current) {
      setUncontrolledOpen(value);
    }
    onOpenChangeRef.current?.(value, ...meta);
  }, []);

  const handleOpenChange = React.useCallback(
    (next: boolean, ...meta: unknown[]) => {
      if (next === openRef.current) return;

      const source = sourceElRef.current;

      // Fallbacks: passthrough (disabled), unsupported browser, reduced
      // motion, or opening with no registered source (nothing to morph from —
      // let the dialog's own animations run instead).
      if (!enabledRef.current || !supportsViewTransitions() || (next && !source)) {
        commit(next, meta);
        if (enabledRef.current && source) {
          if (next) source.setAttribute(SOURCE_HIDDEN_ATTR, '');
          else source.removeAttribute(SOURCE_HIDDEN_ATTR);
        }
        return;
      }

      genRef.current += 1;
      const gen = genRef.current;
      const docEl = document.documentElement;

      if (next) {
        // OPEN: old snapshot captures the named source; the callback flips
        // state (mounting the dialog), then names the panel for the new
        // snapshot. Reads (radius) happen before writes to avoid forced
        // reflows mid-capture.
        const fromRadius = resolveMorphBorderRadius(source!);
        docEl.setAttribute(DOC_ATTR, 'opening');
        docEl.style.setProperty(VAR_RADIUS_FROM, fromRadius);
        setMorphName(source!);

        const transition = startViewTransition(() => {
          clearMorphName(source);
          flushSync(() => commit(true, meta));
          source!.setAttribute(SOURCE_HIDDEN_ATTR, '');
          const target = targetElRef.current;
          const overlay = overlayElRef.current;
          if (overlay) {
            captureOverlayBackdrop(docEl, overlay);
            suppressAnimations(overlay);
          }
          if (target) {
            // Mounted inside the flush above — layout is clean, so this read
            // is the only reflow inside the callback and it's a small tree.
            docEl.style.setProperty(VAR_RADIUS_TO, resolveMorphBorderRadius(target));
            suppressAnimations(target);
            setMorphName(target);
          } else if (process.env.NODE_ENV !== 'production') {
            // eslint-disable-next-line no-console
            console.warn(
              '[ramka] useDialogMorph: no target element was registered when the ' +
                'dialog opened. Attach `targetRef` to the dialog panel element.',
            );
          }
        });

        transition.finished.finally(() => {
          if (genRef.current !== gen) return;
          clearMorphName(targetElRef.current);
          // The overlay persists while open — its name must go so it can't
          // leak into unrelated view transitions started elsewhere.
          clearMorphName(overlayElRef.current);
          // Deliberately NOT restoring the panel's `animation` here — see
          // suppressAnimations. The suppression dies with the element.
          clearDocumentState(docEl);
        });
      } else {
        // CLOSE: old snapshot captures the named panel; the callback flips
        // state, un-hides + names the source for the new snapshot. Dialog
        // libraries that keep the panel mounted through an exit animation
        // would leave a live ghost showing through the (live-rendered)
        // ::view-transition-new(root) layer — the sticky exiting attribute
        // display:nones it until it unmounts.
        const target = targetElRef.current;
        const overlay = overlayElRef.current;
        const canMorph = !!target && !!source;

        if (canMorph) {
          const fromRadius = resolveMorphBorderRadius(target!);
          const toRadius = resolveMorphBorderRadius(source!);
          docEl.setAttribute(DOC_ATTR, 'closing');
          docEl.style.setProperty(VAR_RADIUS_FROM, fromRadius);
          docEl.style.setProperty(VAR_RADIUS_TO, toRadius);
          setMorphName(target!);
        } else {
          // No morph ends — still a view transition, so the close is a clean
          // root crossfade instead of an instant blink.
          docEl.setAttribute(DOC_ATTR, 'closing');
        }
        // The overlay only exists in the OLD state on close — name it before
        // capture so its blur animates out on the live group pseudo.
        if (overlay) captureOverlayBackdrop(docEl, overlay);

        const transition = startViewTransition(() => {
          clearMorphName(target);
          clearMorphName(overlay);
          flushSync(() => commit(false, meta));
          source?.removeAttribute(SOURCE_HIDDEN_ATTR);
          if (canMorph) {
            setMorphName(source!);
          }
          // Same lingering-ghost treatment as the panel: the overlay also
          // stays mounted through the library's exit animation.
          if (target?.isConnected) {
            target.setAttribute(TARGET_EXITING_ATTR, '');
          }
          if (overlay?.isConnected) {
            overlay.setAttribute(TARGET_EXITING_ATTR, '');
          }
        });

        transition.finished.finally(() => {
          if (genRef.current !== gen) return;
          clearMorphName(sourceElRef.current);
          clearMorphName(overlayElRef.current);
          clearDocumentState(docEl);
        });
      }
    },
    [commit],
  );

  // Safety net: keep the source-hidden attribute in sync with state for paths
  // that bypass handleOpenChange (e.g. a controlled `open` prop flipped by
  // something other than the dialog). The imperative writes above already
  // handled the capture-critical timing; this is a no-op then.
  React.useEffect(() => {
    const source = sourceElRef.current;
    if (!source) return;
    if (enabled && open) source.setAttribute(SOURCE_HIDDEN_ATTR, '');
    else source.removeAttribute(SOURCE_HIDDEN_ATTR);
  }, [enabled, open]);

  return React.useMemo(
    () => ({ open, onOpenChange: handleOpenChange, sourceRef, targetRef, overlayRef, enabled }),
    [open, handleOpenChange, sourceRef, targetRef, overlayRef, enabled],
  );
}

export { useDialogMorph };
export type { UseDialogMorphOptions, DialogMorph };
