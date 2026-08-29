'use client';

import * as React from 'react';
import Image from 'next/image';
import * as Lightbox from '@ramka/react/lightbox';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';

import { Lightbox as XLB, type ThreadPost } from '../../(docs)/presets/twitter/lightbox';
import { ramkaD, ramkaE, ramkaG } from '../../_components/images.generated';

import './chrome-builder.css';

/**
 * Chrome builder: a Twitter-preset-style split viewer whose pieces (post
 * sidebar, arrows, thumbnails, caption, tooltips on every stage icon button)
 * toggle on and off, with the JSX panel generated from the same booleans.
 * The point of the demo is that the viewer and the code cannot drift apart,
 * because in a composable API the markup IS the API: a piece of chrome
 * exists exactly when you render it.
 */

type Options = {
  sidebar: boolean;
  arrows: boolean;
  thumbs: boolean;
  caption: boolean;
  tooltips: boolean;
};

const DEFAULTS: Options = { sidebar: true, arrows: true, thumbs: true, caption: true, tooltips: true };

const ITEMS = [
  { src: ramkaD, alt: 'Airplane crossing a purple sky above the clouds', caption: 'Above the clouds at dusk' },
  { src: ramkaE, alt: 'Fog rolling over dark hills', caption: 'Fog rolling over the valley' },
  { src: ramkaG, alt: 'Bride seen through the windows of a vintage car', caption: 'Through the wedding car window' },
];

const POST: ThreadPost = {
  author: {
    name: 'Mia Kowalska',
    handle: 'miakow',
    avatar: 'https://i.pravatar.cc/96?u=mia-kowalska',
    verified: true,
  },
  text: 'Three frames from the weekend that I keep coming back to. The fog one is straight out of camera.',
  time: 'Aug 29, 2026 · 9:41 AM',
  stats: { replies: 42, reposts: 118, likes: 964, views: '48K' },
  replies: [
    {
      id: 'r1',
      author: { name: 'Sofia Lindgren', handle: 'sofialind', avatar: 'https://i.pravatar.cc/96?u=sofia' },
      text: 'The valley shot belongs on a wall. What lens?',
      time: '2h',
    },
    {
      id: 'r2',
      author: { name: 'James Okafor', handle: 'jamesokafor', avatar: 'https://i.pravatar.cc/96?u=james' },
      text: 'That plane window timing is unreal.',
      time: '1h',
    },
  ],
};

/* ------------------------------------------------------------------ */
/* Snippet generation: the code panel is built from the same booleans  */
/* that drive the live viewer.                                         */
/* ------------------------------------------------------------------ */

function buildSnippet(o: Options): string {
  const lines: string[] = [
    '<Lightbox.Portal>',
    '  <Lightbox.Backdrop className="…" />',
    '  <Lightbox.Content aria-label="Photos by Mia" className="…">',
    '    <Lightbox.Stage className="…">',
  ];

  if (o.tooltips) {
    lines.push(
      '      {/* wrapped in your own tooltip component */}',
      '      <Tooltip content="Close (Esc)">',
      '        <Lightbox.Close aria-label="Close"><X /></Lightbox.Close>',
      '      </Tooltip>',
    );
  } else {
    lines.push('      <Lightbox.Close aria-label="Close"><X /></Lightbox.Close>');
  }

  lines.push(
    '',
    '      <Lightbox.Slides className="…">',
    '        {items.map((item, i) => (',
    '          <Lightbox.Slide key={item.id}>',
    '            <Lightbox.Item index={i} caption={item.caption}>',
    '              <img src={item.src} alt={item.alt} />',
    '            </Lightbox.Item>',
    '          </Lightbox.Slide>',
    '        ))}',
    '      </Lightbox.Slides>',
  );

  if (o.arrows) {
    lines.push('');
    if (o.tooltips) {
      lines.push(
        '      <Tooltip content="Previous (←)">',
        '        <Lightbox.Previous aria-label="Previous"><ChevronLeft /></Lightbox.Previous>',
        '      </Tooltip>',
        '      <Tooltip content="Next (→)">',
        '        <Lightbox.Next aria-label="Next"><ChevronRight /></Lightbox.Next>',
        '      </Tooltip>',
      );
    } else {
      lines.push(
        '      <Lightbox.Previous aria-label="Previous"><ChevronLeft /></Lightbox.Previous>',
        '      <Lightbox.Next aria-label="Next"><ChevronRight /></Lightbox.Next>',
      );
    }
  }

  if (o.caption || o.thumbs) lines.push('');
  if (o.caption) lines.push('      <Lightbox.Caption className="…" />');
  if (o.thumbs) {
    lines.push(
      '      <Lightbox.ThumbnailStrip className="…">',
      '        <Lightbox.ThumbnailStripTrack aria-label="Thumbnails">',
      '          {items.map((item, i) => (',
      '            <Lightbox.Thumbnail key={item.id} index={i}>',
      '              <img src={item.thumb} alt={item.alt} />',
      '            </Lightbox.Thumbnail>',
      '          ))}',
      '        </Lightbox.ThumbnailStripTrack>',
      '      </Lightbox.ThumbnailStrip>',
    );
  }

  lines.push('    </Lightbox.Stage>');

  if (o.sidebar) {
    lines.push(
      '',
      '    {/* a real sidebar: your markup, not a plugin */}',
      '    <aside aria-label="Post">',
      '      <PostThread post={post} />',
      '    </aside>',
    );
  }

  lines.push('  </Lightbox.Content>', '</Lightbox.Portal>');
  return lines.join('\n');
}

/* ------------------------------------------------------------------ */
/* Tiny JSX tokenizer for the live panel. The server-side highlighter  */
/* is async (shiki), so this client panel colors its own deterministic */
/* snippet with the same github-light/dark palette.                    */
/* ------------------------------------------------------------------ */

const tokenClassNames = {
  comment: 'text-[#6e7781] dark:text-[#8b949e]',
  string: 'text-[#0a3069] dark:text-[#a5d6ff]',
  tag: 'text-[#116329] dark:text-[#7ee787]',
  attr: 'text-[#0550ae] dark:text-[#79c0ff]',
} as const;

const TOKEN =
  /(\{\/\*.*?\*\/\})|("(?:[^"\\]|\\.)*")|(`[^`]*`)|(<\/?)([A-Za-z][\w.]*)|([a-zA-Z][\w-]*)(?==)/g;

function highlightLine(line: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  let last = 0;
  let key = 0;
  for (const m of line.matchAll(TOKEN)) {
    const index = m.index ?? 0;
    if (index > last) parts.push(line.slice(last, index));
    const [full, comment, dq, tpl, tagOpen, tagName, attr] = m;
    if (comment) {
      parts.push(<span key={key++} className={tokenClassNames.comment}>{comment}</span>);
    } else if (dq || tpl) {
      parts.push(<span key={key++} className={tokenClassNames.string}>{dq ?? tpl}</span>);
    } else if (tagOpen && tagName) {
      parts.push(tagOpen);
      parts.push(<span key={key++} className={tokenClassNames.tag}>{tagName}</span>);
    } else if (attr) {
      parts.push(<span key={key++} className={tokenClassNames.attr}>{attr}</span>);
    } else {
      parts.push(full);
    }
    last = index + full.length;
  }
  if (last < line.length) parts.push(line.slice(last));
  return parts;
}

/* ------------------------------------------------------------------ */

/**
 * The "your own tooltip component" of the demo. Rendered inside each icon
 * button (which carries the `group` class); shows on hover and keyboard
 * focus. The media pane is dark in both themes, so one palette suffices.
 */
function TooltipBubble({ label, className }: { label: string; className: string }) {
  return (
    <span
      role="tooltip"
      className={`pointer-events-none absolute z-10 whitespace-nowrap rounded-md bg-neutral-800/95 px-2 py-1 text-[11px] font-medium text-white opacity-0 shadow-sm backdrop-blur transition-opacity delay-75 group-hover:opacity-100 group-focus-visible:opacity-100 ${className}`}
    >
      {label}
    </span>
  );
}

const toggleClassName = (active: boolean) =>
  `h-8 rounded-full px-3.5 text-[13px] font-medium transition ${
    active
      ? 'bg-neutral-900 text-white dark:bg-neutral-50 dark:text-neutral-900'
      : 'border border-neutral-200 text-neutral-600 hover:bg-neutral-100 dark:border-neutral-800 dark:text-neutral-400 dark:hover:bg-neutral-900'
  }`;

const TOGGLES: { key: keyof Options; label: string }[] = [
  { key: 'sidebar', label: 'Post sidebar' },
  { key: 'arrows', label: 'Arrows' },
  { key: 'thumbs', label: 'Thumbnails' },
  { key: 'caption', label: 'Caption' },
  { key: 'tooltips', label: 'Tooltips' },
];

/** Per-tile rounding for the 1-tall + 2 grid (morph reads the trigger radius). */
const tileClasses = [
  'row-span-2 rounded-s-xl',
  'rounded-tr-xl',
  'rounded-br-xl',
];

export function ChromeBuilder() {
  const [options, setOptions] = React.useState<Options>(DEFAULTS);
  const toggle = (key: keyof Options) => setOptions((o) => ({ ...o, [key]: !o[key] }));

  const snippet = React.useMemo(() => buildSnippet(options), [options]);
  const { author } = POST;

  // The preset's slides read `--xlb-inset-bottom` as padding so media never
  // sits under bottom chrome. Its default (3rem) is sized for the preset's
  // own counter; our caption + thumbnail band is taller, so reserve for
  // whatever is actually rendered (same trick as the docs gallery chrome).
  const bottomChrome = options.thumbs ? (options.caption ? '7.5rem' : '5.5rem') : null;
  const stageStyle = bottomChrome
    ? ({
        '--xlb-inset-bottom': `calc(${bottomChrome} + env(safe-area-inset-bottom, 0px))`,
      } as React.CSSProperties)
    : undefined;

  return (
    <figure className="my-8 rounded-2xl border border-neutral-200 p-4 md:p-5 dark:border-neutral-800">
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Chrome pieces">
        {TOGGLES.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => toggle(key)}
            aria-pressed={options[key]}
            className={toggleClassName(options[key])}
          >
            {label}
          </button>
        ))}
      </div>

      <XLB.Root loop>
        {/* The feed post that opens the viewer. */}
        <article className="mt-4 rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
          <div className="flex items-center gap-2.5">
            <img src={author.avatar} alt="" className="size-9 shrink-0 rounded-full object-cover" draggable={false} />
            <div className="flex min-w-0 flex-wrap items-baseline gap-x-1 text-sm">
              <span className="font-semibold text-neutral-900 dark:text-neutral-50">{author.name}</span>
              <span className="text-neutral-500">@{author.handle} · 3h</span>
            </div>
          </div>
          <p className="mb-3 mt-2 text-[14px] leading-snug text-neutral-800 dark:text-neutral-200">{POST.text}</p>
          <div className="grid aspect-3/2 grid-cols-2 grid-rows-2 gap-0.5 overflow-hidden rounded-xl">
            {ITEMS.map((item, i) => (
              <XLB.Trigger
                key={item.alt}
                index={i}
                className={`block overflow-hidden bg-transparent p-0 ${tileClasses[i]}`}
              >
                {({ imageRef }) => (
                  <Image
                    ref={imageRef}
                    src={item.src}
                    alt={item.alt}
                    placeholder="blur"
                    sizes="(min-width: 768px) 300px, 50vw"
                    loading="lazy"
                    draggable={false}
                    className="block size-full select-none object-cover"
                  />
                )}
              </XLB.Trigger>
            ))}
          </div>
        </article>

        <XLB.Portal>
          <XLB.Backdrop />
          <XLB.Content aria-label={`Photos by ${author.name}`}>
            <XLB.Stage style={stageStyle}>
              <XLB.Close className="group xlb-chrome-pull-hide">
                {/* 2.5 (not the chevrons' 2.25): long 45° diagonals antialias
                    thinner at 18px, so the X needs extra weight to match. */}
                <X aria-hidden strokeWidth={2.5} />
                {options.tooltips ? (
                  <TooltipBubble label="Close (Esc)" className="inset-s-0 top-full mt-2" />
                ) : null}
              </XLB.Close>

              <XLB.Slides aria-label="Post media" aria-roledescription="carousel" preload={1}>
                {ITEMS.map((item, i) => (
                  <XLB.Slide key={item.alt}>
                    <XLB.Item
                      index={i}
                      caption={item.caption}
                      aria-roledescription="slide"
                      aria-label={`${i + 1} of ${ITEMS.length}`}
                    >
                      <XLB.Zoom>
                        <XLB.Media width={item.src.width} height={item.src.height}>
                          <Image
                            src={item.src}
                            alt={item.alt}
                            sizes="100vw"
                            loading="eager"
                            draggable={false}
                            className="select-none"
                          />
                        </XLB.Media>
                      </XLB.Zoom>
                    </XLB.Item>
                  </XLB.Slide>
                ))}
              </XLB.Slides>

              {options.arrows ? (
                <>
                  <XLB.Previous className="group xlb-chrome-pull-hide">
                    <ChevronLeft aria-hidden strokeWidth={2.25} />
                    {options.tooltips ? (
                      <TooltipBubble label="Previous (←)" className="left-1/2 top-full mt-2 -translate-x-1/2" />
                    ) : null}
                  </XLB.Previous>
                  <XLB.Next className="group xlb-chrome-pull-hide">
                    <ChevronRight aria-hidden strokeWidth={2.25} />
                    {options.tooltips ? (
                      <TooltipBubble label="Next (→)" className="left-1/2 top-full mt-2 -translate-x-1/2" />
                    ) : null}
                  </XLB.Next>
                </>
              ) : null}

              {options.caption || options.thumbs ? (
                <div className="xlb-chrome-pull-hide cb-zoom-hide pointer-events-none absolute inset-x-0 bottom-0 z-2 flex flex-col items-center gap-3 px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))]">
                  {options.caption ? (
                    <Lightbox.Caption className="block max-w-full truncate text-[13px] font-medium leading-tight text-white/90" />
                  ) : null}
                  {options.thumbs ? (
                    <Lightbox.ThumbnailStrip className="lightbox-demo-thumbnail-strip pointer-events-auto">
                      <Lightbox.ThumbnailStripTrack aria-label="Photo thumbnails">
                        {ITEMS.map((item, i) => (
                          <Lightbox.Thumbnail key={item.alt} index={i}>
                            <Image src={item.src} alt={item.alt} sizes="96px" draggable={false} />
                          </Lightbox.Thumbnail>
                        ))}
                      </Lightbox.ThumbnailStripTrack>
                      {/* The shared indicator is black in light mode, but this
                          media pane is dark in both themes — force white. */}
                      <span className="lightbox-demo-thumbnail-strip-indicator border-white!" aria-hidden />
                    </Lightbox.ThumbnailStrip>
                  ) : null}
                </div>
              ) : null}
            </XLB.Stage>

            {options.sidebar ? <XLB.ThreadPanel thread={POST} open={false} onClose={() => {}} /> : null}
          </XLB.Content>
        </XLB.Portal>
      </XLB.Root>

      <div className="mt-4 overflow-hidden rounded-lg border border-neutral-200 dark:border-neutral-800">
        <div className="flex items-center justify-between border-b border-neutral-200 bg-neutral-50 px-3 py-1.5 dark:border-neutral-800 dark:bg-neutral-900">
          <span className="text-xs font-medium text-neutral-500">Your chrome, exactly as rendered</span>
        </div>
        <pre className="overflow-x-auto bg-neutral-50 p-4 text-[12.5px] leading-[1.7] text-[#1f2328] dark:bg-neutral-950 dark:text-[#e6edf3]">
          <code>
            {snippet.split('\n').map((line, i) => (
              // eslint-disable-next-line react/no-array-index-key -- lines have no identity
              <span key={i} className="block min-h-[1.2em]">
                {highlightLine(line)}
              </span>
            ))}
          </code>
        </pre>
      </div>

      <figcaption className="mt-4 text-[13px] leading-6 text-neutral-500 dark:text-neutral-400">
        Flip the switches, then open a photo. The viewer and the JSX update together because they cannot
        drift apart: a piece of chrome exists exactly when you render it. The post sidebar is a plain{' '}
        <code className="text-[12px]">&lt;aside&gt;</code> with your components in it, the tooltips wrap
        every icon button in the stage, and none of it is an option. The sidebar layout is desktop-only,
        like the social apps it mimics.
      </figcaption>
    </figure>
  );
}
