'use client';

import { Lightbox, type LightboxItem, type ThreadPost } from './lightbox';

const author = {
  name: 'Maya Chen',
  handle: 'mayachen',
  avatar: 'https://i.pravatar.cc/96?u=mayachen',
  verified: true,
};

const thread: ThreadPost = {
  author,
  text: 'Hot take: most “premium” SaaS dashboards are just better spacing and one accent color.\n\nShipped a redesign in a weekend with tighter type scale + fewer borders. Engagement up 18%.',
  time: 'Jul 30, 2026 · 2:14 PM',
  stats: {
    replies: 42,
    reposts: 128,
    likes: 890,
    views: '48.2K',
  },
  replies: [
    {
      id: 'r1',
      author: {
        name: 'Alex Rivera',
        handle: 'alexrivera',
        avatar: 'https://i.pravatar.cc/96?u=alexrivera',
      },
      text: 'The spacing comment is so real. We removed half our card chrome and NPS jumped.',
      time: '1h',
    },
    {
      id: 'r2',
      author: {
        name: 'Sam Okonkwo',
        handle: 'samok',
        avatar: 'https://i.pravatar.cc/96?u=samok',
      },
      text: 'Would love a before/after thread. Also curious what you did for empty states.',
      time: '45m',
    },
    {
      id: 'r3',
      author: {
        name: 'Jordan Lee',
        handle: 'jordanlee',
        avatar: 'https://i.pravatar.cc/96?u=jordanlee',
      },
      text: 'Accent color + fewer borders is the whole trick. Everything else is performance.',
      time: '32m',
    },
    {
      id: 'r4',
      author: {
        name: 'Priya Nair',
        handle: 'priyanair',
        avatar: 'https://i.pravatar.cc/96?u=priyanair',
      },
      text: 'The 18% stat is wild for a weekend pass. Did you A/B or just ship?',
      time: '18m',
    },
  ],
};

const media: LightboxItem[] = [
  {
    src: 'https://picsum.photos/seed/xlb-before/1400/900',
    thumb: 'https://picsum.photos/seed/xlb-before/600/400',
    alt: 'Dashboard before redesign',
    width: 1400,
    height: 900,
  },
  {
    src: 'https://picsum.photos/seed/xlb-after/1400/900',
    thumb: 'https://picsum.photos/seed/xlb-after/600/400',
    alt: 'Dashboard after redesign',
    width: 1400,
    height: 900,
  },
  {
    src: 'https://picsum.photos/seed/xlb-detail/1200/1200',
    thumb: 'https://picsum.photos/seed/xlb-detail/480/480',
    alt: 'Typography scale detail',
    width: 1200,
    height: 1200,
  },
  {
    src: 'https://picsum.photos/seed/xlb-mobile/900/1400',
    thumb: 'https://picsum.photos/seed/xlb-mobile/360/560',
    alt: 'Mobile layout comparison',
    width: 900,
    height: 1400,
  },
];

function tileCornerClass(index: number) {
  return [
    'rounded-tl-2xl rounded-tr-none rounded-br-none rounded-bl-none',
    'rounded-tl-none rounded-tr-2xl rounded-br-none rounded-bl-none',
    'rounded-tl-none rounded-tr-none rounded-br-none rounded-bl-2xl',
    'rounded-tl-none rounded-tr-none rounded-br-2xl rounded-bl-none',
  ][index]!;
}

/**
 * App-level demo — not part of the copy-paste package.
 * Tweet card with a 2×2 media grid opens the split viewer + thread sidebar.
 */
export function TwitterPresetDemo() {
  return (
    <div className="w-full max-w-md">
      <Lightbox.Root>
        <article className="overflow-hidden rounded-2xl border border-neutral-200 bg-white text-left shadow-sm dark:border-neutral-700 dark:bg-neutral-900">
          <div className="flex gap-3 p-3">
            <img
              src={author.avatar}
              alt=""
              className="size-10 shrink-0 rounded-full object-cover"
              draggable={false}
            />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-1 text-sm">
                <span className="font-bold text-neutral-900 dark:text-neutral-50">{author.name}</span>
                <span className="text-neutral-500">@{author.handle}</span>
              </div>
              <p className="mt-1 whitespace-pre-wrap text-[15px] leading-snug text-neutral-900 dark:text-neutral-100">
                {thread.text}
              </p>
            </div>
          </div>

          {/* Corner radius on Trigger — morph reads it when morphRef is unset. */}
          <div className="grid aspect-[16/10] grid-cols-2 grid-rows-2 gap-0.5 overflow-hidden rounded-2xl bg-neutral-100 dark:bg-neutral-800">
            {media.map((item, i) => (
              <Lightbox.Trigger
                key={item.src}
                index={i}
                className={`relative block min-h-0 min-w-0 overflow-hidden border-0 bg-transparent p-0 ${tileCornerClass(i)}`}
              >
                {({ imageRef }) => (
                  <img
                    ref={imageRef}
                    src={item.thumb}
                    alt={item.alt}
                    width={item.width}
                    height={item.height}
                    className="absolute inset-0 size-full object-cover"
                    draggable={false}
                  />
                )}
              </Lightbox.Trigger>
            ))}
          </div>

          <div className="flex justify-between px-3 py-2 text-xs text-neutral-500">
            <span>{thread.stats?.replies} replies</span>
            <span>{thread.stats?.likes} likes</span>
          </div>
        </article>

        <Lightbox.Gallery items={media} thread={thread} ariaLabel="Post media" />
      </Lightbox.Root>
    </div>
  );
}
