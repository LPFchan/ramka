/**
 * Perf-lab instrumentation harness. Debug-only, imported solely by
 * app/debug/perf-lab/page.tsx.
 *
 * Records a timestamped event log of everything that happens between a user
 * input and the end of an open/close transition:
 *
 * - View Transition phase boundaries (call → update start/end → ready →
 *   finished), by wrapping `document.startViewTransition`.
 * - `document.adoptedStyleSheets` assignments (the adopt/un-adopt churn).
 * - Inline style writes on `<html>` (inherited custom props, user-select).
 * - Slow forced layout reads (getBoundingClientRect / offset* > 4ms).
 * - Main-thread freezes, as gaps in a continuous rAF loop.
 *
 * Ablations (via `?ablate=adopt,rootvars,userselect,vt`) neutralize one
 * suspect at a time so its cost can be measured as a delta against baseline:
 *
 * - `adopt`      — never adds/removes adopted sheets after install; instead
 *                  copies incoming rules into one persistent "channel" sheet
 *                  (removals are skipped/leaked). Approximates PR #80's fix.
 * - `rootvars`   — drops `--*` custom-property writes on `<html>`.
 * - `userselect` — drops `user-select` / `-webkit-user-select` writes on `<html>`.
 * - `isolation`  — drops `data-ramka-*` attribute flips on `<html>` (the
 *                  view-transition phase attr that arms the universal-selector
 *                  isolation rule, plus the preset/crossfade attrs).
 * - `scrolllock` — drops the scroll lock's `overflow` write on `<html>`
 *                  (a document-wide layout invalidation).
 * - `vt`         — replaces `startViewTransition` with a pass-through stub:
 *                  all library work still runs, but the browser never
 *                  snapshots. Isolates the browser's own VT cost.
 */

interface PerfEvent {
  t: number;
  name: string;
  detail?: Record<string, unknown>;
}

interface PerfCycle {
  kind: 'open' | 'close';
  tInput: number;
  /** input → startViewTransition call (React mount/commit + sync prep). */
  prepMs: number | null;
  /** startViewTransition call → update callback start (old-state snapshot). */
  oldCaptureMs: number | null;
  /** update callback duration (flushSync reveal/close commit). */
  updateMs: number | null;
  /** update end → ready (new-state snapshot + first-frame setup). */
  newCaptureMs: number | null;
  /** ready → finished (the animation itself). */
  animMs: number | null;
  /** input → ready: the full perceived freeze before anything moves. */
  inputToReadyMs: number | null;
  /** Longest main-thread stall (rAF gap) within the cycle. */
  maxRafGapMs: number;
  /** Sum of slow forced-read time within the cycle. */
  slowReadMs: number;
  adoptSets: number;
  rootVarWrites: number;
  events: PerfEvent[];
}

interface PerfLab {
  config: { ablate: string[] };
  events: PerfEvent[];
  cycles: PerfCycle[];
}

declare global {
  interface Window {
    __perfLab?: PerfLab;
  }
}

const now = () => performance.now();

export function installPerfHarness(): void {
  if (typeof window === 'undefined' || window.__perfLab) return;

  const params = new URLSearchParams(window.location.search);
  const ablate = new Set(
    (params.get('ablate') ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  );

  const lab: PerfLab = { config: { ablate: [...ablate] }, events: [], cycles: [] };
  window.__perfLab = lab;

  const log = (name: string, detail?: Record<string, unknown>) => {
    lab.events.push({ t: now(), name, detail });
  };
  log('harness:installed', { ablate: [...ablate] });

  // ---------------------------------------------------------------- rAF gaps
  let lastFrame = now();
  const frameLoop = () => {
    const t = now();
    const gap = t - lastFrame;
    if (gap > 34) log('raf-gap', { ms: Math.round(gap), from: lastFrame });
    lastFrame = t;
    requestAnimationFrame(frameLoop);
  };
  requestAnimationFrame(frameLoop);

  // ------------------------------------------------------------------ inputs
  let cycleStart: { t: number; kind: 'open' | 'close' } | null = null;
  let cycleEventStart = 0;
  let finalizeTimer: number | null = null;

  const finalizeCycle = () => {
    if (!cycleStart) return;
    const events = lab.events.slice(cycleEventStart);
    const find = (name: string) => events.find((e) => e.name === name)?.t ?? null;
    const tInput = cycleStart.t;
    const vtCall = find('vt:call') ?? find('vt:call-stubbed');
    const updStart = find('vt:update-start');
    const updEnd = find('vt:update-end');
    const ready = find('vt:ready');
    const finished = find('vt:finished');
    const gaps = events.filter((e) => e.name === 'raf-gap');
    const slowReads = events.filter((e) => e.name === 'slowread');
    lab.cycles.push({
      kind: cycleStart.kind,
      tInput,
      prepMs: vtCall !== null ? vtCall - tInput : null,
      oldCaptureMs: vtCall !== null && updStart !== null ? updStart - vtCall : null,
      updateMs: updStart !== null && updEnd !== null ? updEnd - updStart : null,
      newCaptureMs: updEnd !== null && ready !== null ? ready - updEnd : null,
      animMs: ready !== null && finished !== null ? finished - ready : null,
      inputToReadyMs: ready !== null ? ready - tInput : null,
      maxRafGapMs: Math.max(0, ...gaps.map((e) => Number(e.detail?.ms ?? 0))),
      slowReadMs: slowReads.reduce((sum, e) => sum + Number(e.detail?.ms ?? 0), 0),
      adoptSets: events.filter((e) => e.name === 'adopt:set').length,
      rootVarWrites: events.filter((e) => e.name === 'rootstyle:set').length,
      events,
    });
    cycleStart = null;
    updateHud();
  };

  const scheduleFinalize = (delay: number) => {
    if (finalizeTimer !== null) window.clearTimeout(finalizeTimer);
    finalizeTimer = window.setTimeout(finalizeCycle, delay);
  };

  const onInput = (kind: 'open' | 'close') => {
    // A new input while a cycle is pending closes the previous one first.
    if (cycleStart) finalizeCycle();
    cycleStart = { t: now(), kind };
    cycleEventStart = lab.events.length;
    log(`input:${kind}`);
    // Fallback finalize for cycles that never produce vt:finished.
    scheduleFinalize(2000);
  };

  window.addEventListener(
    'pointerdown',
    (ev) => {
      const target = ev.target as Element | null;
      const inDialog = !!target?.closest('[role="dialog"]');
      onInput(inDialog ? 'close' : 'open');
    },
    { capture: true },
  );
  window.addEventListener(
    'keydown',
    (ev) => {
      if (ev.key === 'Escape') onInput('close');
    },
    { capture: true },
  );

  // -------------------------------------------------------- startViewTransition
  interface VTLike {
    ready?: Promise<void>;
    finished?: Promise<void>;
    updateCallbackDone?: Promise<void>;
    skipTransition?: () => void;
    types?: Set<string>;
  }
  type VTCallback = () => void | Promise<void>;
  type StartVT = (cb?: VTCallback) => VTLike;
  // The DOM lib ships its own strict `startViewTransition` signature, so both
  // the read and the write go through an untyped view of `document`.
  const untypedDoc = document as unknown as Record<string, unknown>;
  const origStartVTRaw = untypedDoc.startViewTransition as StartVT | undefined;
  const origStartVT = origStartVTRaw ? origStartVTRaw.bind(document) : undefined;
  const setStartVT = (fn: StartVT) => {
    untypedDoc.startViewTransition = fn;
  };

  if (ablate.has('vt')) {
    setStartVT((cb) => {
      log('vt:call-stubbed');
      const updateCallbackDone = (async () => {
        log('vt:update-start');
        await cb?.();
        log('vt:update-end');
      })();
      const ready = updateCallbackDone.then(() => log('vt:ready'));
      const finished = ready.then(() => {
        log('vt:finished');
        scheduleFinalize(300);
      });
      return {
        updateCallbackDone,
        ready,
        finished,
        skipTransition() {},
        types: new Set<string>(),
      };
    });
  } else if (origStartVT) {
    setStartVT((cb) => {
      log('vt:call');
      const transition = origStartVT(async () => {
        log('vt:update-start');
        await cb?.();
        log('vt:update-end');
      });
      transition.ready?.then(
        () => log('vt:ready'),
        () => log('vt:ready-rejected'),
      );
      transition.finished?.then(() => {
        log('vt:finished');
        scheduleFinalize(300);
      });
      return transition;
    });
  }

  // ------------------------------------------------------- adoptedStyleSheets
  const adoptedDesc =
    Object.getOwnPropertyDescriptor(Document.prototype, 'adoptedStyleSheets') ??
    Object.getOwnPropertyDescriptor(document, 'adoptedStyleSheets');
  if (adoptedDesc?.get && adoptedDesc.set) {
    const getSheets = () => adoptedDesc.get!.call(document) as CSSStyleSheet[];
    const setSheets = (v: CSSStyleSheet[]) => adoptedDesc.set!.call(document, v);

    if (ablate.has('adopt') && typeof CSSStyleSheet.prototype.replaceSync === 'function') {
      // One persistent channel sheet; incoming sheets are copied into it as
      // rules, removals are skipped. The sheet *list* never changes again.
      const channel = new CSSStyleSheet();
      setSheets([...getSheets(), channel]);
      let virtual: CSSStyleSheet[] = getSheets();
      Object.defineProperty(document, 'adoptedStyleSheets', {
        configurable: true,
        get: () => virtual,
        set: (next: CSSStyleSheet[]) => {
          const prev = virtual;
          const added = next.filter((s) => !prev.includes(s) && s !== channel);
          for (const sheet of added) {
            for (const rule of Array.from(sheet.cssRules)) {
              try {
                channel.insertRule(rule.cssText, channel.cssRules.length);
              } catch {
                /* rule types the channel rejects are skipped */
              }
            }
          }
          if (added.length) log('adopt:channeled', { sheets: added.length });
          const removed = prev.filter((s) => !next.includes(s) && s !== channel).length;
          if (removed) log('adopt:release-skipped', { sheets: removed });
          virtual = next.includes(channel) ? next : [...next, channel];
        },
      });
    } else {
      Object.defineProperty(document, 'adoptedStyleSheets', {
        configurable: true,
        get: () => getSheets(),
        set: (next: CSSStyleSheet[]) => {
          const prev = getSheets();
          const t0 = now();
          setSheets(next);
          log('adopt:set', {
            added: next.filter((s) => !prev.includes(s)).length,
            removed: prev.filter((s) => !next.includes(s)).length,
            selfMs: +(now() - t0).toFixed(2),
          });
        },
      });
    }
  }

  // --------------------------------------------------- <html> inline style writes
  const rootStyle = () => document.documentElement.style;
  const origSetProperty = CSSStyleDeclaration.prototype.setProperty;
  CSSStyleDeclaration.prototype.setProperty = function (prop, value, priority) {
    if (this === rootStyle()) {
      if (ablate.has('rootvars') && prop.startsWith('--')) {
        log('rootstyle:skipped', { prop });
        return;
      }
      if (ablate.has('userselect') && prop.includes('user-select')) {
        log('rootstyle:skipped', { prop });
        return;
      }
      log('rootstyle:set', { prop, value });
    }
    return origSetProperty.call(this, prop, value, priority);
  };
  const origRemoveProperty = CSSStyleDeclaration.prototype.removeProperty;
  CSSStyleDeclaration.prototype.removeProperty = function (prop) {
    if (this === rootStyle()) {
      if (
        (ablate.has('rootvars') && prop.startsWith('--')) ||
        (ablate.has('userselect') && prop.includes('user-select'))
      ) {
        log('rootstyle:remove-skipped', { prop });
        return '';
      }
      log('rootstyle:remove', { prop });
    }
    return origRemoveProperty.call(this, prop);
  };
  // Direct assignments (`html.style.userSelect = …`) go through prototype
  // accessors, not setProperty.
  const accessorAblations: ReadonlyArray<readonly [string, string]> = [
    ['userSelect', 'userselect'],
    ['webkitUserSelect', 'userselect'],
    ['overflow', 'scrolllock'],
  ];
  for (const [camel, flag] of accessorAblations) {
    const desc = Object.getOwnPropertyDescriptor(CSSStyleDeclaration.prototype, camel);
    if (!desc?.set || !desc.get) continue;
    Object.defineProperty(CSSStyleDeclaration.prototype, camel, {
      ...desc,
      set(this: CSSStyleDeclaration, value: string) {
        if (this === rootStyle()) {
          if (ablate.has(flag)) {
            log('rootstyle:skipped', { prop: camel });
            return;
          }
          log('rootstyle:set', { prop: camel, value });
        }
        desc.set!.call(this, value);
      },
    });
  }

  // --------------------------------------------------- <html> attribute flips
  const origSetAttribute = Element.prototype.setAttribute;
  Element.prototype.setAttribute = function (name: string, value: string) {
    if (this === document.documentElement && name.startsWith('data-ramka')) {
      if (ablate.has('isolation')) {
        log('rootattr:skipped', { name });
        return;
      }
      log('rootattr:set', { name, value });
    }
    return origSetAttribute.call(this, name, value);
  };
  const origRemoveAttribute = Element.prototype.removeAttribute;
  Element.prototype.removeAttribute = function (name: string) {
    if (this === document.documentElement && name.startsWith('data-ramka')) {
      if (ablate.has('isolation')) {
        log('rootattr:remove-skipped', { name });
        return;
      }
      log('rootattr:remove', { name });
    }
    return origRemoveAttribute.call(this, name);
  };

  // ------------------------------------------------------- slow forced reads
  const wrapLayoutGetter = (proto: object, name: string) => {
    const desc = Object.getOwnPropertyDescriptor(proto, name);
    if (!desc?.get) return;
    Object.defineProperty(proto, name, {
      ...desc,
      get(this: Element) {
        const t0 = now();
        const value = desc.get!.call(this);
        const ms = now() - t0;
        if (ms > 4) log('slowread', { name, ms: +ms.toFixed(1) });
        return value;
      },
    });
  };
  wrapLayoutGetter(HTMLElement.prototype, 'offsetWidth');
  wrapLayoutGetter(HTMLElement.prototype, 'offsetHeight');
  wrapLayoutGetter(HTMLElement.prototype, 'offsetLeft');
  const origGbcr = Element.prototype.getBoundingClientRect;
  Element.prototype.getBoundingClientRect = function () {
    const t0 = now();
    const rect = origGbcr.call(this);
    const ms = now() - t0;
    if (ms > 4) log('slowread', { name: 'getBoundingClientRect', ms: +ms.toFixed(1) });
    return rect;
  };

  // ---------------------------------------------------------------------- HUD
  const hud = document.createElement('pre');
  hud.setAttribute('data-perf-hud', '');
  hud.style.cssText =
    'position:fixed;left:8px;bottom:8px;z-index:2147483647;margin:0;padding:8px 10px;' +
    'background:rgba(0,0,0,.82);color:#7CFC9B;font:11px/1.5 ui-monospace,monospace;' +
    'border-radius:8px;pointer-events:none;white-space:pre;max-width:46ch;';
  hud.textContent = `perf-lab ready  ablate=[${[...ablate].join(',') || 'none'}]`;
  document.body.appendChild(hud);

  const fmt = (v: number | null) => (v === null ? '—' : `${v.toFixed(1)}ms`);
  function updateHud() {
    const c = lab.cycles[lab.cycles.length - 1];
    if (!c) return;
    hud.textContent = [
      `${c.kind.toUpperCase()} #${lab.cycles.length}  ablate=[${[...ablate].join(',') || 'none'}]`,
      `input→vt call   ${fmt(c.prepMs)}   (React commit + prep)`,
      `old snapshot    ${fmt(c.oldCaptureMs)}`,
      `update callback ${fmt(c.updateMs)}`,
      `new snapshot    ${fmt(c.newCaptureMs)}`,
      `input→READY     ${fmt(c.inputToReadyMs)}  ← perceived freeze`,
      `animation       ${fmt(c.animMs)}`,
      `max rAF gap     ${c.maxRafGapMs}ms   slow reads ${c.slowReadMs.toFixed(1)}ms`,
    ].join('\n');
  }
}
