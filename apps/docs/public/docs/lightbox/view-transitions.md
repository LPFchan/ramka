# View transitions

Morph open/close between a trigger and the active item with the browser View Transitions API. Part of [Lightbox](docs/lightbox.md). Unsupported browsers, reduced-motion, and low-end devices fall back to a plain fade.

## Morph refs

Morph is on by default (`viewTransition` on [Root](docs/lightbox/api.md#api-root)). Pass `viewTransition={false}` to opt out. Recommended destination shape: [Lightbox.Media](docs/lightbox/api.md#api-media) around the `<img>` / `<video>` (sized fit-box = morph target + placeholder host). On [Trigger](docs/lightbox/api.md#api-trigger), prefer a render prop:

- `imageRef` — put on the Trigger thumb `<img>` whose pixels bridge the morph. Media auto-discovers the destination image (or video poster). Lets open reuse an already-decoded bitmap so the transition doesn’t flash empty space.
- `morphRef` — optional escape hatch when morph bounds should differ from Media / the image (tile with overlay, swatch + label).

Nested wrappers can use [useLightboxTriggerContext](docs/lightbox/api.md#api-use-trigger-context) / [useLightboxItemContext](docs/lightbox/api.md#api-use-item-context) instead of threading the render prop. Use `awaitImageDecode` on [Root](docs/lightbox/api.md#api-root) when you want a short wait for the destination image before the morph starts (default ~200ms cap).

```tsx Minimal morph
import { Lightbox } from 'ramka';

<Lightbox.Root morphTo="active">
  <Lightbox.Trigger index={0}>{({ imageRef }) => <img ref={imageRef} src={thumb} alt="" />}</Lightbox.Trigger>

  <Lightbox.Portal>
    <Lightbox.Backdrop />
    <Lightbox.Content>
      <Lightbox.Slides>
        <Lightbox.Slide>
          <Lightbox.Item index={0}>
            <Lightbox.Zoom>
              <Lightbox.Media>
                <img src={src} alt="" />
              </Lightbox.Media>
            </Lightbox.Zoom>
          </Lightbox.Item>
        </Lightbox.Slide>
      </Lightbox.Slides>
    </Lightbox.Content>
  </Lightbox.Portal>
</Lightbox.Root>
```

## Source aspect

The morph snapshots whatever pixels are on the trigger `<img>` and interpolates them into the destination Media box. That only looks like one photo when both sides share the *same intrinsic aspect ratio* — the same file, or srcset candidates of that file. A square tile is fine; crop it with CSS ( `object-fit: cover`), not by baking `w=h&fit=crop` into a different image.

A CDN-cropped 1∶1 thumb against a 3∶2 lightbox image will reframe mid-animation: Ramka paints the square thumb into the landscape box, then the full file lands with a different crop. Element boxes may differ. Intrinsic aspect must not.

```tsx Do — same source aspect
import { Lightbox } from 'ramka';

<Lightbox.Root>
  <Lightbox.Trigger index={0}>
    {({ imageRef }) => (
      <Image
        ref={imageRef}
        src={photo}
        alt="Photo"
        placeholder="blur"
        className="aspect-square size-full object-cover"
      />
    )}
  </Lightbox.Trigger>

  <Lightbox.Portal>
    <Lightbox.Backdrop />
    <Lightbox.Content>
      <Lightbox.Slides>
        <Lightbox.Slide>
          <Lightbox.Item index={0}>
            <Lightbox.Zoom>
              <Lightbox.Media width={photo.width} height={photo.height}>
                <Image src={photo} alt="Photo" sizes="100vw" priority />
              </Lightbox.Media>
            </Lightbox.Zoom>
          </Lightbox.Item>
        </Lightbox.Slide>
      </Lightbox.Slides>
    </Lightbox.Content>
  </Lightbox.Portal>
</Lightbox.Root>
```

```tsx Don’t — baked square crop
import { Lightbox } from 'ramka';

<Lightbox.Root>
  <Lightbox.Trigger index={0}>
    {({ imageRef }) => (
      // ❌ 1∶1 file. Media below is the full 3∶2 photo.
      <Image ref={imageRef} src={squareThumb} alt="Photo" className="size-full object-cover" />
    )}
  </Lightbox.Trigger>

  <Lightbox.Portal>
    <Lightbox.Backdrop />
    <Lightbox.Content>
      <Lightbox.Slides>
        <Lightbox.Slide>
          <Lightbox.Item index={0}>
            <Lightbox.Zoom>
              <Lightbox.Media width={photo.width} height={photo.height}>
                <Image src={photo} alt="Photo" sizes="100vw" priority />
              </Lightbox.Media>
            </Lightbox.Zoom>
          </Lightbox.Item>
        </Lightbox.Slide>
      </Lightbox.Slides>
    </Lightbox.Content>
  </Lightbox.Portal>
</Lightbox.Root>
```

## Trigger crossfade

Controls whether the morph *dissolves* between trigger and item snapshots or hard-cuts geometry only.

- **Omit (default)** — hard-cut. Best when trigger and item show the *same* picture at the *same intrinsic aspect* (a CSS `object-cover` window or a smaller srcset is fine; a CDN-baked crop that changes the aspect is not — see [Source aspect](#source-aspect)). Leaves `data-ramka-crossfade` unset on `<html>` during the transition.
- `both` — dissolve on open and close (stack → single photo, +N overlay tile, etc.).
- `open` / `close` — dissolve in one direction only (e.g. poster → live video often wants `close`).

Keep trigger and item images on `object-fit: cover` (or the same fit) so crops stay coherent. Put border-radius on the morph target itself — the library interpolates `--lightbox-morph-border-radius-from/to` on `<html>`.

```tsx crossfade="both"
import { Lightbox } from 'ramka';

<Lightbox.Root morphTo="closest">
  <Lightbox.Trigger index={0} crossfade="both">
    {({ imageRef }) => (
      <div className="relative">
        <Image ref={imageRef} src={photo} alt="" placeholder="blur" />
        <span>+{extras}</span>
      </div>
    )}
  </Lightbox.Trigger>
  <Lightbox.Portal>
    <Lightbox.Backdrop />
    <Lightbox.Content>
      <Lightbox.Slides>
        <Lightbox.Slide>
          <Lightbox.Item index={0}>
            {({ imageRef }) => <Image ref={imageRef} src={photo} alt="" sizes="100vw" priority />}
          </Lightbox.Item>
        </Lightbox.Slide>
      </Lightbox.Slides>
    </Lightbox.Content>
  </Lightbox.Portal>
</Lightbox.Root>
```

## Root morphTo

Picks which trigger receives the *close* morph:

- `active` (default) — trigger for the current active index. No morph if that index has no trigger.
- `origin` — always the trigger that opened the lightbox (one tile opens many items).
- `closest` — active index if registered, otherwise the nearest registered trigger.

```tsx morphTo="closest"
import { Lightbox } from 'ramka';

<Lightbox.Root morphTo="closest">
  <Lightbox.Trigger index={0}>{/* first thumb */}</Lightbox.Trigger>
  <Lightbox.Trigger index={1}>{/* +N tile */}</Lightbox.Trigger>
  {/* items 2…n close to the nearest trigger */}
  <Lightbox.Portal>
    <Lightbox.Backdrop />
    <Lightbox.Content>
      <Lightbox.Slides>
        <Lightbox.Slide>
          <Lightbox.Item index={0} />
        </Lightbox.Slide>
        <Lightbox.Slide>
          <Lightbox.Item index={1} />
        </Lightbox.Slide>
        <Lightbox.Slide>
          <Lightbox.Item index={2} />
        </Lightbox.Slide>
      </Lightbox.Slides>
    </Lightbox.Content>
  </Lightbox.Portal>
</Lightbox.Root>
```

## Root scrollTriggerIntoView

When the page scrolls while the lightbox is open, the close morph can land off-screen. Use `scrollTriggerIntoView` to keep the target trigger in view:

- `onChange` — scroll to the active trigger as the index changes (preemptive).
- `onOpenComplete` — reposition once open settles (invisible under the overlay; `instant` recommended).
- `onClose` — scroll just before the close morph (visible jump at close start).

Pass one option or an array. Each option also accepts `block` / `inline` alignment (defaults `nearest`) — use `inline: 'center'` for horizontal snap strips with variable-width tiles. Pair with `morphTo` so the scrolled element is the same one that receives the morph.

```tsx scrollTriggerIntoView
import { Lightbox } from 'ramka';

<Lightbox.Root
  scrollTriggerIntoView={[
    { type: 'onChange', behavior: 'instant' },
    { type: 'onOpenComplete', behavior: 'instant' },
  ]}
>
  {/* triggers + content */}
</Lightbox.Root>
```

## Programmatic open

Prefer [createHandle()](docs/lightbox/api.md#api-create-handle): `open(index, { triggerId })` associates a Trigger that declared that `id` so the open morph can use that element. Without a registered trigger (or `triggerId`), the open falls back to the fade path. Trigger clicks still morph. Demo: [State & lifecycle → Imperative API](docs/lightbox/state-lifecycle.md#imperative).

## Styling

You write **zero** view-transition CSS: the library injects the structural `::view-transition-*` rules itself (see [Injected CSS](#injected-css)) and writes document hooks during a morph so your own skin CSS can react — e.g. keep Backdrop/Content fades on the morph's clock. Attribute / CSS-variable tables live under [Document (view transitions)](docs/lightbox/api.md#api-view-transition-document). Hooks:

- `data-ramka-view-transition` — `opening` | `closing`
- `data-ramka-crossfade` — dissolve path (present when Trigger `crossfade` is active for this phase; absent for hard-cut)
- `--lightbox-morph-border-radius-from/to`, `--lightbox-morph-old/new-opacity`
- `data-ramka-vt-preset`, `--lightbox-vt-duration`, `--lightbox-vt-easing`, `--lightbox-vt-crossfade-close-easing`, `--lightbox-vt-root-easing` — the active timing preset, written by the library (see [Timing presets](#timing-presets))
- [Trigger](docs/lightbox/api.md#api-trigger) `data-morph-target` / [Item](docs/lightbox/api.md#api-item) `data-skip-fade` — hide the live morph source and suppress entrance fades on the destination while the VT layer is up

Motion splits into **timing** (a preset picked on Root — see below) and **structure** (injected by the library). Your CSS only handles cosmetics — and reads the library-written contract vars where it wants to stay in sync.

## Timing presets

Morph duration and easing are chosen with the `viewTransition` prop on [Root](docs/lightbox/api.md#api-root) — pass a preset name instead of `true`:

- `"default"` — 360ms, sheet curve with a tamed launch (what `true` runs)
- `"snappy"` — 340ms, hotter launch; reads quicker
- `"relaxed"` — 400ms, softer launch and longer settle
- `"spring"` — 450ms, critically damped spring; Photos-style settle

```tsx Picking a preset
<Lightbox.Root viewTransition="spring">{/* … */}</Lightbox.Root>
```

Timing is preset-based rather than free-form CSS on purpose: each preset is vetted on-device to stay smooth and skip-safe on iOS Safari (including Low Power Mode) and Android, where arbitrary curves stutter or teleport. The library publishes the preset timing as `--lightbox-vt-duration` / `--lightbox-vt-easing` / `--lightbox-vt-root-easing` in two places: always on the [Portal](docs/lightbox/api.md#api-portal) host, and — together with `data-ramka-vt-preset` — on `documentElement` for the duration of a morph. Read those vars in your own CSS as the skin's single motion clock (e.g. `transition: opacity var(--lightbox-vt-duration, 360ms) ease-out` on Backdrop/Content): during a morph the fades stay in lockstep with it, and on the non-morph paths (unsupported browsers, reduced motion, low-end fallback) they still run on the preset's timing; do not set the vars yourself.

## Injected CSS

On first [Root](docs/lightbox/api.md#api-root) mount the library injects one stylesheet with everything a morph structurally needs — no copy-paste block to maintain, and multiple skins on one page can never fight over it:

- **Name isolation** — `startViewTransition` snapshots the whole document, so any page element with its own `view-transition-name` would paint *over* the lightbox. Every name is cleared while `data-ramka-view-transition` is set; the morph target re-applies its name inline with `!important` and stays the only captured group.
- **Morph group** — clipping + border-radius interpolation (put radius on the morph target element; JS writes `--lightbox-morph-border-radius-from/to`), timed by the active preset.
- **Snapshots** — hard-cut by default (`object-fit: cover`, no UA dissolve); when Trigger `crossfade` sets `data-ramka-crossfade`, the dissolve path (UA fade, `plus-lighter`, `object-fit: fill`) runs on the same preset clock. Open uses the morph ease-out so the destination appears promptly; both phases run that complementary dissolve on a shorter window so the outgoing snapshot is gone before the size settle (`plus-lighter` stays opaque).
- **Root snapshot** — the page-behind crossfade, kept as a *single* root group (promoting Backdrop / Content into named groups tanks Safari). Fade scrim and chrome with live `opacity` transitions instead.
- **Morph-target hide** — `[data-morph-target]` gets `opacity: 0` with a 200ms fade-back (disabled during the transition so it can't be captured mid-flight), so the live trigger never shows doubled under the morphing snapshot.
- **Thumb-jump crossfade** — the element-scoped Slides transition started by ThumbnailStrip's `selectViewTransition`, tunable via `--lightbox-select-vt-duration/easing` on Slides.

Everything except name isolation is gated under `prefers-reduced-motion: no-preference`. The stylesheet is inserted at the *start* of `<head>`, so your own stylesheets cascade after it — overriding any injected rule takes an ordinary declaration of equal specificity, no `!important` needed.

Lifecycle timing for your own CSS: Content/Backdrop stay `mounted` through exit animations; while a VT open is preparing they may be `visibility: hidden` so the morph layer owns the pixels. Prefer `onOpenChangeComplete` for post-motion work — see [State & lifecycle → Lifecycle callbacks](docs/lightbox/state-lifecycle.md#lifecycle).
