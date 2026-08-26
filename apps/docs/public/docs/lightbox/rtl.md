# RTL support

Run the lightbox in a right-to-left reading direction — Arabic, Hebrew, Persian, Urdu. Part of [Lightbox](docs/lightbox.md).

## Setting the direction

RTL takes two things, and they are deliberately separate. The `dir` prop on [Root](docs/lightbox/api.md#api-root) mirrors the lightbox’s *behaviour* — scroll geometry, arrow keys, the thumbnail strip. CSS `direction` mirrors the *layout*. Setting `dir="rtl"` on `<html>` gives you the second one for the whole app, including the portaled viewer.

Keep them in agreement. A `dir` attribute on an app wrapper *looks* like it should be enough, but [Portal](docs/lightbox/api.md#api-portal) mounts on `document.body`, so the viewer never inherits it — you get RTL behaviour inside an LTR box. In development the library detects that mismatch and warns with the fix.

```tsx Whole-app RTL
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

## Scoping RTL to one viewer

If the surrounding app is LTR and only one surface is RTL, you cannot flip `<html>`. Give [Portal](docs/lightbox/api.md#api-portal) a `container` that carries `dir="rtl"` itself: the viewer then mounts inside an element whose direction it can inherit, and the CSS direction matches the `dir` prop again.

Mount the host on `document.body` rather than inside your own layout. A fixed-position viewer is positioned against the viewport, but any ancestor with a `transform`, `filter`, or `contain` becomes its containing block instead — which would shrink the viewer to that box.

```tsx Scoping RTL to one viewer
import * as Lightbox from '@ramka/react/lightbox';

const [host, setHost] = React.useState<HTMLElement | null>(null);

React.useEffect(() => {
    const el = document.createElement('div');
    el.dir = 'rtl';
    document.body.append(el);
    setHost(el);
    return () => el.remove();
  }, []);

<Lightbox.Root dir="rtl">
  {/* Until the host exists, leave `container` unset so the viewer still
      portals to <body> — `container={null}` means "render in place". */}
  <Lightbox.Portal container={host ?? undefined}>
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
    </Lightbox.Content>
  </Lightbox.Portal>
</Lightbox.Root>
```

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
