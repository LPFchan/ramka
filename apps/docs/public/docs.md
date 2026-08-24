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
    <Lightbox.Content>
      <Lightbox.Slides>
        {items.map((item, i) => (
          <Lightbox.Slide key={item.id}>
            <Lightbox.Item index={i} caption={item.caption ?? item.alt}>
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
    </Lightbox.Content>
  </Lightbox.Portal>
</Lightbox.Root>
```

## Next steps

- [Lightbox overview](docs/lightbox.md) — guidelines and anatomy, then [Composition](docs/lightbox/composition.md).
- [Examples](examples/lightbox/photos-app.md) — live product demos and API pattern pages.
