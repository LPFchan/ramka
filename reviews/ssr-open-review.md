# SSR / default-open review — branch `next-js-dynamic-routes`

> Two independent audits (2026-09-05) of `git diff main...HEAD`, briefed for a zero-tolerance bar on correctness, performance, and reliability.
>
> **Combined verdict: approve with follow-ups.** No Critical findings. Library: 1 High, 3 Medium, 4 Low, 4 Nit. Docs demo: 2 Medium, 3 Low, 4 Nit. Both reviewers verified claims empirically (React 18.3.1 behavior, SSR curl output, production build, full test suite) rather than only reading the diff. Improvement proposals for making SSR/default-open first-class are at the end of each part.


# Part 1 — Library (`packages/ramka`)

## Verdict summary

**Approve with required follow-ups.** The core mechanics of this branch are sound and carefully reasoned: the React 18 vs 19 claims in the code comments are accurate (I verified them empirically against react-dom 18.3.1 — in-place rendering, no dev warnings, removal on unmount, no dedupe), the `typeof window === 'undefined'` attribute stamp is hydration-safe in both React versions, the scroll-trigger ref refactor genuinely fixes the reported bug without introducing races, and the VT open/close morph timing is unaffected because `data-morph-target` only flips inside the morph's commit callbacks (`commitReveal`/`commitClose`), after old-snapshot capture. All 796 tests pass; typecheck is clean.

The blocking concern is not a bug in the new code but an **unflagged behavior change for existing consumers**: moving the morph-target hide rule out of the lazily-loaded VT sheet into an eager, every-page delivery means consumers on the non-VT path (`viewTransition={false}`, browsers without View Transitions, low-end devices) now get their active trigger hidden at `opacity: 0` while the lightbox is open — behavior they never had. With a semi-transparent backdrop this is plainly visible. It may well be the intended unification, but it must be an explicit, documented decision, not a side effect.

Findings: 0 Critical, 1 High, 3 Medium, 4 Low, 4 Nit.

---

## Findings

### High

#### H1. Eager morph-target hide silently changes rendering for all non-VT consumers

**Files:** `packages/ramka/src/lightbox/morph-target-hide.ts:34-40`, `packages/ramka/src/lightbox/lightbox-trigger.tsx:464-466` (insertion effect) and `:551-553` (hoistable), `packages/ramka/src/lightbox/lightbox-root.tsx:877`.

**Evidence.** Trigger's `data-morph-target` sync has never been gated on `viewTransition` — the layout effect at `lightbox-trigger.tsx:470-481` stamps the attribute on the resolved morph element whenever `morphTarget` is true, on every path. Before this branch that was inert on the non-VT path, because the only CSS matching `[data-morph-target]` lived in the VT structural sheet, injected exclusively from `startMorph` (`lightbox-root.tsx:943`), which is only reachable when

```877:877:packages/ramka/src/lightbox/lightbox-root.tsx
        const useVT = viewTransition && supportsViewTransitions() && !isLowEndDevice();
```

is true. Now every mounted Trigger delivers `[data-morph-target]{opacity:0;transition:opacity 200ms …}` eagerly — via the hoistable `<style>` on the server and `ensureLibrarySheet` in a client insertion effect. Consequences for consumers who changed nothing:

- `viewTransition={false}` consumers, **all** consumers on browsers without `startViewTransition`, and **all** consumers on `isLowEndDevice()` hardware now have the active trigger at `opacity: 0` while the viewer is open. Behind a semi-transparent backdrop (a very common skin) the active tile visibly vanishes from the grid — a hole where a photo used to be, and a cross-browser rendering inconsistency (Chrome with VT: hidden by design during morph; older Firefox: newly hidden with no morph in sight).
- On the non-VT open, the trigger now fades out over 200ms (the `:root[data-ramka-view-transition]` transition-kill never applies — that attribute is only set during a VT), and on non-VT close it snaps back when the attribute is removed. New motion that no one opted into.

I verified the VT path itself is *not* affected: `setOpen(true)` on the VT path defers the `open` state flip to `commitReveal`, which runs inside the `startViewTransition` callback after old capture, so the eager rule cannot blank the trigger in the morph's source snapshot — including the cold-chunk case where `loadMorphRuntime()` takes hundreds of ms, because the attribute isn't stamped until the runtime has loaded and revealed.

**Suggested fix.** Decide explicitly. The hide is *required* on the SSR-open path regardless of `viewTransition`, so gating delivery is not an option; and hiding the "moved into the viewer" tile is arguably more correct everywhere. If that's the position: (a) call it out prominently in the changelog as a visual behavior change for non-VT consumers, (b) document the escape hatch (a higher-specificity consumer rule or `!important` re-show — note the CSSOM copy is an adopted sheet that sorts after all document stylesheets, so specificity, not order, is the lever), and (c) add a test pinning that the rule applies with `viewTransition={false}` so the behavior is now contractual rather than accidental. If it's *not* the position, the attribute stamp itself needs the VT gate, plus an SSR carve-out — considerably messier; I'd take option one.

### Medium

#### M1. React 18: one inline `<style>` per Trigger/Media instance — no dedupe

**Files:** `packages/ramka/src/lightbox/lightbox-trigger.tsx:551-553`, `packages/ramka/src/lightbox/lightbox-media.tsx:331-333`.

**Evidence.** Verified empirically against react-dom 18.3.1: `<style href precedence>` renders in place with the attributes passed through, no dev warning, no dedupe — three sibling instances produce three `<style>` elements in the body, removed on unmount. The peer dependency is `react >= 18` (`packages/ramka/package.json:52-54`), and the library is pitched at production galleries. A 200-tile grid on React 18 therefore ships ~200 copies of the morph-target-hide tag: ≈45 KB of extra server HTML and 200 live stylesheet elements the browser must register (each identical). Media adds a copy per mounted slide (bounded by the preload window, so minor). Two secondary effects, React 18 only:

- The `<style>` is a rendered sibling *preceding* the trigger button / media div, so consumer structural selectors around them (`:nth-child`, `:first-child`, `grid > *` with `:nth-child(2n)` striping) silently shift by one. `display: none` keeps it out of layout, but not out of the child list.
- The devDependency matrix tests only React 19 (`react: ^19.2.8`), so none of the React 18 claims in the comments are exercised by CI.

**Suggested fix.** Cheapest: gate the hoistable on `parseInt(React.version, 10) >= 19` — the gate is version-stable so server and client agree, making it hydration-safe; React 18 falls back to exactly the pre-branch behavior (CSSOM only, one unstyled server paint), which is what React 18 consumers had last release anyway. If SSR-open on React 18 must keep working, instead export a tiny `<Lightbox.CriticalStyles />` (see proposal P5) that React 18 SSR users render once in `<head>`, and still gate the per-instance tag. Either way, add a React 18 leg to CI or at least a smoke test.

#### M2. SSR stamp never fires for `morphTo="closest"` / `"origin"` — the fixed bug survives for non-default configs

**File:** `packages/ramka/src/lightbox/lightbox-trigger.tsx:436-456` (morphTarget memo) and `:527-529` (stamp).

**Evidence.** The stamp is `morphTarget && typeof window === 'undefined'`. During server rendering, `morphTarget` can only be true for `morphTo="active"`: the `"origin"` branch compares against `openingTriggerIndexRef.current` (no trigger was ever clicked on the server), and the `"closest"` branch walks `triggerElementsRef.current` — a ref map that is necessarily empty during SSR (refs don't attach server-side), so the loop yields `best = -1` and every trigger returns false. Result: a page that server-renders an open lightbox with `morphTo="closest"` (or `"origin"`) paints the active trigger fully visible until hydration — precisely the flash this branch exists to eliminate, just behind a non-default prop. `lightbox-trigger-ssr.test.tsx` only covers the default.

**Suggested fix.** On the server, stamp based on `active` (`open && activeIndex === index`) rather than the client-resolved `morphTarget`. For `"closest"` this is exactly right whenever the active-index trigger is rendered at all (the client resolver returns `activeIndex === index` when that trigger is registered, which it will be after hydration of the same markup). For `"origin"` there is no origin on a deep-link visit, and the client resolves to no hidden trigger — so either keep `"origin"` unstamped for symmetry, or accept a one-commit hide-then-reveal (the existing `else` branch of `syncMorphTargetAttribute` at `:359-363` already clears it on hydration). Add SSR test cases for both modes.

#### M3. Strict-CSP consumers now generate guaranteed CSP violation reports

**Files:** `packages/ramka/src/lightbox/lightbox-trigger.tsx:551-553`, `packages/ramka/src/lightbox/lightbox-media.tsx:331-333`.

**Evidence.** The library's documented CSP story was "CSSOM only — `style-src` never sees us" (`lightbox-style-sheets.ts` header). This branch renders inline `<style>` tags unconditionally. Under `style-src 'self'` they are refused — visually graceful exactly as claimed, since the CSSOM copies carry the load — but every refusal is a console error and, where `report-uri`/`report-to` is configured, a violation report. On React 18 that's one report *per instance, per pageview*. For the security-pipeline-having consumers this library courts, a permanent stream of self-inflicted CSP reports is an operational regression, and there is no nonce path (consumers can't inject a nonce into library-rendered tags).

**Suggested fix.** Document it, and turn the constant rule text into a feature: both payloads are now byte-stable per release, so publish their `sha256-…` hashes in the changelog/docs so strict-CSP consumers can hash-allowlist them — which also *restores the correct SSR first paint under strict CSP*, something the CSSOM path can never do. Combined with the M1 version gate, React 18 CSP noise disappears entirely.

### Low

#### L1. Render-phase ref write for the scroll-trigger config

**File:** `packages/ramka/src/lightbox/lightbox-root.tsx:424-425`.

```424:425:packages/ramka/src/lightbox/lightbox-root.tsx
    const scrollTriggerIntoViewRef = React.useRef(scrollTriggerIntoView);
    scrollTriggerIntoViewRef.current = scrollTriggerIntoView;
```

Writing a ref during render violates render purity: with concurrent rendering, a render that never commits (interrupted transition) still overwrites the ref, so the 120ms timer can fire reading a config no committed render ever produced. Practical blast radius is tiny (worst case the scroll uses `behavior`/`block` values from an about-to-commit render), and the file already contains the same pattern at `morphConfigRef` (`:817-841`), so this follows local precedent — but the *established* pattern for exactly this shape in the same component is effect-based assignment (`onOpenChangeRef`, `onValueChangeRef`, `:340-371`), and the React Compiler / `react-hooks` v6 lint will flag the render write. Assigning in a `useEffect` declared *before* the scroll effect preserves the fix identically (effects run in declaration order, and the fire-time read happens 120ms after any commit). Otherwise the refactor is correct: I traced schedule-time vs fire-time reads against enable/disable/value-change mid-debounce and every case matches or improves on the old observable behavior; the remaining deps `[morphTo, open, activeIndex]` cover every state edge the old code reacted to (config-identity re-runs were pure no-ops-plus-timer-cancellation — the bug).

#### L2. `data-positioned` is set even when positioning bailed

**File:** `packages/ramka/src/lightbox/lightbox-thumbnail-strip.tsx:387-397`.

`setPositioned(true)` runs unconditionally after `attach()`, but `attach()`/`refresh()` early-return when the track, strip root, or Slides viewport isn't registered yet (`:340-343`, `:370-373`). The comment argues re-runs cover this via `trackVersion`, which is true for the track — but a *late-registering Slides viewport* re-enters through `subscribeSlidesViewport` (`:398`), which does not re-run the effect, and by then `positioned` already told consumer CSS to reveal a track sitting at offset 0 — the exact snap the attribute documents itself as preventing (`lightbox-data-attributes.ts:167-175`). Narrow in practice (in-place SSR portals and normal opens mount strip and slides in one commit; only async-resolving custom `container` refs are exposed), but the attribute overpromises. Suggested fix: have `refresh` report success and only flip `positioned` on the first successful positioning; also assert the attribute's *absence* in a `renderToString` test — the SSR half of its contract is currently untested (`lightbox-thumbnail-strip.test.tsx:302-308` only checks presence).

#### L3. Stale "lazy chunk" comments now describe the opposite of reality

**Files:** `packages/ramka/src/lightbox/vt-style-sheets.ts:3-5`, `packages/ramka/src/lightbox/lightbox-style-sheets.ts:81-83`.

Both modules still claim `ensureLibrarySheet` "stays in the lazy morph chunk instead of riding along in the eager bundle." Trigger now imports it eagerly (`lightbox-trigger.tsx:23`), so the once-only machinery ships in the eager path on every page with a trigger. The actual byte cost is trivial (~40 lines, and its transitive imports were already eager via Media), so this is a documentation bug, not a size bug — but these comments are load-bearing for future bundling decisions and now actively mislead. Update both.

#### L4. Pre-hydration cascade position of the hoistables differs from the adopted-sheet position

**Files:** `packages/ramka/src/lightbox/lightbox-media.tsx:331`, `packages/ramka/src/lightbox/lightbox-trigger.tsx:551`.

The old delivery (adopted sheet) sorts after every document stylesheet, winning equal-specificity ties against consumer CSS. The hoistable copy sits in `<head>` among ordinary stylesheets, so during the pre-hydration window a later consumer rule of equal specificity can win a tie the library used to win. For the media fill this is theoretical — `(1,2,1)` specificity is effectively untieable. For `[data-morph-target]` at `(0,1,0)`, a consumer `.tile { opacity: … }` tie resolves by order; note however that any `(0,2,0)` consumer rule (e.g. `.grid .tile`) beat the adopted copy *before this branch too*, so only exact-tie cases shift, and only until the insertion effect lands. Not worth code changes; worth one sentence in the styling docs ("the hide rule is single-attribute specificity; keep resting-opacity rules off morph targets or scope an override deliberately").

### Nit

- **N1.** `vt-structural-styles.ts:6` — `LightboxTriggerDataAttributes` import is now unused (its last use left with the extracted rule). `tsc --noEmit` (the entire lint setup) doesn't flag unused imports, so it will sit there. Remove it, and consider `noUnusedLocals` or ESLint since `lint: tsc --noEmit` catches very little.
- **N2.** `:not(#_)` (`lightbox-media.tsx:84`) — an element with literal `id="_"` as the Media host would silently lose the fill rules, and the rewrite bumps specificity from `(1,1,1)` to `(1,2,1)`. Both are cascade trivia in practice; a code comment already justifies the hack well. Maybe pick a marginally more collision-proof sentinel (`#\\.` or `#ramka-never`).
- **N3.** `vt-structural-styles.test.tsx:55-58` asserts `not.toContain('[data-morph-target] {')` — coupled to the old formatting (space before brace); a reintroduction written as `[data-morph-target]{` passes. Assert on `LightboxTriggerDataAttributes.morphTarget` + `opacity` co-occurrence instead.
- **N4.** Test coverage gaps around the new delivery: nothing pins React 19 dedupe (two Media instances → exactly one hoisted tag), and there is no hydration test (`hydrateRoot` over `renderToString` output of an SSR-open tree asserting no `console.error`) — the strongest possible regression guard for the `typeof window` stamp, and cheap to add in jsdom by stripping the gate's node-env dependency (render server HTML in node, hydrate in jsdom, or simply mock).

### Explicitly verified non-findings (adversarial checks that came back clean)

- **Hydration safety of the SSR-only attribute stamp:** server-extra attributes not rendered by the client are neither diffed, warned about, nor removed during hydration in React 18 or 19 (React only compares props the client renders); the attribute persists until the hydration layout effect re-syncs, which is the design. The new clearing line at `lightbox-trigger.tsx:352-354` correctly handles the one genuinely stale case (consumer `morphRef` node ≠ trigger root), is a no-op otherwise, and cannot cross-talk between triggers (each sync touches only its own root). Strict-mode double effects, multiple triggers per index (all stamped server-side, all re-stamped client-side — consistent with pre-existing client behavior), detached-handle triggers, `keepMounted`, and controlled-value-drift-across-hydration (attribute removed by the `else` branch) all resolve correctly.
- **Hoistable accumulation:** React 19 never removes precedence styles, but constant `href` + constant text caps the document at one tag per rule forever, across any number of mount/unmount cycles. The old per-`useId` rule text would indeed have leaked one dead tag per viewer open — the constant-text design is the correct call, and the comments explaining it are accurate.
- **Morph snapshot integrity:** eager hide CSS cannot blank the open morph's source snapshot even on a cold, slow chunk load, because `open` (hence the attribute) only commits inside the VT callback after old capture (`commitReveal`, `lightbox-root.tsx:757-767`).
- **Memory:** Media's insertion effect releases its sheet per unmount ([] deps are correct now that the text is constant); the morph-target-hide sheet is deliberately document-lifetime (same as its old home); no new observers; strip cleanup remains thorough.
- **The debounce regression test** (`lightbox.test.tsx:7941+`) genuinely pins the bug: under the old code the echo re-render's cleanup cancels the timer and the same-index early return never reschedules, so `scrollIntoView` is never called and the test fails.

---

## SSR / default-open improvement proposals

What consumers hand-roll today (per `moodboard-demo.tsx` + `ssr-slide-shift.css`): decide-once `container={null}`, a transform-based initial-scroll stand-in with hand-computed gap math, first-paint transition suppression with a double-rAF removal, and hide-until-`data-positioned` strip CSS. Ranked by value-for-risk:

### P1. `Lightbox.Portal ssr` mode with library-owned first-paint transition suppression — do it

**Idea.** When Portal renders in place and the lightbox is open during server rendering, the library stamps `data-ramka-ssr` on the Portal host (same server-only-prop pattern this branch just proved out for `data-morph-target`), ships a constant rule `[data-ramka-ssr] *, [data-ramka-ssr] *::before, [data-ramka-ssr] *::after { transition: none !important; animation: none !important }` via the established dual-path delivery, and removes the attribute in a double-rAF effect after hydration — verbatim the demo's proven lifecycle, including its subtle insight that a layout-effect removal would restart the very fades being suppressed.

**API sketch.** Automatic (no prop): stamp whenever `typeof window === 'undefined' && open && container === null`. Client renders never emit it; hydration preserves it; the effect clears it. Consumers who want the fade-in anyway remove one attribute's worth of behavior with a documented opt-out prop (`ssrTransitions="run"`).

**Risks.** `!important` suppression flattens consumer transitions inside the viewer for two frames — that is the point, but document it. WAAPI animations (the library's own scrub/morph machinery) are unaffected by the CSS `animation` property. Double-rAF timing is empirical but demo-proven.

**Worth it?** Yes — highest value, lowest novelty. Every SSR-open consumer needs this, the failure mode without it (viewer fades itself in on a refresh) looks broken, and the library already owns every technique involved.

### P2. Library-owned initial-scroll serialization (the translate trick, generalized) — do it, with a documented constraint

**Idea.** Slides knows `activeIndex` at SSR time. Stamp a server-only attribute (or CSS var) on the Slides host and ship a constant rule translating every slide by `calc(var(--ramka-ssr-index) * (-100% - var(--ramka-slide-gap, 0px)))`. The library's existing hydration layout effect already reads `scrollLeft: 0`, derives index-0-≠-active, and jumps the scroller — the demo showed the parent-effect ordering makes the swap single-paint. Bringing it in-library means the *library's own* effect can drop the transform in the same commit it performs the jump: strictly more reliable than the consumer's parent-effect ordering, because it's one owner instead of a choreography.

**API sketch.** `<Lightbox.Slides ssrInitialScroll>` (opt-in), documented constraint: every slide must be exactly one scrollport wide (the bleed layout — `flex: 0 0 100%`), gap declared via `--ramka-slide-gap` since a server cannot measure. RTL flips the sign off the existing direction context. Constraint violated → slides paint offset, hydration jump fixes it — i.e., degrade to today's baseline, never worse.

**Progressive enhancement:** additionally stamp `data-ramka-ssr-active` on the active slide server-side and ship `[data-ramka-ssr-active] { scroll-initial-target: nearest }` — in engines that support `scroll-initial-target` the browser sets a *real* initial scroll offset before first paint, which works for arbitrary per-slide widths (snug layouts) with no math, and the library's scroll-sync then sees a correct `scrollLeft` and no-ops. Chromium-only today, but it's free to ship alongside the transform and it's the correct long-term primitive.

**Risks.** Percentage translate resolves against each slide's own width — the equal-width constraint is real and must be loud in docs. Interaction with the transform-based thumbnail track is nil (different elements). Snap points don't fire on transforms — irrelevant pre-hydration since there's no interaction yet.

**Worth it?** Yes. This is the gnarliest piece consumers currently copy-paste (gap math, media queries, RTL), and the library owning it removes the demo's most fragile CSS file.

### P3. First-class "URL-controlled" documentation + decide-once container guard — do the guard, keep the wiring consumer-land

The history semantics (push on open, replace on navigate, *never* `history.back()` inside a VT commit) are app decisions the library should document, not own — the demo's comments are already the best documentation of the pitfalls and should graduate into a docs guide. One thing the library *should* own: a dev-mode warning when `Portal container` identity changes while open (it reparents and remounts a live viewer — the reason the demo freezes `deepLinkVisit` in `useState`). Trivial to add, prevents the worst footgun of the pattern.

### P4. SSR-safe thumbnail strip — keep as-is (attribute + docs), don't ship default hiding

The library could ship `[data-ramka-thumbnail-strip]:not([data-positioned]) { visibility: hidden }`, but that forces a policy: on slow connections the strip stays invisible until hydration even though server HTML could show thumbnails (at offset 0). Hide-vs-show-mispositioned is a skin decision; a headless library exposing the `data-positioned` hook (this branch) plus a documented one-liner is the right ownership boundary. Serializing the track transform server-side is not feasible — it depends on measured thumb widths. If P2's `scroll-initial-target` path matures, revisit: the strip's scroller could adopt the same attribute.

### P5. `<Lightbox.CriticalStyles />` — small, solves two findings at once

A component rendering all constant library rules (media fill, morph-target hide, and the P1/P2 rules if adopted) as one tag, for consumers to place in `<head>`. On React 19 it's redundant (hoistables dedupe); on React 18 it enables gating the per-instance tags (M1) while keeping SSR-open first paint working; and it gives strict-CSP consumers a single element to attach their nonce to (M3), which the per-instance hoistables can never accept from consumer land. Cheap to build, easy to document, no behavior when omitted. Recommended alongside the M1 fix.

### P6. A blessed `ssr` example harness — documentation, not API

The moodboard demo is effectively the reference implementation. Once P1/P2 land, shrink it to: `container={null}` decided once, `ssrInitialScroll`, done — and publish the before/after as the SSR guide. What should *stay* consumer-land, stated honestly: URL state wiring, metadata/head management, backdrop and chrome skinning, and the choice of which routes deep-link at all.


# Part 2 — Docs demo & integration (`apps/docs`)

## Verdict summary — docs app (`apps/docs/`), branch `next-js-dynamic-routes`

**Verdict: approve with minor fixes.** No Critical or High findings. The core pattern — controlled `Lightbox.Root` synced to the URL via `usePathname` + native History API, deep links server-rendered open via `container={null}`, the `ssrSlideShift` transform stand-in, and the double-rAF `ssrNoTransitions` removal — is correct, and every load-bearing claim in the extensive comments checked out against the actual library code, real SSR output, and a production build. Findings: **2 Medium** (per-photo OpenGraph metadata is missing so social shares of "shareable photo URLs" render a generic site card; the generated llms example doc omits the load-bearing CSS, so the copied pattern silently degrades), **3 Low**, **4 Nit**.

What was verified (not just read):

- **Typecheck**: `pnpm --filter docs typecheck` passes. **llms consistency**: `docs:llms:check` passes ("23 LLM doc file(s) up to date"), and `public/examples/lightbox/moodboard.md` correctly embeds `[[...id]]/page.tsx`, `moodboard-demo.tsx`, and `photos.ts` via the new `pagePath`/`extraSources` mechanism. The `path.join` through the bracketed `[[...id]]` segment resolves correctly.
- **Production build** (`next build`): succeeds; the route builds as SSG with 13 prerendered paths (grid + 12 photos). The prerendered grid HTML is the real grid (h1 "Moodboard", 12 triggers, no dialog, no shift class) — confirming Next 15.5.18 normalizes the `{ id: [] }` static param to `id: undefined` at prerender time, so the `notFound()` guard does not misfire on the grid (see Nit N1 for the latent fragility).
- **SSR output** (curl against dev): `/examples/lightbox/moodboard/mb-05` serves the viewer open in server HTML — `role="dialog"`, `aria-modal="true"`, `relative z-50`, `lightbox-demo-ssr-slide-shift` + `lightbox-demo-ssr-no-transitions` on the Portal host, `--lightbox-demo-ssr-index:4`, 12 slides with exactly the 7 items inside the `preload=3` window rendered, thumbnail strip present **without** `data-positioned`, per-photo `<title>Dunes — Moodboard example</title>`. Unknown id → 404; extra segment → 404; malformed percent-encoding (`/%E0`) → 400 **before** rendering, so the client `decodeURIComponent` cannot receive malformed input via navigation; percent-encoded valid id (`/mb%2D05`) → 200 with the correct shift index (server and client decode identically, no mismatch).
- **Library dependencies of the demo** (all confirmed in `packages/ramka` source): `Portal` `container={null}` renders in place and its target resolution is SSR-deterministic (`lightbox-portal.tsx:58-67,140-142`); `mounted` initializes from the controlled `open` prop so an open-at-mount lightbox SSRs visible (`lightbox-root.tsx:509-514`); scroll lock is acquired both on mount-open (`lightbox-root.tsx:1016-1021`) and on externally-driven controlled opens, e.g. Forward-button reopen (`lightbox-root.tsx:991-1003`); external prop flips do **not** echo `onOpenChange` (guarded by `lastInternalOpenRef`, `lightbox-root.tsx:991-992`) and intentionally skip View Transitions (`lightbox-root.tsx:988-990`) — so the demo's "Back closes with a fade, not a morph" comment is true; `Content` self-focuses in a layout effect on `mounted && !preparing`, which includes the hydration commit of a deep link (`lightbox-content.tsx:153-157`); the Slides mount layout effect derives index from `scrollLeft` and jumps to the active offset (`lightbox-slides.tsx:369-375`); `data-positioned` lands in a layout effect before first client paint (`lightbox-thumbnail-strip.tsx:140-145`); `Lightbox.Trigger` calls `setActiveIndex(index, 'trigger')` **before** `setOpen(true)` (`lightbox-trigger.tsx:388-389`), validating the `indexRef` design.
- **Transform math**: bleed slides are `flex: 0 0 100%; min-width: 100%` scoped to the demo skin (`chrome-insets.css:95-98`, also on `.lightbox-demo-slide-pad:71-78`); the track is `gap-5` (1.25rem) mobile / `md:gap-0` (`lightbox-chrome.tsx:369`); the CSS uses exactly `-100% - 1.25rem` below 768px and `-100%` above (`ssr-slide-shift.css:27-34`); no Tailwind breakpoint overrides exist, so `md` = 768px and the `sm` used by `useColumnCount` = 640px. `translateX` percentages resolve against the slide's own border-box, which equals the scrollport in bleed (insets are slide padding, not scroller padding). Slide *i* sits at `i × (W + gap)`; the shift lands it at 0 exactly. Scroll 0 is a valid center-snap position for slide 0, and transforms affect neither scroll geometry nor snap points, so nothing snaps or scrolls pre-hydration.
- **Removal ordering**: React runs layout effects child-before-parent, so the library's Slides jump (real scroll in) precedes the demo's `setSsrSlideShift(false)` (transform out); the setState-in-layout-effect re-render commits before paint. One paint, no flash — the comment's claim is accurate.
- **Double-rAF `ssrNoTransitions`**: the CSS reasoning is sound (transitions start from the *after-change* style per the CSS Transitions spec, so a same-recalc removal would restart the suppressed fades; the first rAF can fire before the pending paint, the second cannot). Cleanup is correct — `raf` is reassigned inside the first callback, so `cancelAnimationFrame(raf)` always cancels the live handle; strict-mode double-invocation is idempotent. Removing the class does not re-trigger `@starting-style` (it only applies when the element first renders).
- **History semantics** (traced every path): trigger tap → `onValueChange` (skipped while closed) then `onOpenChange(true)` → one `pushState` — one entry per session. Swipe/arrow keys → `replaceState`, no history spam. Back while open → popstate → `usePathname` → `urlIndex === -1` → prop-driven close, no `onOpenChange` echo, no history write. Forward → reopens at the entry's photo, scroll locked via the external-open path. Gesture close → `replaceState(BASE_PATH)` rewrites the pushed entry (deliberate; see L3). Reload mid-session → deep-link SSR of the current photo. Open→close→open sequences produce no double-pushes and no loops: the `useEffect([urlIndex])` URL→state sync is idempotent against echoes because gesture callbacks already wrote both state and URL before the pathname re-render arrives. The `usePathname`-tracks-native-history claim is true and stable Next.js behavior (shipped behind `windowHistorySupport` in 14.0, enabled by default since 14.1; the official docs use exactly this `pushState(null, '', url)` shape — Next's instrumentation preserves its internal router state).
- **Hydration byte-identity**: all five mount-time decisions (`open`, `index`, `deepLinkVisit`, `ssrSlideShift`, `ssrNoTransitions`) derive from `photoIndexFromPathname(usePathname())`, which is identical on server prerender and hydration for every reachable URL shape (grid, valid id, encoded valid id; unknown/malformed ids never reach hydration — they 404/400 server-side). `LightboxGallery`'s localStorage read is gated on `layoutToggle`, which moodboard doesn't enable, so no storage-derived divergence. No other `useState` initializer in the touched files can diverge.
- Minor comment claims spot-checked and true: sticky mobile header is `z-40` (`mobile-nav.tsx:40`); docs layout root has `isolate` (`(docs)/layout.tsx`) matching the Portal stacking guidance; `replaceState` fires no popstate and restores no scroll (HTML spec).

---

## Findings

### Medium

**M1 — Photo deep links ship generic OpenGraph metadata; social shares won't show the photo (or even the photo's title).**
`apps/docs/app/(docs)/examples/lightbox/moodboard/[[...id]]/page.tsx:24-38`. `generateMetadata` sets only `title`/`description`. Verified in SSR output for `/moodboard/mb-05`: `og:title` is the root layout's "ramka — The lightbox for React", `og:url` is `https://ramka.dev`, and the og image is the generic site card — Next.js does not cascade page `title` into an `openGraph` object inherited from a parent layout. The demo's headline pitch (page description, `examples.ts` blurb, llms docs) is "every photo is a shareable URL … with per-photo metadata", but the metadata that sharing surfaces (Slack/Twitter/iMessage cards) actually read is the generic one. This is also the one thing a copying customer can't discover by testing locally.
*Fix:* extend the photo branch of `generateMetadata`:

```tsx
return {
  title: `${photo.caption} — Moodboard example`,
  description: `${photo.alt} — …`,
  openGraph: {
    title: `${photo.caption} — Moodboard example`,
    description: photo.alt,
    images: [{ url: photo.image.src, width: photo.image.width, height: photo.image.height, alt: photo.alt }],
  },
  twitter: { card: 'summary_large_image' },
};
```

(`StaticImageData.src` is a site-relative URL; `metadataBase` resolution applies. Consider `alternates.canonical` per photo too.)

**M2 — The generated llms example doc omits the load-bearing CSS; the copied pattern silently degrades.**
`apps/docs/scripts/generate-llms-txt.ts:959-967`, `apps/docs/app/_components/examples.ts:37-40`. This branch adds `extraSources` precisely so the example doc is self-contained, and `moodboard.md` now embeds the route, the demo, and `photos.ts` — but not `app/lightbox-demo/ssr-slide-shift.css` (the transform rules **and** the `transition: none` rule) nor the new `data-positioned` gating in `thumbnail-strip-scroll-link.css:57-70`. A consumer reproducing the demo from the llms doc gets `lightbox-demo-ssr-slide-shift` / `lightbox-demo-ssr-no-transitions` class names with no definitions: no error, but deep links then paint slide 0 pre-hydration, fade themselves in on load, and snap the strip — exactly the failure modes this branch exists to prevent, and easy to miss because everything still "works" after hydration. Contributing constraint: `extraSources` entries are joined onto `app/(docs)/examples/lightbox`, so the CSS under `app/lightbox-demo/` can't be listed without `../../` traversal.
*Fix:* either root `extraSources` at `app/` (or accept absolute-from-docsRoot paths) and add the two CSS files to the moodboard entry, or add a prose pointer in the example description. The `sourceBlocks` label logic (`rel.replace(/^app\/\(docs\)\//, '')`) already handles non-`(docs)` paths gracefully.

### Low

**L1 — `handleValueChange` guards the URL write with a render-scope `open` that can be stale.**
`apps/docs/app/(docs)/examples/lightbox/moodboard/moodboard-demo.tsx:168-177`. `if (open)` reads the closure from the last committed render. If the library ever emitted `onOpenChange(false)` followed synchronously (same task, before React re-renders) by `onValueChange(n)`, the value callback would still see `open === true` and `replaceState` a photo URL *after* the close's `replaceState(BASE_PATH)` — stranding a photo URL on a closed viewer, and the `useEffect([urlIndex])` would then re-open it. I traced the current library paths and could not reach this ordering (navigation is locked during flings, pull-to-dismiss doesn't change value, close paths don't emit value changes), so it is latent, not live — but this file is a reference implementation and the guard's correctness shouldn't depend on non-contractual library event ordering.
*Fix:* mirror the existing `indexRef` technique with an `openRef` (the library itself does this for the same reason, `lightbox-content.tsx:124-127`), or write the URL only when it differs from `location.pathname`.

**L2 — Desktop grid paints 2 columns, then reshuffles to 3 after hydration.**
`moodboard-demo.tsx:43-53` (`useColumnCount` starts at 2, corrected in a post-paint `useEffect`). Every desktop visit to the grid renders the 2-column masonry in server HTML and first paint, then re-buckets to 3 columns — a visible full-grid reshuffle and CLS hit on the page whose theme is first-paint fidelity. Carried over verbatim from the old `page.tsx` on `main`, so it is not a regression, and on deep-link visits it's hidden behind the viewer — but the grid *is* the prerendered landing state now. There is no perfect SSR answer while keeping the flex-column distribution (the multicol alternative is correctly rejected for morph-perf reasons in the comment at lines 180-187, which I verify as sound reasoning); a `useLayoutEffect` would at least reshuffle pre-paint post-hydration rather than visibly. Consider acknowledging the tradeoff in the comment the same way the RTL caveat is acknowledged in `ssr-slide-shift.css`.

**L3 — "Back from the closed grid steps through it — harmless" slightly oversells the leftover-entry tradeoff.**
`moodboard-demo.tsx:157-164`. Two verified caveats: (1) the leftover entries accumulate — each open→gesture-close session adds one, so after three viewer sessions the user needs four Backs to leave the page; (2) Back onto the older grid entry triggers that entry's scroll restoration, and when `scrollTriggerIntoView` scrolled the grid during the session (the exact scenario the comment itself describes for the `history.back()` hazard), the "no-op" Back visibly jumps the grid scroll position. Neither breaks anything, and the push/replace choice itself is right (see improvement I2 for alternatives) — but since these comments are documentation customers will trust, state both costs.

### Nit

**N1 — The 404 guard's `id &&` relies on Next normalizing `{ id: [] }` to `undefined`.**
`[[...id]]/page.tsx:43-45` with `generateStaticParams` returning `{ id: [] }` (line 21). An empty array is truthy; if `params` ever delivered `[]` for the grid (as the static-params entry literally spells), `!moodboardPhotos.some(p => p.id === id[0])` would `notFound()` the grid at build time. Verified safe on Next 15.5.18 (production build emits the real grid HTML), but `if (id?.length && (id.length > 1 || !moodboardPhotos.some((p) => p.id === id[0])))` costs nothing and doesn't lean on undocumented normalization — better for a copied reference.

**N2 — `decodeURIComponent` can throw.**
`moodboard-demo.tsx:33-38`. Unreachable via navigation (verified: the server 400s malformed sequences before rendering), but the helper is exactly the kind of snippet that gets copied into codebases where other code calls `pushState` with arbitrary strings. A `try { … } catch { return -1; }` makes the reference implementation total.

**N3 — Masonry DOM order is column-major; Tab/reading order zigzags versus visual order** (tab visits tiles 0, 3, 6, 9, then 1, 4, 7…on 3 columns). Pre-existing, inherent to flex-column masonry (CSS multicol has the same issue), and the correct index still opens — just noting it is a known accessibility texture of this layout, worth a one-line comment.

**N4 — Client-side remounts at a photo URL take the SSR code path.**
`moodboard-demo.tsx:85` — `deepLinkVisit` is `urlIndex !== -1` *at mount*, which is also true when the user opens a photo, client-navigates to another docs page, and presses Back: the restored page mounts fresh with a photo pathname, renders in place (fine — verified the `relative z-50` host stacks above the `z-40` header, and no transformed/filtered ancestor in the `(docs)` layout breaks `position: fixed`), and `ssrNoTransitions` suppresses the open fade for two frames, so the viewer snaps open instead of fading. Cosmetic, rare path. Worth extending the "decided ONCE per mount" comment to mention that this branch also covers bfcache-less client restores, since a reader may assume `deepLinkVisit` ⇒ "server rendered this".

Also noted, no action needed: the two-frame `ssrNoTransitions` window also flattens transitions for any *user-initiated* interaction landing inside it (an immediate Escape-close snaps) — imperceptible in practice; the blanket `transition: none !important` is correctly scoped to the Portal host subtree only; `generateStaticParams`'s photo params, `dynamicParams` default (unknown ids 404 on demand — verified), and the `data-positioned` API doc entry in `_content/lightbox/api/generated.ts` are all consistent with library behavior; the regenerated `public/` outputs match the generator (`docs:llms:check` green).

---

## Improvement proposals (consumer-side SSR/default-open pattern)

**I1 — Extract the pattern into a documented recipe (and probably a hook).**
The demo buries ~120 lines of genuinely subtle, reusable machinery (URL⇄state sync, `deepLinkVisit`, both SSR flags, the history write discipline) inside one example that customers will copy by superstition. Sketch: a docs recipe page ("URL-driven lightbox with SSR deep links") built around a `useLightboxUrlSync({ basePath, ids })` hook returning `{ open, index, deepLinkVisit, portalProps, rootProps }`, with the two CSS blocks inline in the page (also fixes M2), plus an explicit "what each flag is for" table and a decision note on push-vs-replace. Risks: a hook freezes tradeoffs (replace-on-close, loop behavior) that some apps want different — keep it a *recipe with a copyable hook*, not a library export, so consumers own the policy. Worth it: highest-leverage item here; this is the feature the branch exists to showcase.

**I2 — Leftover-history-entry alternatives.**
The `replaceState`-on-gesture-close choice is right for this library because of the verified VT/scroll-restoration collision, but the recipe should present the alternative for consumers not using morph closes: defer the pop to `onOpenChangeComplete(false)` (fires after the close transition settles — `lightbox-root.tsx:800,933`) and call `history.back()` there, with a ref flag so the resulting popstate isn't double-handled by the `urlIndex` effect. That yields a clean stack (no leftover entries) at the cost of a post-close scroll-restoration jump when the grid scrolled during the session — i.e., the same jump moved after the animation instead of into it. Also worth tagging the pushed entry (`pushState({ lightboxEntry: true }, …)` merged over `history.state`) so future code can distinguish "Back will close the viewer" from "Back leaves the page" — e.g. to decide whether an in-app close button should `back()` or `replaceState`. Low risk, moderate value; document rather than change the demo.

**I3 — Harden the pre-hydration interaction window.**
Verified current behavior on the SSR'd-open page before hydration: all buttons are dead (fine, they do nothing), page scroll is *not* locked (the grid can scroll behind the opaque backdrop), background triggers are in tab order with no focus trap, and — the one visible artifact — the Slides track is a live native scroller whose content is transform-shifted, so a pre-hydration swipe reveals blank slots (slides 0…N−1 are translated off to the left; the last N slots are empty) until the hydration jump self-corrects. One line of CSS closes the worst of it: `.lightbox-demo-ssr-slide-shift [data-ramka-slides] { overflow-x: hidden; }` (the class is dropped in the hydration commit, exactly when the real scroll offset takes over) — cheap, no downside, recommend adding. For the focus/scroll leaks, a server-rendered `inert` on the page-content wrapper for deep-link visits would fully seal it but needs layout cooperation; document it as an option rather than complicating the demo. JS-disabled clients get a surprisingly good result already (correct photo, correct metadata, readable caption — verified in the static HTML); if no-JS matters to a consumer, prev/next as real `<a href="…/mb-06">` anchors progressively enhanced into `Lightbox` controls is the sketch, but it fights the library's gesture model — probably not worth it for this demo beyond a mention.

**I4 — Per-photo OpenGraph/Twitter images and canonicals** — see M1; for a consumer recipe also mention `metadataBase`, and that `StaticImageData` gives you correctly sized `og:image` dimensions for free. Trivial cost, directly serves the demo's pitch.

**I5 — E2E coverage for the history choreography.**
The repo has a Playwright `e2e/` suite but nothing exercises this demo (verified — no moodboard references). The invariants here are exactly the kind that regress silently: entry-count after open→swipe→close (should be +1 exactly), Back-closes-viewer, Forward-reopens, reload-mid-session SSRs the current photo, first client paint of a deep link shows the correct slide with no transform class remaining, and no transition runs in the first frames (assert via `transitionstart` listener injected before load). All are assertable with `page.goBack()`/`history.length` deltas and an init-script probe. Moderate effort, high protection; recommended before this ships as the canonical recipe.

**I6 — Consider first-class library support for "initial slide without scroll" (for the library reviewer's court).**
The transform stand-in is clever and verified-correct, but it is bleed-only, LTR-only, and couples the consumer to slide-width CSS (`-100% - 1.25rem` must mirror the track's gap by hand — a copyable footgun if someone changes `gap-5`). A library-level `Slides ssrIndex`/`data-ramka-ssr-index` that emits the equivalent transform (direction-aware, reading the real gap at hydration) would collapse both SSR flags into one attribute and delete the demo's most fragile CSS. Related: the demo's `BASE_PATH` constant must be kept in sync with the route folder by hand — worth a comment, or derive the id from `useParams()` instead of string-slicing the pathname (also removes N2's `decodeURIComponent` entirely, since Next delivers decoded params).
