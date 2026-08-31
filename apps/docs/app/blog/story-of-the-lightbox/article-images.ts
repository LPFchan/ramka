import type { StaticImageData } from 'next/image';

import cloneMatrix from '../../../public/blog/story-of-the-lightbox/clone-matrix.png';
import coffeeDrinks from '../../../public/blog/story-of-the-lightbox/coffee-drinks.png';
import filmDesk from '../../../public/blog/story-of-the-lightbox/film-desk.jpg';
import kodachromePile from '../../../public/blog/story-of-the-lightbox/kodachrome-pile.jpg';
import lightTable from '../../../public/blog/story-of-the-lightbox/light-table.jpg';
import lightbox2Live from '../../../public/blog/story-of-the-lightbox/lightbox2-live.jpg';
import lokesh from '../../../public/blog/story-of-the-lightbox/lokesh.jpg';
import magnificDeprecated from '../../../public/blog/story-of-the-lightbox/magnific-deprecated.png';
import mediaviewerLive from '../../../public/blog/story-of-the-lightbox/mediaviewer-live.jpg';
import original2006 from '../../../public/blog/story-of-the-lightbox/original-2006.png';
import slideSorter from '../../../public/blog/story-of-the-lightbox/slide-sorter.jpg';

/**
 * Every historical artifact embedded in the article, in reading order. One
 * manifest feeds both sides of the lightbox: the in-article `Shot` triggers
 * and the fullscreen viewer's slides, so index/dims/captions can't drift.
 *
 * Images are static imports, so intrinsic `width`/`height` and a build-time
 * `blurDataURL` ride along on `src` — nothing is measured by hand, and
 * `placeholder="blur"` works out of the box. Read dims via `src.width` /
 * `src.height` where raw numbers are needed (e.g. `Lightbox.Media`).
 */
export type ArticleImage = {
  id: string;
  src: StaticImageData;
  alt: string;
  /** Plain-text caption for the fullscreen viewer (the in-article figcaption carries the links). */
  caption: string;
  /** Short handwritten-style label, penciled on the slide mount in the light-table viewer. */
  label?: string;
};

/**
 * The four photos in "The room was dark first": the hero light-table shot
 * plus three companions, opened together by the skeuomorphic light-table
 * viewer in `light-table-gallery.tsx`. All four are free-license Unsplash
 * photos, credited in the figure caption and per-slide in the viewer.
 */
export const LIGHT_TABLE_IMAGES = [
  {
    id: 'light-table',
    src: lightTable,
    alt: 'Vintage Kodachrome and Ektachrome slides in cardboard mounts with handwritten labels, glowing on a light table in a dim room',
    caption: 'The original lightbox: slides on a light table. Photo by Priscilla Du Preez on Unsplash',
    label: 'the first lightbox',
  },
  {
    id: 'slide-sorter',
    src: slideSorter,
    alt: 'A hand holding a Kodachrome slide in front of a backlit E-Z-View slide sorter in a dark room',
    caption: 'Sorting Kodachrome on an E-Z-View slide sorter. Photo by Priscilla Du Preez on Unsplash',
    label: 'the sorter',
  },
  {
    id: 'kodachrome-pile',
    src: kodachromePile,
    alt: 'A pile of Kodachrome and Ektachrome transparencies in Technicolor cardboard mounts spilling out of a wooden box',
    caption: 'Kodachrome and Technicolor mounts, by the boxful. Photo by Jason Leung on Unsplash',
    label: 'by the boxful',
  },
  {
    id: 'film-desk',
    src: filmDesk,
    alt: 'A film photography desk in a dim room: a Contax camera and lenses beside a glowing light table holding film strips and a loupe, with scans on a monitor behind',
    caption: 'The desk version, loupe included. Photo by Jakub \u017Berdzicki on Unsplash',
    label: 'loupe included',
  },
] as const satisfies readonly ArticleImage[];

export const ARTICLE_IMAGES = [
  {
    id: 'lokesh',
    src: lokesh,
    alt: 'Lokesh Dhakar smiling in the sun, wearing a dark cap, clear glasses and a grey sweatshirt, arms crossed, in front of a green wooden wall',
    caption: 'Lokesh Dhakar, who named the pattern. Profile photo from x.com/lokesh',
  },
  {
    id: 'original-2006',
    src: original2006,
    alt: 'The original Lightbox JS project page from January 2006: overview, two example thumbnails, how-to-use instructions with rel=lightbox, CSS customization snippets, and a downloads list of lightbox.js, lightbox.css, overlay.png and loading.gif',
    caption: 'The original Lightbox JS project page: huddletogether.com, January 2006, via the Wayback Machine',
  },
  {
    id: 'coffee-drinks',
    src: coffeeDrinks,
    alt: 'Coffee Drinks Illustrated: nine minimalist cup diagrams by Lokesh Dhakar showing the layered ingredients of espresso, macchiato, con panna, latte, flat white, breve, cappuccino, mocha and americano',
    caption: 'Coffee Drinks Illustrated by Lokesh Dhakar, CC BY-NC 3.0',
  },
  {
    id: 'lightbox2-live',
    src: lightbox2Live,
    alt: 'The Lightbox2 demo site photographed in 2026 with the lightbox open: a photo of a woman looking out over a park, a Four Image Set caption, a close button, and a banner advertising Lightbox 3 as zero dependencies, fluid animations, built for touch',
    caption: 'The Lightbox2 demo page, photographed live in 2026',
  },
  {
    id: 'clone-matrix',
    src: cloneMatrix,
    alt: 'The Lightbox Clones Matrix: a huge comparison table of sixty lightbox scripts with columns for size in kilobytes, JavaScript library dependency, and supported content types',
    caption: 'The Lightbox Clones Matrix at planetozh.com, still online today',
  },
  {
    id: 'magnific-deprecated',
    src: magnificDeprecated,
    alt: 'The Magnific Popup homepage with its red-brush header and an important note announcing the jQuery plugin is deprecated, recommending the native dialog element for basic popups or PhotoSwipe for advanced image galleries',
    caption: 'Magnific Popup\u2019s deprecation notice on dimsemenov.com',
  },
  {
    id: 'mediaviewer-live',
    src: mediaviewerLive,
    alt: "Wikipedia's MediaViewer open on the Apollo 11 article, showing a photo of President Kennedy speaking at Rice University in 1962, with a 4 of 35 counter, previous and next arrows, a caption bar and a More details button",
    caption: 'Wikipedia\u2019s MediaViewer on the Apollo 11 article, photographed in 2026',
  },
] as const satisfies readonly ArticleImage[];

export type ArticleImageId = (typeof ARTICLE_IMAGES)[number]['id'];
