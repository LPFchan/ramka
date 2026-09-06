import type { StaticImageData } from 'next/image';

// Static imports (not the download-images generator) — this example reuses the
// photo assets downloaded for the URL-synced state example, so there is no
// per-example image set to generate.
import p1 from '../../../../_assets/photos/mb-01.jpg';
import p2 from '../../../../_assets/photos/mb-02.jpg';
import p4 from '../../../../_assets/photos/mb-04.jpg';
import p5 from '../../../../_assets/photos/mb-05.jpg';
import p7 from '../../../../_assets/photos/mb-07.jpg';
import p8 from '../../../../_assets/photos/mb-08.jpg';
import p10 from '../../../../_assets/photos/mb-10.jpg';
import p11 from '../../../../_assets/photos/mb-11.jpg';

/**
 * Shared photo catalogue for the intercepted-routes example. One list serves
 * the grid page, the intercepted modal route, and the standalone photo page
 * (`photos/[id]/page.tsx`), so a photo's URL can never drift from its slide.
 */
export interface InterceptedPhoto {
  /**
   * URL segment for the photo route (`…/intercepted-routes/photos/5`). A
   * stable id looked up by value — never by array position — so reordering
   * or removing photos can't repoint existing links.
   */
  id: string;
  alt: string;
  caption: string;
  image: StaticImageData;
}

export const EXAMPLE_BASE_PATH = '/examples/lightbox/intercepted-routes';

export const EXAMPLE_PAGE_TITLE = 'Intercepted routes example';

export function interceptedPhotoTitle(photo: InterceptedPhoto): string {
  return `${photo.caption} — ${EXAMPLE_PAGE_TITLE}`;
}

export const interceptedPhotos: InterceptedPhoto[] = (
  [
    { id: '1', alt: 'Foggy pine ridge at dawn', caption: 'Dawn ridge' },
    { id: '2', alt: 'Empty coastal highway', caption: 'Open road' },
    { id: '3', alt: 'Narrow sunlit alley', caption: 'Warm alley' },
    { id: '4', alt: 'Wide desert dunes', caption: 'Dunes' },
    { id: '5', alt: 'Calm lake reflection', caption: 'Still water' },
    { id: '6', alt: 'Tall concrete staircase', caption: 'Ascent' },
    { id: '7', alt: 'Panoramic city skyline at dusk', caption: 'Dusk skyline' },
    { id: '8', alt: 'Single tree in a green field', caption: 'Lone tree' },
  ] as const
).map((photo, i) => ({ ...photo, image: [p1, p2, p4, p5, p7, p8, p10, p11][i]! }));
