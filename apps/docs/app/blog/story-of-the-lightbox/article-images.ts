/**
 * Every historical artifact embedded in the article, in reading order. One
 * manifest feeds both sides of the lightbox: the in-article `Shot` triggers
 * and the fullscreen viewer's slides, so index/dims/captions can't drift.
 */
export type ArticleImage = {
  id: string;
  src: string;
  width: number;
  height: number;
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
    src: '/blog/story-of-the-lightbox/light-table.jpg',
    width: 1600,
    height: 2133,
    alt: 'Vintage Kodachrome and Ektachrome slides in cardboard mounts with handwritten labels, glowing on a light table in a dim room',
    caption: 'The original lightbox: slides on a light table. Photo by Priscilla Du Preez on Unsplash',
    label: 'the first lightbox',
  },
  {
    id: 'slide-sorter',
    src: '/blog/story-of-the-lightbox/slide-sorter.jpg',
    width: 1600,
    height: 2133,
    alt: 'A hand holding a Kodachrome slide in front of a backlit E-Z-View slide sorter in a dark room',
    caption: 'Sorting Kodachrome on an E-Z-View slide sorter. Photo by Priscilla Du Preez on Unsplash',
    label: 'the sorter',
  },
  {
    id: 'kodachrome-pile',
    src: '/blog/story-of-the-lightbox/kodachrome-pile.jpg',
    width: 1600,
    height: 1067,
    alt: 'A pile of Kodachrome and Ektachrome transparencies in Technicolor cardboard mounts spilling out of a wooden box',
    caption: 'Kodachrome and Technicolor mounts, by the boxful. Photo by Jason Leung on Unsplash',
    label: 'by the boxful',
  },
  {
    id: 'film-desk',
    src: '/blog/story-of-the-lightbox/film-desk.jpg',
    width: 1600,
    height: 1067,
    alt: 'A film photography desk in a dim room: a Contax camera and lenses beside a glowing light table holding film strips and a loupe, with scans on a monitor behind',
    caption: 'The desk version, loupe included. Photo by Jakub \u017Berdzicki on Unsplash',
    label: 'loupe included',
  },
] as const satisfies readonly ArticleImage[];

export const ARTICLE_IMAGES = [
  {
    id: 'lokesh',
    src: '/blog/story-of-the-lightbox/lokesh.jpg',
    width: 400,
    height: 400,
    alt: 'Lokesh Dhakar smiling in the sun, wearing a dark cap, clear glasses and a grey sweatshirt, arms crossed, in front of a green wooden wall',
    caption: 'Lokesh Dhakar, who named the pattern. Profile photo from x.com/lokesh',
  },
  {
    id: 'original-2006',
    src: '/blog/story-of-the-lightbox/original-2006.png',
    width: 2000,
    height: 2966,
    alt: 'The original Lightbox JS project page from January 2006: overview, two example thumbnails, how-to-use instructions with rel=lightbox, CSS customization snippets, and a downloads list of lightbox.js, lightbox.css, overlay.png and loading.gif',
    caption: 'The original Lightbox JS project page: huddletogether.com, January 2006, via the Wayback Machine',
  },
  {
    id: 'coffee-drinks',
    src: '/blog/story-of-the-lightbox/coffee-drinks.png',
    width: 1934,
    height: 2300,
    alt: 'Coffee Drinks Illustrated: nine minimalist cup diagrams by Lokesh Dhakar showing the layered ingredients of espresso, macchiato, con panna, latte, flat white, breve, cappuccino, mocha and americano',
    caption: 'Coffee Drinks Illustrated by Lokesh Dhakar, CC BY-NC 3.0',
  },
  {
    id: 'lightbox2-live',
    src: '/blog/story-of-the-lightbox/lightbox2-live.jpg',
    width: 2200,
    height: 1600,
    alt: 'The Lightbox2 demo site photographed in 2026 with the lightbox open: a photo of a woman looking out over a park, a Four Image Set caption, a close button, and a banner advertising Lightbox 3 as zero dependencies, fluid animations, built for touch',
    caption: 'The Lightbox2 demo page, photographed live in 2026',
  },
  {
    id: 'clone-matrix',
    src: '/blog/story-of-the-lightbox/clone-matrix.png',
    width: 1440,
    height: 1565,
    alt: 'The Lightbox Clones Matrix: a huge comparison table of sixty lightbox scripts with columns for size in kilobytes, JavaScript library dependency, and supported content types',
    caption: 'The Lightbox Clones Matrix at planetozh.com, still online today',
  },
  {
    id: 'magnific-deprecated',
    src: '/blog/story-of-the-lightbox/magnific-deprecated.png',
    width: 2200,
    height: 1240,
    alt: 'The Magnific Popup homepage with its red-brush header and an important note announcing the jQuery plugin is deprecated, recommending the native dialog element for basic popups or PhotoSwipe for advanced image galleries',
    caption: 'Magnific Popup\u2019s deprecation notice on dimsemenov.com',
  },
  {
    id: 'mediaviewer-live',
    src: '/blog/story-of-the-lightbox/mediaviewer-live.jpg',
    width: 2560,
    height: 1600,
    alt: "Wikipedia's MediaViewer open on the Apollo 11 article, showing a photo of President Kennedy speaking at Rice University in 1962, with a 4 of 35 counter, previous and next arrows, a caption bar and a More details button",
    caption: 'Wikipedia\u2019s MediaViewer on the Apollo 11 article, photographed in 2026',
  },
] as const satisfies readonly ArticleImage[];

export type ArticleImageId = (typeof ARTICLE_IMAGES)[number]['id'];
