# Lightbox performance investigation

Profiling of the `responsive-gallery` example, **production build** (`next start`,
`NEXT_DIST_DIR=.next-prod`), headless Chrome, images pre-warmed. Two methods:

- **Traces** — one open→close cycle recorded per CPU rate, categorised by
  main-thread self-time, forced-reflow attribution, and CPU-profile self-time
  (`/tmp/ramka-perf/deep-record.mjs` + `deep-analyze.mjs` + `forced.mjs`).
- **Stable bench** — `longtask` durations over N open/close cycles, since single
  traces have ±15 ms run-to-run noise (`/tmp/ramka-perf/bench.mjs`).

> Dev-build numbers are ~3–5× larger and dominated by React's `development.js`
> runtime; everything below is from a **production** build.

## Headline (stable, current build)

| CPU throttle | Longest task on open | Verdict |
| --- | --- | --- |
| **6×** (mid-tier mobile) | **< 50 ms** — doesn't even register as a `longtask` | smooth |
| **20×** (≈8-yr-old phone) | **~64 ms median** (54–77 ms, n=12) | one brief hitch |

Close never produces a single task > 50 ms at either rate (work is spread
across small tasks). **Important:** a genuinely low-end device
(`deviceMemory < 4 GiB` or `hardwareConcurrency < 4`) hits `isLowEndDevice()`
and **skips the View Transition** for the cheap fade path — so the 20×+VT
numbers above are a forced worst case that real low-end hardware won't take.

## Where the open time actually goes (20×, forced worst case)

Main-thread self-time during the open window (~144–150 ms total across the
whole ~125 ms blocking task + tail):

| Category | ms | Notes |
| --- | --- | --- |
| **Script** (React) | ~55 | Reconciling + committing the viewer subtree, running the lightbox effects/gesture-hook setup. |
| **RecalcStyle** | ~50 | Style for the newly-mounted subtree (~140 elements). Forced synchronously by a layout read during the commit. |
| Paint | ~25 | Full-viewport backdrop + image at DPR 2. |
| Layout | ~6–12 | Slide geometry + (previously) focus scroll-into-view. |
| Composite | ~9 | |

The two dominant buckets — **React reconciliation and style recalc of the
mounted subtree — are largely inherent to mounting the viewer** and cannot be
micro-optimised away without a structural change (see "What would move the
needle further"). The profiler-attributed hot leaf was `get clientWidth`
(~46 ms @20×): a single layout read that forces a whole-page style+layout flush
because it runs *inside React's `flushSync`* while the just-mounted DOM is dirty.

## Hypotheses tested and **rejected**

- **`:root[data-lightbox-view-transition] * { view-transition-name: none }` is
  the amplifier.** A/B (deleting the rule at runtime, `ab-record.mjs`) showed
  **no difference** (RecalcStyle 44 ms → 50 ms, i.e. noise). The universal
  selector is *not* the cost; recalc is just proportional to the ~140 mounted
  elements. Rule kept as-is.
- **Double `measureGeometry` / ResizeObserver initial callback dominates.**
  Real, but small — removing the redundant re-center (F1) trimmed forced Layout
  a few ms, not the headline.

## Fixes applied (correct forced-reflow hygiene; all 240 tests green)

- [x] **F1 — skip the ResizeObserver's redundant initial re-center**
  (`lightbox-slides.tsx`). The observer's first callback re-measured identical
  geometry and issued a scroll write *during the open commit* (dirtying layout
  for the next read). Now it only re-centers when geometry actually changed.
- [x] **F2 — batch the morph's `getComputedStyle` reads**
  (`use-view-transition-morph.ts`). Read the trigger's `border-radius` *before*
  any writes (clean style, no forced reflow) and the item's radius once right
  after the prepare-mount, so the `startViewTransition` callback is now
  **pure writes** — no layout read forcing a reflow inside the VT callback.
- [x] **F4 — `focus({ preventScroll: true })` on reveal**
  (`lightbox-content.tsx`). The content is `position: fixed` covering the
  viewport, so the default `focus()` "scroll into view" pass was pure waste —
  a forced whole-page layout in the reveal commit (~6 ms @6× / ~14 ms @20×).
  `preventScroll` removes it with zero behavioural change. `focus` dropped off
  the CPU-profile hot list and Layout self-time roughly halved (12 → 6 ms @20×).

Net: the fixes remove three specific forced reflows from the open commit. They
don't shrink the 20× headline much because that number is gated by React
reconciliation + style recalc (see above), but they are unambiguous wins under
the profiler and eliminate avoidable synchronous layout.

## What would move the needle further (not done — higher risk)

The only way to materially cut the 20× worst case is to **shrink the synchronous
open commit** so React reconciles + styles fewer nodes in one blocking task:

1. **Defer non-critical subtrees.** Mount only the backdrop + active slide +
   close button synchronously; mount the thumbnail strip and non-active slides
   after the transition (`startTransition` / a post-open state). Biggest payoff
   on galleries with many thumbnails/slides; small on `responsive-gallery`
   (posts have ≤4 images).
2. **`content-visibility: auto` + `contain-intrinsic-size`** on off-screen
   slides and off-screen thumbnails, so their style/layout/paint is skipped
   until scrolled into view.
3. **Lighter zoom/gesture setup.** Each `Lightbox.Zoom` measures via
   `getBoundingClientRect` on mount; that work could be deferred until the first
   zoom interaction.

These are structural and touch the primitive's mount path, so they warrant
their own change + test pass rather than being folded into this hygiene pass.
