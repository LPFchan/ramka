# Photos app (RTL)

The same photos app mirrored for a right-to-left locale — dir="rtl" on Lightbox.Root mirrors navigation, the thumbnail strip, and the arrow keys.

## Source

```tsx examples/lightbox/photos-app-rtl/page.tsx
'use client';

import { PhotosAppView } from '../photos-app/photos-app-view';

/**
 * The photos app mirrored for a right-to-left locale.
 *
 * Same composition, two changes: `dir="rtl"` on `Lightbox.Root` (which mirrors
 * navigation, the thumbnail strip, and the arrow keys) and `dir="rtl"` on
 * `<html>` (which mirrors the layout). Both are needed — the prop drives
 * behavior and CSS drives paint, and the library warns in development when they
 * disagree.
 */
export default function PhotosAppRtlPage() {
  return <PhotosAppView dir="rtl" />;
}
```
