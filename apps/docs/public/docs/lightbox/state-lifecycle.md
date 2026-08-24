# State & lifecycle

Control open state and the active index from React, `createHandle()`, or both — and know when callbacks fire. Part of [Lightbox](docs/lightbox.md).

## Controlled state

Pass `open` / `onOpenChange` and `value` / `onValueChange` on [Root](docs/lightbox/api.md#api-root) to drive the lightbox from URL params, a store, or sibling UI. Omit them for uncontrolled defaults ( `defaultOpen` / `defaultValue`).

```tsx Controlled open + value
import * as Lightbox from '@ramka/react/lightbox';

<Lightbox.Root open={open} onOpenChange={setOpen} value={value} onValueChange={setValue}>
  {/* triggers + content */}
</Lightbox.Root>
```

## Imperative API

[Lightbox.createHandle()](docs/lightbox/api.md#api-create-handle) lets Triggers and Root live apart — pass the same handle to both. Call `open(index, { triggerId })` from any button so the open still morphs from the matching [Trigger](docs/lightbox/api.md#api-trigger).

```tsx createHandle
import * as Lightbox from '@ramka/react/lightbox';

const lightbox = Lightbox.createHandle();

<>
  <button type="button" onClick={() => lightbox.open(0, { triggerId: 'photo-0' })}>
    View gallery
  </button>

  {images.map((img, i) => (
    <Lightbox.Trigger key={img.id} handle={lightbox} id={`photo-${i}`} index={i}>
      <img src={img.src} alt={img.alt} />
    </Lightbox.Trigger>
  ))}

  <Lightbox.Root handle={lightbox}>
    <Lightbox.Portal>
      <Lightbox.Backdrop />
      <Lightbox.Content>
        <Lightbox.Slides>
          {images.map((img, i) => (
            <Lightbox.Slide key={img.id}>
              <Lightbox.Item index={i}>
                <Lightbox.Zoom>
                  <Lightbox.Media>
                    <img src={img.src} alt={img.alt} />
                  </Lightbox.Media>
                </Lightbox.Zoom>
              </Lightbox.Item>
            </Lightbox.Slide>
          ))}
        </Lightbox.Slides>
        <Lightbox.Close aria-label="Close" />
      </Lightbox.Content>
    </Lightbox.Portal>
  </Lightbox.Root>
</>
```

## Lifecycle callbacks

`onOpenChange` fires immediately when open flips — use it to sync URL or external state. `onOpenChangeComplete` fires after enter/exit motion settles — use it for cleanup and focus. `onValueChange` reports the new index plus a [NavigationSource](docs/lightbox/api.md#types) (including `imperative` for handle navigation).

```tsx Lifecycle callbacks
import * as Lightbox from '@ramka/react/lightbox';

<Lightbox.Root
  onOpenChange={(open) => {
    // Fires immediately — sync URL / store here.
    void open;
  }}
  onOpenChangeComplete={(open) => {
    // Fires after enter/exit motion settles — cleanup / focus here.
    void open;
  }}
  onValueChange={(value, { source }) => {
    void value;
    void source; // 'trigger' | 'keyboard' | 'thumbnail' | 'button' | 'scroll' | 'imperative'
  }}
>
  {/* … */}
</Lightbox.Root>
```

## onBeforeOpen

When View Transitions are on, open is *prepare → optional image decode → optional onBeforeOpen → morph*. Use [Root](docs/lightbox/api.md#api-root) ’s `onBeforeOpen` to delay the morph until custom media is ready (iframe `load`, video, WebGL, …). It runs after the lightbox is mounted hidden — so destination nodes exist — and before `startViewTransition`.

Keep `awaitImageDecode` for photos (default `true`). For non-image destinations, pass `awaitImageDecode={false}` and wait in `onBeforeOpen`. Bound your own timeout; `ctx.signal` aborts if a newer open/close wins. See [3D models](examples/lightbox/3d-models.md).

## onBeforeClose

`onBeforeClose` fires synchronously when close begins — and, with View Transitions, *before* the old snapshot is captured. Use it to freeze custom media (`video.pause()`, stop a rAF loop) so the close morph isn’t a mid-frame. Unlike `onBeforeOpen`, it cannot delay close. `onOpenChange(false)` is too late for this: it runs inside the transition callback, after the snapshot.
