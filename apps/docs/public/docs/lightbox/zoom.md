# Zoom & a11y

How ramka’s zoom & pan — on desktop and on touch — lines up with mainstream image viewers, and how it maps to WCAG 2.2. For the wiring and gesture ownership, see [Gestures](docs/lightbox/gestures.md).

## Desktop conventions

Desktop image viewers split into two families, depending on whether the surface is treated as a *media viewer* or a *canvas / document*:

- **Media-viewer model** (Google Photos, Lightroom, PhotoSwipe, OpenSeadragon): a bare scroll wheel zooms toward the cursor; drag pans.
- **Canvas / document model** (Figma, macOS Preview, Google Maps on trackpad): a bare scroll pans, and zoom is gated behind a modifier (Ctrl / ) or a trackpad pinch — so it never hijacks the user’s scroll.

Regardless of family, four things are near-universal: **drag pans** when zoomed, **wheel/pinch zoom is focal** (zooms toward the pointer), **double-click toggles** zoom, and **Ctrl /+wheel and trackpad pinch always zoom**. The only real disagreement is whether a *bare* wheel zooms or pans.

| App | Bare scroll | Ctrl /+wheel · pinch | Double-click | Drag |
| --- | --- | --- | --- | --- |
| macOS Preview | Pan / scroll | Zoom (pinch) | Smart-zoom toggle | Pan |
| Apple Photos (Mac) | — | Zoom (pinch) | Toggle 1×↔zoom | Pan |
| Windows Photos | Navigate | Zoom (Ctrl+wheel) | Toggle | Pan |
| Google Photos (web) | Zoom to cursor | Zoom | Toggle | Pan |
| Google Maps | Zoom to cursor | Zoom | Zoom-in step | Pan |
| PhotoSwipe v5 | Opt-in (wheelToZoom) | Zoom (pinch) | Toggle | Pan |
| OpenSeadragon | Zoom to cursor | Zoom | Zoom-in step | Pan |
| Lightroom | Zoom | Zoom | Toggle 1:1 | Pan |
| Figma / Miro (canvas) | Pan | Zoom to cursor | — | Pan (space) |

## ramka on desktop

ramka defaults to the canvas model: Ctrl /+wheel and trackpad pinch zoom to the cursor, a bare wheel is a no-op at 1× (and pans when zoomed), and `scrollToZoom` on [Zoom](docs/lightbox/api.md#api-zoom) opts into the media-viewer behavior. That is the more embed-friendly default — a lightbox often lives inside a scrollable page, so bare-wheel zoom risks trapping the user’s scroll.

| Interaction | ramka | Consensus | Verdict |
| --- | --- | --- | --- |
| Trackpad pinch | Zooms to cursor (Safari GestureEvent; Chrome/FF via ctrlKey+wheel); elastic past bounds, snaps back | Zoom to cursor | Match, cross-browser |
| Ctrl / ⌘ + wheel | Zooms, focal at cursor; hard-clamped at min/max (not a rubber-band pinch) | Zoom to cursor | Match |
| Bare scroll wheel | Off by default (scrollToZoom=false): no-op at 1×, pans when zoomed | Split — media viewers zoom, canvas apps pan | Defensible default; opt-in covers the other |
| Double-click | Toggles zoom, focal at cursor | Toggle, focal | Match |
| Drag to pan | Yes — grab / grabbing cursor, elastic + momentum | Universal | Match |
| Wheel to pan (zoomed) | Yes (deltaX / deltaY) | Common | Match |
| Zoom buttons | ZoomIn / ZoomOut, step ×2 | Common | Zooms about center, not cursor |
| Keyboard zoom | + = − _ and ⌘/Ctrl+0 | Expected | Match |
| Keyboard pan | Arrows pan (50px) when zoomed | Expected | Match |
| Max zoom | Auto-capped to image's native resolution (fallback 4×) | Best practice (avoids blur) | Better than many |
| Cursor at 1× | No zoom-in affordance (consumer CSS) | Some apps show a zoom-in cursor | Minor discoverability gap |

The one intentional inconsistency: [ZoomIn](docs/lightbox/api.md#api-zoom-in) / [ZoomOut](docs/lightbox/api.md#api-zoom-out) zoom about the center rather than the cursor. That is standard — buttons have no pointer position — and matches Google Maps / OpenSeadragon button behavior.

## Mobile conventions

Touch is far more uniform than desktop — every mainstream photo viewer converges on the same model, set by iOS Photos and Android’s Google Photos:

- **Pinch to zoom**, focal at the pinch midpoint — the image stays glued to the centroid, so spreading and sliding two fingers zoom and pan as one gesture — with a *rubber-band* overshoot past the min/max that snaps back on release.
- **Double-tap** toggles between fit and a zoomed level, centered on the tap point.
- **One- or two-finger drag pans** while zoomed, with **inertia / momentum** on release.
- At fit, a **horizontal swipe navigates** and a **downward swipe dismisses** the viewer.

The subtle-but-critical part is arbitration: pinch, pan, swipe-to-navigate, and swipe-to-dismiss all start from the same finger, so a viewer has to decide which gesture owns a given touch without misfiring.

| App | Pinch | Double-tap | Pan | Momentum | Swipe down |
| --- | --- | --- | --- | --- | --- |
| iOS Photos | Focal, rubber-band | Toggle at tap | 1-finger drag | Yes + overscroll | Dismiss |
| Android Google Photos | Focal, rubber-band | Toggle at tap | 1-finger drag | Yes | Dismiss |
| Instagram | Focal (peek), snaps back | Like (not zoom) | While pinched | No | Dismiss |
| Mobile Safari (page) | Focal | Toggle (smart) | 1-finger drag | Yes | — |
| PhotoSwipe (mobile) | Focal, rubber-band | Toggle at tap | 1-finger drag | Yes | Dismiss |
| Telegram / WhatsApp | Focal | Toggle at tap | 1-finger drag | Yes | Dismiss |

## ramka on mobile

ramka implements the full iOS/Android touch model, including the arbitration details that make it feel native — deferred double-tap commit (so a flick that starts near the last tap never zooms by mistake), elastic overscroll on both pinch and pan, momentum with bound-clamping, and a haptic tick on snap-back. Pull-to-dismiss and zoom/pan share a [navigation lock](docs/lightbox/gestures.md#matrix) so an in-flight Slides fling can’t be hijacked mid-scroll.

| Interaction | ramka | Consensus | Verdict |
| --- | --- | --- | --- |
| Pinch to zoom | Focal at pinch midpoint; image follows the centroid (pinch + pan together); elastic past bounds, snaps back with haptic tick | Focal + rubber-band | Match |
| Double-tap | Toggles zoom, focal at tap; commit deferred to pointerup so a flick never misfires | Toggle at tap | Match (robust detection) |
| 1-finger pan (zoomed) | Elastic drag; velocity tracked | Universal | Match |
| 2-finger pan (zoomed) | Centroid pans immediately; zoom stays frozen until fingers actually pinch (iOS-style recognizer slop), then scale rebases so jitter never pops | iOS Photos / pinch-pan | Match |
| Release with velocity | Momentum pan (decelerates, clamps to bounds) | iOS/Android inertia | Match |
| Swipe left / right | Navigates via Slides snap carousel (only at 1×) | Navigate photos | Match |
| Swipe down | Pull-to-dismiss; blocked while zoomed > 1× | Dismiss | Match |
| touch-action | none when zoomed; pan-x pan-y at 1× (lets Slides + page own the swipe) | Guard native gestures | Correct |
| Native page pinch-zoom | Suppressed while Content is open so it never fights Lightbox.Zoom | Prevent conflict | Match |
| Haptics | Light tick on snap-back | iOS rubber-band feel | Better than many |

The touch model is where ramka is strongest — it matches the platform viewers point-for-point and adds haptics that most web lightboxes skip. Note that Instagram-style *pinch-to-peek* (zoom only holds while fingers are down, then springs back to fit) is a deliberate product choice, not the default; ramka keeps the zoom level after release like Photos, which is the right behavior for a general-purpose viewer.

## UX heuristics

- **Zoom to the cursor.** The single most important pointer-zoom heuristic. ramka honors it for wheel, pinch, and double-click.
- **Don’t hijack bare scroll by default.** Keeping `scrollToZoom` off is the safer default for embedded lightboxes; enable it for full-bleed, single-image viewers.
- **Signal zoomability at rest.** Consider a `zoom-in` cursor over the image at 1× so mouse-only users discover double-click / Ctrl-wheel zoom. ramka leaves this to your CSS — the [Zoom](docs/lightbox/api.md#api-zoom) surface exposes `data-zoom` only while scaled past 1×. Set `cursor: zoom-in` on your Zoom class — ramka’s inline cursor (grab / grabbing) wins once scaled:

```css
/* .my-zoom is the className you pass to Lightbox.Zoom */
.my-zoom {
  cursor: zoom-in;
}
```

- **Never steal swipe-to-dismiss.** On touch, pan must only take over *after* the image is zoomed; at fit, the vertical swipe belongs to pull-to-dismiss and the horizontal swipe to navigation. ramka gates this with `touch-action` and the navigation lock.
- **Rubber-band, don’t hard-stop.** Elastic overscroll on pinch and pan (plus a haptic tick on snap-back) is what makes zoom feel native rather than mechanical.
- **Size touch controls for fingers.** Give [ZoomIn](docs/lightbox/api.md#api-zoom-in) / [ZoomOut](docs/lightbox/api.md#api-zoom-out) and [Close](docs/lightbox/api.md#api-close) a hit area of at least 44×44 px on touch (WCAG 2.5.8 asks ≥24 px; 44 px is the platform norm).

## WCAG conformance

These are the WCAG 2.2 success criteria that govern zoom & pan. ramka ships the pointer and keyboard alternatives the criteria expect:

| Success criterion | Level | Applies to | ramka |
| --- | --- | --- | --- |
| [2.5.1 Pointer Gestures](https://www.w3.org/WAI/WCAG22/Understanding/pointer-gestures.html) | A | Pinch (touch + trackpad) is a multipoint gesture — needs a single-pointer alternative. | **Pass.** Double-tap / double-click and the ZoomIn / ZoomOut buttons are all single-pointer. |
| [2.5.7 Dragging Movements](https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html) | AA | Pan is drag-based and ramka implements its own pan (preventDefaults wheel), so the author-content clause applies. | **Partial.** Keyboard arrows + wheel-pan exist, but a strict single-pointer, non-drag pan alternative (e.g. pan controls) is not built in. See note below. |
| [2.1.1 Keyboard](https://www.w3.org/WAI/WCAG22/Understanding/keyboard.html) | A | All zoom/pan must be reachable by keyboard. | **Pass.** +/−/0 and arrows route through the active-zoom bridge in Content. |
| [2.5.8 Target Size (Minimum)](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html) | AA | Zoom / close controls should be ≥24×24 CSS px (44 px is the touch norm). | **Consumer.** Sizing is your CSS in a headless library — a guidance item, not a library defect. |

**Note on 2.5.7.** Pan-by-drag has a keyboard alternative (arrows), which satisfies [2.1.1 Keyboard](https://www.w3.org/WAI/WCAG22/Understanding/keyboard.html), but 2.5.7 specifically wants a *single-pointer, non-drag* alternative — keyboard does not count for it. If you must meet AA strictly, add pointer pan controls (e.g. edge/arrow buttons) alongside [ZoomIn](docs/lightbox/api.md#api-zoom-in) / [ZoomOut](docs/lightbox/api.md#api-zoom-out). Many shipping viewers do not either, but for enterprise targets it is worth flagging.
