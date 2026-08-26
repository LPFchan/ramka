# RTL support

Run the lightbox in a right-to-left reading direction — Arabic, Hebrew, Persian, Urdu. Part of [Lightbox](docs/lightbox.md).

## Setting the direction

One prop. `dir="rtl"` on [Root](docs/lightbox/api.md#api-root) mirrors the lightbox’s behaviour — scroll geometry, arrow keys, thumbnail-strip travel — and is written to the [Portal](docs/lightbox/api.md#api-portal) host as a `dir` attribute, so CSS direction follows it too. That matters because the host mounts on `document.body`: a `dir` on your own layout wrapper would style the page and never reach the viewer.

Because the prop crosses the portal boundary on its own, it is also all you need to run a single RTL lightbox inside an otherwise-LTR page — no wrapper element, no portal `container`. The demo further down this page does exactly that: these docs are LTR.

```tsx Setting the direction
import * as Lightbox from '@ramka/react/lightbox';

<Lightbox.Root dir="rtl">
  <Lightbox.Portal>
    <Lightbox.Backdrop />
    <Lightbox.Content aria-label="גלריית תמונות">
      <Lightbox.Slides>
        {images.map((img, i) => (
          <Lightbox.Slide key={img.id}>
            <Lightbox.Item index={i}>
              <Lightbox.Media>
                <img src={img.src} alt={img.alt} />
              </Lightbox.Media>
            </Lightbox.Item>
          </Lightbox.Slide>
        ))}
      </Lightbox.Slides>
      <Lightbox.Close aria-label="סגירה" />
    </Lightbox.Content>
  </Lightbox.Portal>
</Lightbox.Root>
```

## Already-RTL apps

If the whole app is RTL — `dir="rtl"` on `<html>` — you can omit the prop and the lightbox will still *look* right: nothing is written to the portal host when the prop is absent, so it inherits the document’s direction. Layout mirrors, and the page keeps control of it.

Pass the prop anyway. Behaviour has no way to read your CSS during render, so it stays on its `'ltr'` default — and RTL layout with LTR behaviour is the one misconfiguration with no visible symptom. The carousel still renders and still scrolls; it just resolves the wrong index for a scroll position, so the active marker and the visible slide drift apart. In development the library compares the two and warns.

## What mirrors

Not everything flips, and the split is not arbitrary. Moving through an ordered list follows reading order, so it mirrors. Manipulating a surface directly — panning a zoomed photo, dragging a sheet away — does not: a drag follows your hand, and mirroring it would fight the gesture. The arrow keys serve both, which is why they mirror while navigating and stay physical while zoomed.

| Surface | Under RTL | Why |
| --- | --- | --- |
| Slide order & scroll | Mirrored | Index 0 sits at the inline-start (right) edge; the scroller runs right-to-left. |
| Horizontal arrow keys | Mirrored | ArrowLeft advances, ArrowRight goes back — travel follows reading order. |
| Home / End | Not mirrored | Home is always the first item, End the last. They address indices, not sides. |
| Thumbnail strip | Mirrored | Track, padding, and the active-thumb indicator all run on the inline axis. |
| Previous / Next | Mirrored position | Previous is the item nearer index 0, so it belongs on the inline-start side. |
| Zoomed panning | Not mirrored | Direct manipulation of a surface: ArrowRight pans right, as on a map. |
| Pull-to-dismiss | Not mirrored | The sheet follows your finger, which has no reading direction. |
| Morph / view transitions | Mirrored | The morph measures the trigger and the slide, so it follows whatever they do. |

## Indices never mirror

The imperative API is index-based, and indices are not sides. [createHandle()](docs/lightbox/api.md#api-create-handle)’s `open(3)` and `goTo(3)` land on the fourth item in either direction; what changes is that RTL renders it further left and the track travels the other way to reach it. The same holds for `value` / `onValueChange` and for [Trigger](docs/lightbox/api.md#api-trigger)’s `index`.

The buttons inside the viewer below jump by index. Open it, then watch the strip: the photo you land on is the same one an LTR gallery would show.

```tsx Imperative API under RTL
import * as Lightbox from '@ramka/react/lightbox';

const lightbox = Lightbox.createHandle();

<>
  {/* Opens the first item, at the inline-start (right) edge of the track. */}
  <button type="button" onClick={() => lightbox.open(0)}>
    פתיחת הגלריה
  </button>

  {/* Jumps to the 4th item regardless of reading direction. */}
  <button type="button" onClick={() => lightbox.goTo(3)}>
    מעבר לתמונה 4
  </button>

  <Lightbox.Root handle={lightbox} dir="rtl">
    {/* … Portal / Content / Slides … */}
  </Lightbox.Root>
</>
```

## Styling for RTL

The library ships no styles, so mirroring your own chrome is your job — and logical properties do nearly all of it. Reach for `inset-inline-start` / `inset-inline-end` over `left` / `right`, `padding-inline` over `padding-left`, and `border-inline-start` for a divider beside a panel that changes sides. In Tailwind those are `start-*`, `end-*`, `ps-*`, `pe-*`, `ms-*`, and `text-start`. Every preset in this documentation is written this way.

Three things logical properties will not fix. Directional glyphs need flipping — `.nav:dir(rtl) svg &#123; transform: scaleX(-1); &#125;` turns a chevron around, since mirroring only the button’s position leaves it pointing the wrong way. Safe-area insets are physical, so pairing `inset-inline-start` with `env(safe-area-inset-left)` clears the notch on the wrong side; map them to the inline axis through a custom property that you swap under `:dir(rtl)`. And a counter like `1 / 7` is two digit runs around a neutral separator with nothing to anchor them, so an RTL base direction reorders it into `7 / 1` — give [Counter](docs/lightbox/api.md#api-counter) `direction: ltr; unicode-bidi: isolate;`.
