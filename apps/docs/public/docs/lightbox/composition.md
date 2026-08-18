# Composition

Default to Slides + Zoom (swipe carousel with pinch zoom), size media to fill Content, then layer chrome. Part of [Lightbox](docs/lightbox.md).

## Slides + Zoom

Prefer [Slides](docs/lightbox/api.md#api-slides) + [Slide](docs/lightbox/api.md#api-slide) for a swipeable snap carousel wired to the active index — this is the layout used by nearly every docs demo and example. Slide boxes stay mounted; `preload` gates heavy Item content.

- Nesting rule: put `Item` and [Zoom](docs/lightbox/api.md#api-zoom) *inside* each `Slide`. Pull transforms the item, not the snap box.
- User flings set an internal scroll lock so pull-to-dismiss, zoom chrome, and discrete prev/next do not fight the carousel mid-gesture.
- Scroll-driven index changes report `onValueChange` with `source: 'scroll'` — see [NavigationSource](docs/lightbox/api.md#types).
- Item render-prop `active` is the current index (drive expensive work here). `visible` means the item is in the preload window — use it for lightweight prefetch, not video autoplay.

```tsx Slides + Slide nesting
import { Lightbox } from 'ramka';

<Lightbox.Root>
  <Lightbox.Portal>
    <Lightbox.Backdrop />
    <Lightbox.Content>
      <Lightbox.Slides preload={1}>
        {items.map((item, i) => (
          <Lightbox.Slide key={item.id}>
            <Lightbox.Item index={i}>
              <Lightbox.Zoom>
                <Lightbox.Media>
                  <img src={item.src} alt={item.alt} />
                </Lightbox.Media>
              </Lightbox.Zoom>
            </Lightbox.Item>
          </Lightbox.Slide>
        ))}
      </Lightbox.Slides>
    </Lightbox.Content>
  </Lightbox.Portal>
</Lightbox.Root>
```

```css Slide track (full-bleed carousel)
/*
 * Default bleed track — one scrollport width per slide.
 * Slides geometry assumes center snap (built into Lightbox.Slide).
 */
[data-ramka-slide] {
  flex: 0 0 100%;
  min-width: 100%;
}
```

## Media layout

Ramka is *cosmetically* unstyled — colors and chrome are yours — but Media may apply *structural* fit-box styles via `width` / `height` (same idea as Next.js `<Image>`) so the morph target has a correct aspect before pixels load. Slide width is consumer CSS too — [Slide](docs/lightbox/api.md#api-slide) only bakes in snap alignment ( `scroll-snap-align: center`, `scroll-snap-stop: always`); you size each snap box. For a full-bleed carousel, use `flex: 0 0 100%` and `min-width: 100%` on each slide (see snippet below). Snug / variable-width tracks use a different width formula — see the [Default preset](presets/default.md). Item and Zoom fill the slide content box; size the stack so when Zoom scales past 1× the image can cover the viewport and is not clipped by a shorter ancestor.

- `Content` — fullscreen surface ( `fixed inset-0` / full dialog)
- `Slides` — `flex-1` (or equivalent stretch)
- `Slide` — `flex: 0 0 100%; min-width: 100%` for a full-bleed track; `h-full` for height; put chrome / safe-area insets here as padding (not on Zoom)
- `Item` — already fills the Slide (`width/height: 100%`)
- `Zoom` — already fills + centers (structural)
- `Media` — sized fit-box (morph + placeholder host); `<img>` / `<video>` inside

Keep Close, Counter, Caption, and thumbnails as *absolutely positioned siblings* of Slides (see Chrome below) — not in-flow above or below Zoom. Resting insets belong on Slide padding / safe-area so zoomed media can still paint into that padding under chrome. Gesture details live in [Gestures](docs/lightbox/gestures.md).

Set HTML `width` and `height` on the destination `<img>` (from known pixel dims or CMS metadata) so the box and aspect ratio exist *before* pixels load. That avoids CLS, keeps the morph target sized on slow networks, and prevents an unloaded `size: auto` image from collapsing to 0×0 (which can skip or weaken the open morph). When dimensions are unknown, see [Moodboard](examples/lightbox/moodboard.md). For mixed media (photos plus WebGL) with [onBeforeOpen](docs/lightbox/api.md#api-root) preheat, see [3D models](examples/lightbox/3d-models.md).

To fill the maximum available space without distorting the source aspect ratio, nest Media under [Lightbox.Zoom](docs/lightbox/api.md#api-zoom) (a size container for `cqw` /`cqh`) and pass `width` /`height` to [Lightbox.Media](docs/lightbox/api.md#api-media). Media applies the inscribed fit-box ( `min(100cqw, 100cqh × w/h)` + `aspect-ratio: w / h`). Or put HTML `width` / `height` on the child image and omit the Media props — Media derives the box. When the box matches the source aspect, child `object-fit` is a no-op and Media’s grid stretch fills the box (no `size-full` needed on a direct media child). Put border-radius on Media (morph target). Leave chrome outside Media. Resting insets belong on Slide padding / safe-area so zoomed media can paint into that padding under chrome.

```tsx Media fill + fit-box
import { Lightbox } from 'ramka';

<Lightbox.Root>
  <Lightbox.Portal>
    <Lightbox.Backdrop />
    <Lightbox.Content className="fixed inset-0 flex flex-col">
      <Lightbox.Slides className="flex-1">
        <Lightbox.Slide className="h-full p-8">
          <Lightbox.Item index={0}>
            {/* Zoom fills the Slide content box; pad the Slide for chrome insets. */}
            <Lightbox.Zoom>
              <Lightbox.Media width={width} height={height}>
                <img width={width} height={height} src={src} alt={alt} />
              </Lightbox.Media>
            </Lightbox.Zoom>
          </Lightbox.Item>
        </Lightbox.Slide>
      </Lightbox.Slides>
    </Lightbox.Content>
  </Lightbox.Portal>
</Lightbox.Root>
```

Live compositions: [Default preset](presets/default.md), [Twitter preset](presets/twitter.md), [Stories preset](presets/stories.md), [Photos app](examples/lightbox/photos-app.md).

## Stage (split layouts)

Use [Lightbox.Stage](docs/lightbox/api.md#api-stage) when Content holds more than the media pane — for example a thread sidebar beside the gallery. Stage is the media interaction surface: trackpad wheel pull-to-dismiss, Zoom pan cover geometry, and arrow / Home / End gallery navigation are scoped to it. Content remains the dialog shell (focus trap, Escape, zoom shortcuts). Place side panels as siblings of Stage under Content so they keep native scroll and their own keyboard behavior. When Stage is omitted, Content itself is the stage (default full-bleed viewers need no change).

```tsx Stage + side panel
<Lightbox.Content aria-label="Post">
  <Lightbox.Stage className="media-pane">
    <Lightbox.Close />
    <Lightbox.Slides>{/* media */}</Lightbox.Slides>
    <Lightbox.Previous />
    <Lightbox.Next />
  </Lightbox.Stage>
  <aside>{/* thread / details */}</aside>
</Lightbox.Content>
```

Attach Stage `morphRef` when the open/close morph should capture the Stage surface (or a descendant) instead of the active item — a 9:16 stories frame, the slides track, or a custom bezel. Decode and the thumbnail placeholder stay on the item.

```tsx Stage morphRef
<Lightbox.Stage>
  {({ morphRef }) => (
    <div ref={morphRef} className="frame">
      <Lightbox.Slides>{/* media */}</Lightbox.Slides>
    </div>
  )}
</Lightbox.Stage>
```

Live examples: [Twitter preset](presets/twitter.md), [Stories preset](presets/stories.md).

## Chrome

The site default viewer is Slides + Zoom with Counter (top-left), Close / ZoomIn / ZoomOut, Caption, and a desktop [ThumbnailStrip](docs/lightbox/api.md#api-thumbnail-strip) (scroll-linked midline track) as siblings inside [Content](docs/lightbox/api.md#api-content). Midline selection chrome is plain consumer markup on the strip root. Prefer [ThumbnailGroup](docs/lightbox/api.md#api-thumbnail-group) when you want a static tablist without scroll-linking. Thumbnails register by `index` like Triggers. Put Backdrop and Content in [Portal](docs/lightbox/api.md#api-portal). Stacking follows Base UI: `isolation: isolate` on the app layout root, and — when using `keepMounted` — a consumer `z-index` on the Portal host (e.g. `className="relative z-[1]"`). Inside the portal, document order keeps Backdrop under Content.

```tsx Chrome composition
import { Lightbox } from 'ramka';

<Lightbox.Root>
  <Lightbox.Portal>
    <Lightbox.Backdrop />
    <Lightbox.Content>
      <Lightbox.Slides>
        {items.map((item, i) => (
          <Lightbox.Slide key={item.id}>
            <Lightbox.Item index={i} caption={item.caption}>
              <Lightbox.Zoom>
                <Lightbox.Media>
                  <img src={item.src} alt={item.alt} />
                </Lightbox.Media>
              </Lightbox.Zoom>
            </Lightbox.Item>
          </Lightbox.Slide>
        ))}
      </Lightbox.Slides>

      <Lightbox.Counter />
      <Lightbox.ZoomOut />
      <Lightbox.ZoomIn />
      <Lightbox.Close />

      <Lightbox.Caption />
      <Lightbox.ThumbnailStrip>
        <Lightbox.ThumbnailStripTrack aria-label="Photo thumbnails">
          {items.map((item, i) => (
            <Lightbox.Thumbnail key={item.id} index={i}>
              <img src={item.thumb} alt="" />
            </Lightbox.Thumbnail>
          ))}
        </Lightbox.ThumbnailStripTrack>
        {/* Optional midline chrome — plain consumer markup */}
        <span aria-hidden />
      </Lightbox.ThumbnailStrip>
    </Lightbox.Content>
  </Lightbox.Portal>
</Lightbox.Root>
```

Packaged as a skin: [Default preset](presets/default.md).

## Dynamic itemCount

Items register on mount. The root `itemCount` is derived from registered items — indices do not need to be contiguous, but Counter, loop edges, and preload distance all use that count. Prefer dense `0…n-1` indexes unless you intentionally leave holes.
