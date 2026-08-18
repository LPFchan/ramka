'use client';

import { Lightbox, type LightboxItem } from './lightbox';

/**
 * App-level demo — not part of the copy-paste package.
 *
 * A horizontally scrolling story tray. Each circle is a `Lightbox.Trigger`
 * showing the author’s portrait. `crossfade="both"`: the face is not the
 * 9:16 frame, so a geometry morph would look wrong. Closing from a story
 * whose trigger has scrolled off-screen recenters it for the close.
 */

function mixkit(id: number): string {
  return `https://assets.mixkit.co/videos/${id}/${id}-720.mp4`;
}

/** Mixkit’s first generated 720p still — matches the opening frame of `${id}-720.mp4`. */
function mixkitPoster(id: number): string {
  return `https://assets.mixkit.co/videos/${id}/${id}-thumb-720-0.jpg`;
}

function portrait(gender: 'women' | 'men', n: number): string {
  return `https://randomuser.me/api/portraits/${gender}/${n}.jpg`;
}

const stories: LightboxItem[] = [
  {
    id: 'maya',
    name: 'Maya',
    time: '2h',
    avatar: portrait('women', 44),
    poster: mixkitPoster(40065),
    video: mixkit(40065),
    alt: 'Maya’s story',
    width: 720,
    height: 1280,
  },
  {
    id: 'julian',
    name: 'Julian',
    time: '5h',
    avatar: portrait('men', 32),
    poster: mixkitPoster(43000),
    video: mixkit(43000),
    alt: 'Julian’s story',
    width: 720,
    height: 1280,
  },
  {
    id: 'noor',
    name: 'Noor',
    time: '8h',
    avatar: portrait('women', 68),
    poster: mixkitPoster(43785),
    video: mixkit(43785),
    alt: 'Noor’s story',
    width: 720,
    height: 1280,
  },
  {
    id: 'eli',
    name: 'Eli',
    time: '12h',
    avatar: portrait('men', 75),
    poster: mixkitPoster(40064),
    video: mixkit(40064),
    alt: 'Eli’s story',
    width: 720,
    height: 1280,
  },
  {
    id: 'sam',
    name: 'Sam',
    time: '1d',
    avatar: portrait('men', 22),
    poster: mixkitPoster(44852),
    video: mixkit(44852),
    alt: 'Sam’s story',
    width: 720,
    height: 1280,
  },
  {
    id: 'priya',
    name: 'Priya',
    time: '1d',
    avatar: portrait('women', 21),
    poster: mixkitPoster(50000),
    video: mixkit(50000),
    alt: 'Priya’s story',
    width: 720,
    height: 1280,
  },
  {
    id: 'tomas',
    name: 'Tomás',
    time: '2d',
    avatar: portrait('men', 11),
    poster: mixkitPoster(44600),
    video: mixkit(44600),
    alt: 'Tomás’s story',
    width: 720,
    height: 1280,
  },
  {
    id: 'aisha',
    name: 'Aisha',
    time: '2d',
    avatar: portrait('women', 17),
    poster: mixkitPoster(40066),
    video: mixkit(40066),
    alt: 'Aisha’s story',
    width: 720,
    height: 1280,
  },
];

export function StoriesPresetDemo() {
  return (
    <div className="w-full max-w-xl">
      <Lightbox.Root
        loop
        viewTransition="spring"
        // Avatar is a different image from the 9:16 frame, so every trigger
        // crossfades — skip the decode wait so the dissolve starts immediately.
        awaitImageDecode={false}
        // Avatar tray is a horizontal scroller: recenter the active circle
        // between snapshot captures so the close dissolve lands on-screen
        // without a painted jump. Avoid `onChange` — scrolling the page
        // under an open viewer can flash tiles on iOS Safari.
        scrollTriggerIntoView={[
          { type: 'onOpenComplete', behavior: 'instant', inline: 'nearest' },
          { type: 'onChange', behavior: 'instant', inline: 'nearest' },
        ]}
      >
        <p className="px-1 text-[13px] font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">
          Stories
        </p>
        <ul className="mt-3 flex snap-x snap-proximity gap-4 overflow-x-auto px-1 pb-1 scrollbar-none">
          {stories.map((story, i) => (
            <li
              key={story.id}
              className="flex w-16 shrink-0 snap-center scroll-mx-4 flex-col items-center gap-1.5"
            >
              <Lightbox.Trigger index={i} aria-label={`${story.name}’s story`} crossfade="both">
                {({ imageRef }) => (
                  <img
                    ref={imageRef}
                    src={story.avatar}
                    alt=""
                    width={56}
                    height={56}
                    className="block size-14 rounded-full object-cover"
                    draggable={false}
                  />
                )}
              </Lightbox.Trigger>
              <span className="w-full truncate text-center text-[11px] leading-tight text-neutral-600 dark:text-neutral-400">
                {story.name}
              </span>
            </li>
          ))}
        </ul>

        <Lightbox.Gallery items={stories} ariaLabel="Stories" />
      </Lightbox.Root>
    </div>
  );
}
