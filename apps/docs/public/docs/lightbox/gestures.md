# Gestures

Pull-to-dismiss, zoom/pan, and keyboard ownership. Part of [Lightbox](docs/lightbox.md). For the usual gallery chrome (pull, zoom, keyboard) see the [Default preset](presets/default.md).

## Content pullToClose

Content enables pull-to-dismiss by default (`pullToClose`). Drag down (touch) or wheel-dismiss (trackpad) scales the surface and sets `data-pulling` / `data-pull-dismissing` plus `--lightbox-pull-progress` (0→1).

- Hit target is Stage-wide (or Content when Stage is omitted) — letterbox and empty Stage area can start a pull, matching trackpad wheel. Interactive controls (buttons, links, inputs, `[data-ramka-no-pull]`) keep their press. Side panels outside Stage do not start a pull.
- Disabled while zoomed above 1×, and while Slides is scrolling until `scrollend` (so a gallery swipe that turns vertical cannot pull mid-gesture).
- Backdrop is optional — when used, nest it inside [Portal](docs/lightbox/api.md#api-portal) beside Content. Pull still works if you omit Backdrop.

Open/close fades live on `.lightbox-demo-backdrop` / `.lightbox-demo-content` ( `app/lightbox-demo/open-close.css`). Pull then modulates the open scrim (media stays opaque) via `pull-progress.css`.

When a pull is released short of the threshold, the surface springs back and the library publishes `--lightbox-pull-snap-duration` / `--lightbox-pull-snap-easing` for the duration of that spring. Reference them in your `transition` (with your open/close values as the fallbacks, as below) and anything keyed to `--lightbox-pull-progress` — backdrop opacity, chrome, blur — eases back on the exact same curve and duration as the item, automatically.

```css Open / close CSS
.lightbox-demo-backdrop {
  opacity: 0;
  /* Fade duration cascade: pull snap-back vars while a dismiss springs back,
     otherwise the library-written --lightbox-vt-duration (the Root's
     `viewTransition` preset timing, always published on the Portal host —
     with or without a running morph). */
  transition: opacity
    var(--lightbox-pull-snap-duration, var(--lightbox-vt-duration, 360ms))
    var(--lightbox-pull-snap-easing, var(--ease-out-expo));
}

/* First frame when `data-open` appears — then pull-progress.css owns open opacity. */
@starting-style {
  .lightbox-demo-backdrop[data-open] {
    opacity: 0;
  }
}

.lightbox-demo-content {
  opacity: 0;
  /* --lightbox-vt-duration keeps the surface, scrim and image resolving
     together: same preset clock during a morph (documentElement) and on the
     plain fade path (Portal host). */
  transition: opacity var(--lightbox-vt-duration, 360ms) var(--ease-out-expo);
}

.lightbox-demo-content[data-open] {
  opacity: 1;
}

@starting-style {
  .lightbox-demo-content[data-open] {
    opacity: 0;
  }
}
```

```css Pull progress CSS
.lightbox-demo-backdrop[data-open] {
  /* --lightbox-pull-progress: 0 → 1 while dragging */
  opacity: calc(1 - var(--lightbox-pull-progress, 0) * 0.6);
}

.lightbox-demo-backdrop[data-pulling] {
  transition: none; /* follow the finger */
}

/*
 * Snug gallery slides — inactive cards track pull (`--lightbox-pull-progress`)
 * and zoom (`--lightbox-zoom-progress`, 0→1 by +1× above min). Zoom filter has
 * no transition (1:1 with progress); pull opacity snaps back via snap vars.
 */
/* Filter tracks pull + zoom with no transition (would lag the finger/pinch).
   Opacity still eases with pull snap-back.
   Inactive items only; `[data-active]` opts the active item back out. */
.lightbox-demo-slide-snug [data-ramka-item] {
  transition: opacity var(--lightbox-pull-snap-duration, 500ms)
    var(--lightbox-pull-snap-easing, var(--ease-out-expo));
}

.lightbox-demo-slide-snug [data-ramka-item]:not([data-active]) {
  --lb-snug-dim: max(var(--lightbox-pull-progress, 0), var(--lightbox-zoom-progress, 0));
  opacity: calc(1 - var(--lightbox-pull-progress, 0) * 0.85);
  filter: opacity(calc(1 - var(--lb-snug-dim)))
    blur(calc(var(--lb-snug-dim) * 6px));
}

.lightbox-demo-content[data-pulling] .lightbox-demo-slide-snug [data-ramka-item] {
  transition: none;
}

.lightbox-demo-content[data-zoomed] .lightbox-demo-slide-snug:has([data-ramka-item][data-active]) {
  z-index: 1;
}

/* Chrome fade — visibility keeps hidden controls out of tab order. */
.lightbox-demo-chrome-hide {
  opacity: 1;
  visibility: visible;
  transition:
    opacity 200ms,
    visibility 0s linear 0s;
}

@starting-style {
  .lightbox-demo-chrome-hide {
    opacity: 0;
  }
}

.lightbox-demo-content:is([data-pulling], [data-pull-dismissing]) .lightbox-demo-chrome-hide {
  opacity: 0;
  visibility: hidden;
  transition:
    opacity 200ms,
    visibility 0s linear 200ms;
}

.lightbox-demo-content[data-zoomed] .lightbox-demo-chrome-bottom.lightbox-demo-chrome-hide {
  opacity: 0;
  visibility: hidden;
  transition:
    opacity 200ms,
    visibility 0s linear 200ms;
}

@media (max-width: 767px) {
  .lightbox-demo-content[data-zoomed] .lightbox-demo-chrome-top.lightbox-demo-chrome-hide {
    opacity: 0;
    visibility: hidden;
    transition:
      opacity 200ms,
      visibility 0s linear 200ms;
  }
}

/* Light scrim used by LightboxGallery (shared docs viewer chrome). */
.lightbox-demo-backdrop-light {
  background-color: rgb(255 255 255 / 0.9);
}

html.dark .lightbox-demo-backdrop-light {
  background-color: rgb(0 0 0 / 0.9);
}
```

## Zoom

Wrap media in [Zoom](docs/lightbox/api.md#api-zoom) (inside Item, typically inside Slide). Prefer [Media](docs/lightbox/api.md#api-media) inside Zoom so pan / maxZoom use the sized content box. Supports pinch, pan, double-tap, ctrl/meta+wheel (or `scrollToZoom`), and keyboard pan when focused.

Zoomed media can cover the full Content surface only if Slide → Item → Zoom → Media fill that box — see [Composition → Media layout](docs/lightbox/composition.md#media-layout).

[ZoomIn](docs/lightbox/api.md#api-zoom-in) / [ZoomOut](docs/lightbox/api.md#api-zoom-out) can sit in toolbar chrome outside Zoom — they target the *active* slide via Root’s active-zoom bridge. Content reflects `data-zooming` / `data-zoomed` for styling.

```tsx Active-zoom bridge
import * as Lightbox from '@ramka/react/lightbox';

<Lightbox.Root>
  <Lightbox.Portal>
    <Lightbox.Backdrop />
    <Lightbox.Content>
      {/* Toolbar chrome — targets the active slide's Zoom */}
      <Lightbox.ZoomOut aria-label="Zoom out" />
      <Lightbox.ZoomIn aria-label="Zoom in" />

      <Lightbox.Slides>
        <Lightbox.Slide>
          <Lightbox.Item index={0}>
            <Lightbox.Zoom>
              <Lightbox.Media>
                <img src={src} alt={alt} />
              </Lightbox.Media>
            </Lightbox.Zoom>
          </Lightbox.Item>
        </Lightbox.Slide>
      </Lightbox.Slides>
    </Lightbox.Content>
  </Lightbox.Portal>
</Lightbox.Root>
```

## Keyboard & focus

[Content](docs/lightbox/api.md#api-content) is the keyboard authority while open:

- Esc — close
- — pan when zoomed, otherwise previous/next
- / / 0 or Ctrl 0 — zoom in / out / reset (active Zoom)

Focus is trapped in the dialog; closing restores focus to the opening Trigger. Native page pinch-zoom is blocked while Content is mounted so it does not fight `Lightbox.Zoom`.

## Interaction matrix

| State | Pull | Zoom chrome / buttons | Prev / Next |
| --- | --- | --- | --- |
| Idle, zoom = 1 | Allowed | Allowed | Allowed |
| Zoomed > 1 | Blocked | Allowed | Arrows pan; buttons still navigate |
| Slides flinging | Blocked | Blocked | Blocked until settle |
| Pulling | Active | Should idle | Should idle |
