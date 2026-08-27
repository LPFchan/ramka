# ramka

Unstyled, accessible lightbox primitives for React — in the style of Radix UI and Base UI. Compose your own lightbox UI on headless parts with view-transition morph by default, swipe slides, zoom, and pull-to-dismiss.

## Installation

```bash
pnpm add @ramka/react
```

Peer dependencies: `react` and `react-dom` >= 18.

## Quick start

```tsx App.tsx
import * as Lightbox from '@ramka/react/lightbox';

<Lightbox.Root>
  {items.map((item, i) => (
    <Lightbox.Trigger key={item.id} index={i}>
      {({ imageRef }) => <img ref={imageRef} src={item.thumb} alt={item.alt} />}
    </Lightbox.Trigger>
  ))}

  <Lightbox.Portal>
    <Lightbox.Backdrop />
    {/* Every string here is yours — the library ships none, so nothing it
        renders is ever in the wrong language. */}
    <Lightbox.Content aria-label="Photo viewer">
      <Lightbox.Slides aria-label="Photos" aria-roledescription="carousel">
        {items.map((item, i) => (
          <Lightbox.Slide key={item.id}>
            <Lightbox.Item
              index={i}
              caption={item.caption ?? item.alt}
              aria-roledescription="slide"
              aria-label={`${i + 1} of ${items.length}`}
            >
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
      <Lightbox.ZoomOut aria-label="Zoom out" />
      <Lightbox.ZoomIn aria-label="Zoom in" />
      <Lightbox.Close aria-label="Close" />
      <Lightbox.Caption />
    </Lightbox.Content>
  </Lightbox.Portal>
</Lightbox.Root>
```

## Licensing

ramka is dual-licensed. Under [GPL-3.0-only](https://www.gnu.org/licenses/gpl-3.0.html) it is free to use, modify, and redistribute — including commercially, since the GPL does not restrict commercial use — as long as you comply with the GPL.

If your use of ramka creates a work that is subject to the GPL, the GPL’s source-code and licensing requirements apply to that work when you distribute it. If you’re building proprietary software and don’t want to rely on the GPL, you may purchase a [commercial license](https://ramka.dev/license) instead — a separate license grant from the copyright holder, permitting use under its own terms rather than the GPL.

Most teams building closed-source products will therefore want the commercial license.

This is practical guidance, not legal advice. The applicable license terms govern: the [GPL](https://www.gnu.org/licenses/gpl-3.0.html) for open-source use, or the [Commercial License Agreement](https://ramka.dev/license/commercial) if you purchase one.

## Next steps

- [Lightbox overview](docs/lightbox.md) — guidelines and anatomy, then [Composition](docs/lightbox/composition.md).
- [Examples](examples/lightbox/photos-app.md) — live product demos and API pattern pages.
