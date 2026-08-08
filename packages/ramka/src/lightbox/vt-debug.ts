import { VIEW_TRANSITION_NAME } from './lightbox-context';

// ---------------------------------------------------------------------------
// View Transition debug tracing (dev-only, opt-in)
//
// Enable by setting `window.__RAMKA_VT_DEBUG__ = true` (logs to console and
// POSTs to `/api/vt-log`) or to a string endpoint URL. No-op otherwise.
//
// Per animation frame it samples the morph group pseudo-element's computed
// `transform`/`width`/`height` plus visualViewport/innerWidth metrics, and on
// `ready` records the UA-generated animation inventory incl. keyframes. This
// separates "the animation values themselves jitter" (visible in samples)
// from "values are smooth but the compositor jitters" (invisible here).
// ---------------------------------------------------------------------------

interface TraceableTransition {
  ready?: Promise<void>;
  finished: Promise<void>;
}

function maybeTraceViewTransition(
  transition: TraceableTransition,
  phase: 'opening' | 'closing',
): void {
  if (typeof window === 'undefined') return;
  const flag = (window as unknown as Record<string, unknown>).__RAMKA_VT_DEBUG__;
  if (!flag) return;
  const endpoint = typeof flag === 'string' ? flag : '/api/vt-log';

  const docEl = document.documentElement;
  const groupPseudo = `::view-transition-group(${VIEW_TRANSITION_NAME})`;
  const samples: Array<Record<string, unknown>> = [];
  let meta: Record<string, unknown> = { phase, note: 'ready never resolved' };
  let raf = 0;

  const sample = (t: number) => {
    const cs = getComputedStyle(docEl, groupPseudo);
    const vv = window.visualViewport;
    // Painted animation time of the morph group's first animation this frame
    // — reveals start-skipping (first painted ct >> 0) vs late starts.
    let ct: number | null = null;
    try {
      const anim = document
        .getAnimations()
        .find((a) => (a.effect as KeyframeEffect | null)?.pseudoElement === groupPseudo);
      if (anim && anim.currentTime != null) {
        ct = Math.round(Number(anim.currentTime) * 10) / 10;
      }
    } catch {
      // getAnimations unsupported — leave null.
    }
    samples.push({
      t: Math.round(t * 100) / 100,
      ct,
      transform: cs.transform,
      width: cs.width,
      height: cs.height,
      vv: vv ? [vv.offsetLeft, vv.offsetTop, vv.width, vv.height, vv.scale] : null,
      inner: [window.innerWidth, window.innerHeight],
    });
    raf = requestAnimationFrame(sample);
  };

  transition.ready
    ?.then(() => {
      const anims = document.getAnimations().filter((a) => {
        const pseudo = (a.effect as KeyframeEffect | null)?.pseudoElement;
        return pseudo?.startsWith('::view-transition') ?? false;
      });
      meta = {
        phase,
        ua: navigator.userAgent,
        href: location.href,
        composited:
          (window as unknown as Record<string, unknown>).__RAMKA_VT_COMPOSITED__ !== false,
        preset: docEl.getAttribute('data-ramka-vt-preset'),
        groupTransformOrigin: getComputedStyle(docEl, groupPseudo).transformOrigin,
        dpr: window.devicePixelRatio,
        screen: [window.screen.width, window.screen.height],
        animations: anims.map((a) => {
          const effect = a.effect as KeyframeEffect;
          const isMorph = effect.pseudoElement?.includes(VIEW_TRANSITION_NAME) ?? false;
          let keyframes: unknown;
          if (isMorph) {
            try {
              keyframes = effect.getKeyframes();
            } catch (e) {
              keyframes = `getKeyframes failed: ${String(e)}`;
            }
          }
          return {
            pseudo: effect.pseudoElement,
            name: (a as CSSAnimation).animationName ?? null,
            duration: effect.getComputedTiming().duration,
            keyframes,
          };
        }),
      };
      raf = requestAnimationFrame(sample);
    })
    .catch(() => {});

  transition.finished.finally(() => {
    cancelAnimationFrame(raf);
    const payload = JSON.stringify({ meta, samples });
    // eslint-disable-next-line no-console -- opt-in debug tracing
    console.log('[ramka-vt-trace]', payload);
    try {
      void fetch(endpoint, {
        method: 'POST',
        body: payload,
        keepalive: true,
        headers: { 'content-type': 'application/json' },
      });
    } catch {
      // Trace delivery is best-effort.
    }
  });
}

export { maybeTraceViewTransition };
