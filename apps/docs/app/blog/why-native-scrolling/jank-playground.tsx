'use client';

import { useEffect, useRef, useState } from 'react';

import { NativeStrip, StripLabel, TransformStrip } from './demo-shared';

const LEVELS = [
  { label: 'Idle', ms: 0 },
  { label: 'Busy', ms: 50 },
  { label: 'Slammed', ms: 140 },
] as const;

/**
 * Demo 1: the same image strip twice. The top one is a real scroller, the
 * bottom one a well-built transform carousel. The segmented control runs
 * synthetic long tasks on the main thread (what image decode, hydration, or
 * an analytics script do for free), and the difference stops being abstract.
 */
export function JankPlayground() {
  const [level, setLevel] = useState(0);
  const [inView, setInView] = useState(false);
  const rootRef = useRef<HTMLElement>(null);
  const heartbeatRef = useRef<HTMLDivElement>(null);
  const worstRef = useRef<HTMLSpanElement>(null);

  // The synthetic load must not outlive the demo: leaving Slammed on and
  // scrolling away would jank the rest of the article, which stops being a
  // demo and starts being a bug. The selected level is kept, the interval is
  // paused, and it resumes when the reader scrolls back.
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const observer = new IntersectionObserver(([entry]) => setInView(entry?.isIntersecting ?? false));
    observer.observe(root);
    return () => observer.disconnect();
  }, []);

  // Synthetic long tasks: busy-wait `ms` every 180ms, like a page doing real
  // work in bursts. Zero means the interval is off entirely.
  useEffect(() => {
    const ms = LEVELS[level]?.ms ?? 0;
    if (ms === 0 || !inView) return;
    const id = window.setInterval(() => {
      const end = performance.now() + ms;
      while (performance.now() < end) {
        // burn
      }
    }, 180);
    return () => window.clearInterval(id);
  }, [level, inView]);

  // The main-thread heartbeat: a dot moved from a 10ms timer chain, plus a
  // worst-stall readout (how late a tick fired beyond its 10ms cadence).
  //
  // Deliberately NOT requestAnimationFrame: rAF tracks main-thread frame
  // production, and during a composited native scroll Chrome skips main
  // frames it doesn't need, so an rAF meter reads "janky" while the scroll is
  // butter. Worse, the transform strip's own rAF loop forces the main thread
  // awake every frame, making the emulated scroll look artificially healthy.
  // Timers keep their cadence through composited scrolls and stall only when
  // the thread is genuinely blocked, which is the thing being demonstrated.
  //
  // Paused offscreen along with the load; the effect re-runs on re-entry, so
  // its clocks start fresh and the pause can't register as one giant stall.
  useEffect(() => {
    if (!inView) return;
    const TICK_MS = 10;
    let last = performance.now();
    let worst = 0;
    let windowStart = last;

    const id = window.setInterval(() => {
      const now = performance.now();
      worst = Math.max(worst, now - last - TICK_MS);
      last = now;
      // Roll the window once a second: readout and color update together, so
      // the dot holds a steady verdict instead of strobing with each burst.
      if (now - windowStart > 1000) {
        // Near-zero when healthy, roughly the busy-wait length when loaded.
        const verdict = worst < 30 ? '#10b981' : worst < 110 ? '#f59e0b' : '#ef4444';
        if (worstRef.current) {
          worstRef.current.textContent = `${Math.max(0, Math.round(worst))} ms`;
          worstRef.current.style.color = verdict;
        }
        if (heartbeatRef.current) heartbeatRef.current.style.backgroundColor = verdict;
        worst = 0;
        windowStart = now;
      }
      if (heartbeatRef.current) {
        // Triangle wave: ping-pong across the track every 1.2s. The browser
        // paints the latest write each vsync, so this is smooth at any hz.
        const t = (now / 1200) % 2;
        const x = (t < 1 ? t : 2 - t) * 100;
        heartbeatRef.current.style.transform = `translateX(${x}px)`;
      }
    }, TICK_MS);
    return () => window.clearInterval(id);
  }, [inView]);

  return (
    <figure
      ref={rootRef}
      className="my-8 rounded-2xl border border-neutral-200 p-4 md:p-5 dark:border-neutral-800"
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
        <div className="flex items-center gap-2" role="group" aria-label="Main thread load">
          {LEVELS.map((option, i) => (
            <button
              key={option.label}
              type="button"
              onClick={() => setLevel(i)}
              aria-pressed={level === i}
              className={`h-8 rounded-full px-3.5 text-[13px] font-medium transition ${
                level === i
                  ? 'bg-neutral-900 text-white dark:bg-neutral-50 dark:text-neutral-900'
                  : 'border border-neutral-200 text-neutral-600 hover:bg-neutral-100 dark:border-neutral-800 dark:text-neutral-400 dark:hover:bg-neutral-900'
              }`}
            >
              {option.label}
              {option.ms > 0 ? <span className="ml-1 opacity-60">{option.ms}ms</span> : null}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3 text-[12px] text-neutral-500 dark:text-neutral-400">
          <span className="flex items-center gap-2">
            main thread
            <span className="relative inline-block h-2 w-28 overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-900">
              <div
                ref={heartbeatRef}
                className="absolute top-0 left-0 h-2 w-3 rounded-full bg-emerald-500 transition-colors duration-200"
              />
            </span>
          </span>
          <span className="tabular-nums">
            worst stall: <span ref={worstRef}>0 ms</span>
          </span>
        </div>
      </div>

      <StripLabel>Native scroll — swipe or scroll it</StripLabel>
      <NativeStrip ariaLabel="Native scrolling image strip" />

      <div className="mt-5">
        <StripLabel>Transform carousel — drag or swipe it</StripLabel>
        <TransformStrip ariaLabel="JavaScript transform image strip" />
      </div>

      <figcaption className="mt-4 text-[13px] leading-6 text-neutral-500 dark:text-neutral-400">
        Both strips are identical DOM. Set the load to Slammed, then flick each one. The native strip keeps
        scrolling because the browser scrolls it off the main thread. The transform carousel is driven by pointer
        events and requestAnimationFrame, so it freezes with everything else.
      </figcaption>
    </figure>
  );
}
