import type { ReactNode } from 'react';

/**
 * Twenty years in one scroll: the lightbox lineage as a vertical timeline.
 * Static and server-rendered; every date is verified against the source
 * linked in the article body.
 */

type Entry = { year: string; title: string; body: ReactNode };

const ENTRIES: Entry[] = [
  {
    year: 'Before the web',
    title: 'The light table',
    body: 'Photographers sort slides on a box of even white light, loupe in hand. Dark room, lit picture.',
  },
  {
    year: 'Dec 2005',
    title: 'Lightbox.js',
    body: 'Lokesh Dhakar overlays full-size photos on his blog instead of resizing them, and emails a few design bloggers.',
  },
  {
    year: 'Jan 2006',
    title: 'The snowball',
    body: 'WIRED writes it up within a week; del.icio.us does the rest. The name starts to outgrow the script.',
  },
  {
    year: 'Apr 2006',
    title: 'Thickbox',
    body: 'Cody Lindley\u2019s jQuery take, announced by John Resig on the official jQuery blog. The clone era opens.',
  },
  {
    year: '2006\u20132009',
    title: 'Everything-box',
    body: 'Slimbox (Oct 2006), Fancybox (Apr 2008), Colorbox (Mar 2009), plus prettyPhoto, Greybox, Shadowbox, Highslide. By April 2008 one comparison table tracks more than 30 clones.',
  },
  {
    year: '2011',
    title: 'PhotoSwipe',
    body: 'A Manchester digital agency builds the first famous touch-first gallery. Swipe, pinch and momentum become table stakes.',
  },
  {
    year: 'Mar 2014',
    title: 'The handoff',
    body: 'PhotoSwipe passes to Dmitry Semenov, author of Magnific Popup. Months later Chrome ships the <dialog> element.',
  },
  {
    year: 'Aug 2014',
    title: 'The Wikipedia crisis',
    body: 'Wikimedia\u2019s MediaViewer rollout triggers the superprotect standoff. A lightbox becomes a governance question.',
  },
  {
    year: '2019',
    title: 'CSS scroll snap',
    body: 'The gallery half of the pattern, snapping a scroller one photo at a time, becomes a platform feature.',
  },
  {
    year: 'Mar 2022',
    title: '<dialog> everywhere',
    body: 'Safari 15.4 and Firefox 98 ship it weeks apart. The modal half of the pattern is now an HTML element with a ::backdrop.',
  },
  {
    year: 'Now',
    title: 'The headless era',
    body: 'The behavior comes from a library; the markup and every visible pixel belong to the application.',
  },
];

export function LightboxTimeline() {
  return (
    <figure className="my-8">
      <ol className="relative ml-1 border-l border-neutral-200 dark:border-neutral-800">
        {ENTRIES.map((entry) => (
          <li key={entry.title} className="relative pb-7 pl-6 last:pb-1">
            <span
              aria-hidden="true"
              className="absolute top-1.5 -left-[4.5px] size-2 rounded-full bg-neutral-300 ring-4 ring-white dark:bg-neutral-600 dark:ring-neutral-950"
            />
            <div className="text-[12px] font-medium tracking-wide text-neutral-400 uppercase dark:text-neutral-500">
              {entry.year}
            </div>
            <div className="mt-0.5 text-[15px] font-semibold text-neutral-900 dark:text-neutral-50">{entry.title}</div>
            <p className="mt-1 text-[13.5px] leading-6 text-neutral-500 dark:text-neutral-400">{entry.body}</p>
          </li>
        ))}
      </ol>
    </figure>
  );
}
