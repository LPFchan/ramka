# Next.js Image

Use `next/image` with Ramka. Lightbox-side blur depends on whether that item has a trigger image. Part of [Lightbox](docs/lightbox.md).

The demos on this page intentionally delay every full-size lightbox image by ~500ms and bypass the browser cache on each open, so you can watch the placeholder mechanisms work on every open — no DevTools throttling needed.

## When to use blurDataURL

Decide **per item index**, not per gallery. Ramka paints an open bridge only when that index has a registered trigger image (`imageRef`).

| Image | `placeholder="blur"` | Why |
| --- | --- | --- |
| Image inside `Lightbox.Trigger` | Yes | A regular page image — the LQIP covers its own load. Ramka never paints a placeholder here. |
| Image inside `Lightbox.Thumbnail` | Yes | Same as a trigger: a regular page image. Ramka bridges only the destination media, never strip thumbnails, so the LQIP is the only thing covering the thumb’s own load. |
| Lightbox image, index *has* a trigger image ( `imageRef`) | No | While the full-size image loads, Ramka paints the trigger’s image — already decoded and on screen — onto a canvas *behind* the lightbox image. Next’s LQIP renders as a background on the lightbox image itself, in front of that canvas, so blur here hides a sharp placeholder behind a blurry one. |
| Lightbox image, index has *no* trigger image | Yes | Ramka has no trigger image to paint, so the LQIP is the only loading placeholder (see [No trigger image](#no-trigger-image)). |

**One exception:** pages that server-render the lightbox already open (deep links). The bridge is painted on gesture opens — a server-rendered open has no gesture, and before hydration nothing is decoded to paint from — while `blurDataURL` is inlined into the server HTML itself. For those visits, destination blur is the only placeholder that can exist on first paint: enable it for the deep-link visit and keep destinations clean for regular visits (decide once per mount, like the portal container). See the URL-synced state example.

## Do

Static-import the same asset for trigger and destination (Next fills in `blurDataURL`). Blur the trigger; leave the destination clean. Square trigger crop is CSS only — keep source aspect matched to Media. See [View transitions → Source aspect](docs/lightbox/view-transitions.md#source-aspect) for a live Do / Don't.

```tsx Do — blur on trigger only
import * as Lightbox from '@ramka/react/lightbox';

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
                <Image
                  src={photo}
                  alt="Photo"
                  sizes="100vw"
                  priority
                  // No placeholder — Ramka owns the open bridge.
                />
              </Lightbox.Media>
            </Lightbox.Zoom>
          </Lightbox.Item>
        </Lightbox.Slide>
      </Lightbox.Slides>
    </Lightbox.Content>
  </Lightbox.Portal>
</Lightbox.Root>
```

## Don’t

`placeholder="blur"` on a lightbox image whose index has a trigger image covers Ramka’s bridge with Next’s LQIP while the full image loads.

```tsx Don’t — blur on lightbox Image
import * as Lightbox from '@ramka/react/lightbox';

<Lightbox.Root>
  <Lightbox.Trigger index={0}>
    {({ imageRef }) => (
      <Image ref={imageRef} src={photo} alt="Photo" className="aspect-square size-full object-cover" />
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
                <Image
                  src={photo}
                  alt="Photo"
                  sizes="100vw"
                  priority
                  // ❌ Covers Ramka’s thumb bridge.
                  placeholder="blur"
                />
              </Lightbox.Media>
            </Lightbox.Zoom>
          </Lightbox.Item>
        </Lightbox.Slide>
      </Lightbox.Slides>
    </Lightbox.Content>
  </Lightbox.Portal>
</Lightbox.Root>
```

## No trigger image

If an index has no trigger `imageRef`, Ramka has nothing to paint. Use destination `placeholder="blur"` for those items only — not for siblings that still have a trigger image.

### +N extras

Open the +N tile, then swipe past the triggered photos. Overflow slides show Next’s LQIP; indexes 0–1 stay on Ramka’s trigger-image bridge. Close uses [morphTo="closest"](docs/lightbox/view-transitions.md#morph-to).

```tsx Destination blur for +N extras
import * as Lightbox from '@ramka/react/lightbox';

<Lightbox.Root morphTo="closest">
  {photos.slice(0, visible).map((photo, i) => (
    <Lightbox.Trigger key={photo.src} index={i} crossfade={i === visible - 1 ? 'both' : undefined}>
      {({ imageRef }) => <Image ref={imageRef} src={photo} alt="" placeholder="blur" />}
    </Lightbox.Trigger>
  ))}

  <Lightbox.Portal>
    <Lightbox.Backdrop />
    <Lightbox.Content>
      <Lightbox.Slides>
        {photos.map((photo, i) => (
          <Lightbox.Slide key={photo.src}>
            <Lightbox.Item index={i}>
              <Lightbox.Zoom>
                <Lightbox.Media width={photo.width} height={photo.height}>
                  <Image
                    src={photo}
                    alt=""
                    sizes="100vw"
                    priority
                    // Overflow indexes only — siblings with trigger thumbs stay clean.
                    {...(i >= visible ? { placeholder: 'blur' as const } : null)}
                  />
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

### Non-image trigger

Initials / swatches have a Trigger but no trigger image. Blur on the lightbox image is the loading placeholder.

```tsx Destination blur for non-image triggers
import * as Lightbox from '@ramka/react/lightbox';

<Lightbox.Root>
  <Lightbox.Trigger index={0} crossfade="both">
    <div className="flex size-16 items-center justify-center rounded-full bg-sky-700 text-white">AC</div>
  </Lightbox.Trigger>

  <Lightbox.Portal>
    <Lightbox.Backdrop />
    <Lightbox.Content>
      <Lightbox.Slides>
        <Lightbox.Slide>
          <Lightbox.Item index={0}>
            <Lightbox.Zoom>
              <Lightbox.Media width={photo.width} height={photo.height}>
                <Image src={photo} alt="Portrait" sizes="100vw" priority placeholder="blur" />
              </Lightbox.Media>
            </Lightbox.Zoom>
          </Lightbox.Item>
        </Lightbox.Slide>
      </Lightbox.Slides>
    </Lightbox.Content>
  </Lightbox.Portal>
</Lightbox.Root>
```

## Checklist

- Per index: trigger image → no destination blur; no trigger image → destination blur OK
- Match Media `width` /`height` to the image source aspect
- Trigger and destination must share that intrinsic aspect (CSS-crop the tile; don't serve a differently-cropped file) — [Source aspect](docs/lightbox/view-transitions.md#source-aspect)
- Trigger: `imageRef` (or [useLightboxTriggerContext](docs/lightbox/api.md#api-use-trigger-context)); blur OK on the trigger image
- `ThumbnailStrip` thumbs are regular images — blur OK, same as triggers
- Prefer `priority` on the open destination — see [View transitions](docs/lightbox/view-transitions.md)
- `sizes="100vw"` for fullscreen
- Skip `fill` / `size-full` — Media already fills a direct Image child
