'use client';

import * as React from 'react';
import * as ReactDOM from 'react-dom';

import { LightboxPortalDataAttributes } from './lightbox-data-attributes';
import { LightboxDocumentCssVars } from './lightbox-css-vars';
import { resolveViewTransitionTiming } from './vt-timing';
import { useLightboxContext } from './lightbox-context';

const useLayoutEffect = typeof window !== 'undefined' ? React.useLayoutEffect : React.useEffect;

type PortalContainer = Element | DocumentFragment | React.RefObject<Element | DocumentFragment | null> | null;

interface LightboxPortalContextValue {
  /** Mirrors the `keepMounted` prop on `Lightbox.Portal`. */
  keepMounted: boolean;
}

const LightboxPortalContext = React.createContext<LightboxPortalContextValue>({
  keepMounted: false,
});

function useLightboxPortalContext(): LightboxPortalContextValue {
  return React.useContext(LightboxPortalContext);
}

interface LightboxPortalProps extends React.ComponentPropsWithRef<'div'> {
  /**
   * Where to mount the portal host. Defaults to `document.body`.
   * Pass `null` to render the host in place (no portal).
   * A ref is resolved on each layout pass until it has a node.
   * @default document.body
   */
  container?: PortalContainer;
  /**
   * Keep Portal, Backdrop, and Content mounted while the lightbox is closed.
   * Closed ("parked") nodes stay in the DOM but are inert and non-interactive
   * (`visibility: hidden`, `pointer-events: none`) so they don't block the page.
   *
   * Useful for warm reopen of expensive destinations (e.g. map iframes) without
   * remounting them on every open.
   *
   * When using `keepMounted`, style a stacking level on the Portal host yourself
   * (e.g. `className="relative z-[1]"`) — same as Base UI’s keep-mounted guidance.
   * @default false
   */
  keepMounted?: boolean;
  children?: React.ReactNode;
}

type ResolvedTarget = Element | DocumentFragment | 'inplace';

function isRefObject(value: PortalContainer | undefined): value is React.RefObject<Element | DocumentFragment | null> {
  return typeof value === 'object' && value !== null && 'current' in value;
}

function resolvePortalTarget(container: PortalContainer | undefined): ResolvedTarget | null {
  if (container === null) return 'inplace';
  if (container === undefined) {
    return typeof document !== 'undefined' ? document.body : null;
  }
  if (isRefObject(container)) {
    return container.current;
  }
  return container;
}

/**
 * Portals `Lightbox.Backdrop` and `Lightbox.Content` out of the React tree
 * into a host element (default: `document.body`), matching Base UI Dialog.
 *
 * Required composition:
 *
 * ```tsx
 * <Lightbox.Root>
 *   <Lightbox.Trigger index={0} />
 *   <Lightbox.Portal>
 *     <Lightbox.Backdrop />
 *     <Lightbox.Content>…</Lightbox.Content>
 *   </Lightbox.Portal>
 * </Lightbox.Root>
 * ```
 *
 * Stacking (Base UI pattern):
 * 1. Put `isolation: isolate` on the app layout root.
 * 2. With `keepMounted`, set `z-index` on the Portal host in your styles.
 * Inside the portal, document order is enough (Backdrop before Content).
 */
const LightboxPortal = React.forwardRef<HTMLDivElement, LightboxPortalProps>(
  function LightboxPortal(props, forwardedRef) {
    const { children, container, keepMounted = false, className, style, ...rest } = props;
    const { mounted, transitionPreset, dirAttribute } = useLightboxContext();

    // Publish the Root's `viewTransition` preset timing as CSS vars on the
    // portal host, so skins have ONE motion clock for open/close fades: during
    // a morph the same vars exist on documentElement (written per-transition,
    // same values), and here they cover everything else — non-VT browsers,
    // reduced motion, low-end fallback opens. Scoped to the host (not :root)
    // so multiple Roots with different presets never fight.
    const timing = resolveViewTransitionTiming(transitionPreset);
    const hostStyle: React.CSSProperties = {
      [LightboxDocumentCssVars.vtDuration]: `${timing.duration}ms`,
      [LightboxDocumentCssVars.vtEasing]: timing.cssEasing,
      [LightboxDocumentCssVars.vtRootEasing]: timing.cssRootEasing,
      ...style,
    } as React.CSSProperties;

    const [portalTarget, setPortalTarget] = React.useState<ResolvedTarget | null>(() => resolvePortalTarget(container));

    const contextValue = React.useMemo<LightboxPortalContextValue>(() => ({ keepMounted }), [keepMounted]);

    useLayoutEffect(() => {
      setPortalTarget(resolvePortalTarget(container));
    }, [container]);

    if (!(mounted || keepMounted) || portalTarget === null) {
      return null;
    }

    const host = (
      <LightboxPortalContext.Provider value={contextValue}>
        <div
          ref={forwardedRef}
          className={className}
          style={hostStyle}
          // Carry the Root's `dir` across the portal boundary. Without this the
          // host lands on `document.body` and inherits the page's direction, so
          // `dir="rtl"` would mirror behavior inside an LTR box. Before `rest`,
          // so an explicit `dir` on Portal still wins.
          dir={dirAttribute}
          {...rest}
          {...{ [LightboxPortalDataAttributes.portal]: '' }}
        >
          {children}
        </div>
      </LightboxPortalContext.Provider>
    );

    if (portalTarget === 'inplace') {
      return host;
    }

    return ReactDOM.createPortal(host, portalTarget);
  },
);

LightboxPortal.displayName = 'LightboxPortal';

export { LightboxPortal, useLightboxPortalContext };
export type { LightboxPortalProps, LightboxPortalContextValue };
