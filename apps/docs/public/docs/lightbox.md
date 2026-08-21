# Lightbox

Accessible primitives for fullscreen media lightboxes — compound parts in the style of Base UI and Radix. Cosmetically unstyled: you own colors, chrome, and radius values. Ramka owns state, focus, gestures, morphs, and structural styles required for those mechanics.

## Usage guidelines

Work through these decisions in order:

1. **State** — controlled props, createHandle, or both? See [State & lifecycle](docs/lightbox/state-lifecycle.md).
2. **Layout** — default to the swipe carousel ( [Slides + Zoom](docs/lightbox/composition.md#slides) ). See [Composition](docs/lightbox/composition.md).
3. **Morph** — on by default; wrap destination media in `Lightbox.Media` (and `imageRef` on Trigger thumbs), choose `crossfade` / `morphTo`, or pass `viewTransition={false}` to opt out. See [View transitions](docs/lightbox/view-transitions.md).
4. **Gestures** — pull-to-dismiss on Content, Zoom on media, keyboard on Content. See [Gestures](docs/lightbox/gestures.md).
5. **Cosmetics vs mechanics** — colors, chrome, and radius *values* are yours. Structural styles (view-transition morph CSS, morph host box, zoom overflow, slide snap alignment, placeholders) are applied by the library or via Media `width` /`height`; slide track width (full-bleed vs snug cards) is consumer CSS — see [Composition → Slides + Zoom](docs/lightbox/composition.md#slides). Style with documented `data-*` attributes and CSS variables from the [API reference](docs/lightbox/api.md).

## Anatomy

Import the namespace and compose parts. The sketch below is the default gallery shape (Slides + Zoom + chrome). Every part is optional except Root for state.

```tsx Anatomy
import * as Lightbox from 'ramka/lightbox';

<Lightbox.Root>
  <Lightbox.Trigger index={0}>{/* thumb */}</Lightbox.Trigger>
  <Lightbox.Portal>
    <Lightbox.Backdrop />
    <Lightbox.Content>
      <Lightbox.Slides>
        <Lightbox.Slide>
          <Lightbox.Item index={0}>
            <Lightbox.Zoom>
              <Lightbox.Media>
                <img alt="" />
              </Lightbox.Media>
            </Lightbox.Zoom>
          </Lightbox.Item>
        </Lightbox.Slide>
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

- [State & lifecycle](docs/lightbox/state-lifecycle.md): Controlled open/index, createHandle, and open-change callbacks.
- [Composition](docs/lightbox/composition.md): Slides + Zoom chrome, media fill / fit-box sizing, and itemCount.
- [Next.js Image](docs/lightbox/nextjs-image.md): next/image with Ramka — destination blur only when that item has no trigger image.
- [View transitions](docs/lightbox/view-transitions.md): Morph refs (on by default), crossfade, morphTo, and scrollTriggerIntoView.
- [Gestures](docs/lightbox/gestures.md): Pull-to-dismiss, zoom bridge, keyboard, and what wins when.
- [API reference](docs/lightbox/api.md): Props, data attributes, and CSS variables for every part.

Browse product demos under [Examples](examples/lightbox/photos-app.md). Guides above are canonical for behavior; examples are compositions.
