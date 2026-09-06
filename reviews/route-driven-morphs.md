# Design sketch: route-driven morphs (backlog)

Context: the intercepted-routes example (added on `next-js-dynamic-routes`)
opens the viewer via a Next.js router navigation, so the open never flows
through `Lightbox.Trigger`'s gesture path and the viewer fades in instead of
morphing from the clicked tile. This note captures why that is and the
feature shape that could lift the limitation. Not scheduled — sharp edges
below.

## Why there is no morph today

1. `document.startViewTransition()` must wrap the exact DOM mutation. In the
   intercepted pattern the mutation is a Next.js navigation commit (async RSC
   fetch + React commit) that the library neither performs nor observes at
   the right moment.
2. The morph engine lives in `Lightbox.Root`, which mounts *as a result of*
   the navigation — it is born after the "before" snapshot moment.
3. Plain `<Link>` tiles record no origin element. (Solvable today:
   `Trigger render={<Link/>}` + a detached-trigger handle captures the
   clicked element and image at click time.)

## The feature shape

The handle (imperative API) is the only ramka object alive on both sides of
the navigation, so it is the natural owner:

```tsx
handle.openViaNavigation(index, {
  origin: tileImageElement,          // or resolved from a registered detached Trigger
  navigate: () => router.push(url),  // wrapped in the view transition
});
```

Flow: handle captures + tags the origin → `startViewTransition` → update
callback runs `navigate()` and awaits a pending promise → **the Root that
adopts this handle resolves the promise from its mount layout effect** (the
Root itself is the commit signal — no Next.js API needed) → engine tags the
destination media → browser captures "after" → morph runs.

Key insight: the VT update callback may be async, and the thing that mounts
is our own component, so we never need Next to expose the router commit.
This works without `experimental.viewTransition`.

## Known sharp edges (why this is a feature, not a patch)

- Frozen-page window: the browser shows a static screenshot between
  captures; that window now contains an RSC fetch. Prefetched Links keep it
  short; cold fetches need a "took too long, degrade to fade" path that
  doesn't strand engine state (VT timeout ~4s).
- Aborts/interleaving: second tile clicked mid-flight, Back pressed during
  the transition. Existing popstate + scroll-restoration-mid-VT and Android
  Blink abort handling all assume the engine owns a transition inside one
  mounted Root; this transition starts ownerless.
- Close direction (viewer → tile on `router.back()`): same machinery
  mirrored, but close is where the hardest VT bugs have lived.
- Degradation matrix: Firefox / reduced motion / low-end fallback must land
  on the existing fade cleanly when the deferred VT cannot run.

## Docs stance until then

The intercepted-routes example states "no trigger morph in this pattern" as
current fact; the URL-synced state example is the pattern that keeps morphs.
