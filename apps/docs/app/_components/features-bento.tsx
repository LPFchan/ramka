import type { ComponentType } from 'react';

import {
  Accessibility,
  ArrowDownToLine,
  Blocks,
  Clapperboard,
  FileCode2,
  GalleryHorizontalEnd,
  Languages,
  Sparkles,
  ZoomIn,
} from 'lucide-react';

import { cn } from '@/lib/utils';

/**
 * Landing page feature bento. Real headings and prose, not screenshots —
 * this section carries the SEO weight for the terms people actually search
 * (react lightbox, pinch to zoom, view transitions, accessible gallery).
 * Every claim here is documented behavior; nothing aspirational.
 */

interface Feature {
  title: string;
  description: string;
  icon: ComponentType<{ className?: string; strokeWidth?: number }>;
  /** Bento span on md+; single column while stacked. */
  wide?: boolean;
}

const FEATURES: Feature[] = [
  {
    title: 'Morph view transitions',
    description:
      'Shared-element View Transitions morph anything into the lightbox and back: images, video, plain HTML. Browsers without the API get a clean crossfade.',
    icon: Sparkles,
  },
  {
    title: 'Native scrolling',
    description:
      'Slides ride real CSS scroll snapping, not a transform-emulated carousel. Swiping feels native because it is.',
    icon: GalleryHorizontalEnd,
  },
  {
    title: 'Pinch to zoom',
    description:
      'Pinch on touch or trackpad, double-tap to zoom, ctrl + scroll to zoom at the cursor. Pan with a finger, mouse, or arrow keys.',
    icon: ZoomIn,
  },
  {
    title: 'Pull to dismiss',
    description:
      'Drag down on touch or wheel on a trackpad to close, like every photos app. Elastic, interruptible, and aware of zoom and in-flight swipes.',
    icon: ArrowDownToLine,
  },
  {
    title: 'Headless and unstyled',
    description:
      'Composable primitives with the API you know from Radix UI and Base UI: Trigger, Slides, Zoom, Captions, Thumbnails, Counter. Right at home in a shadcn/ui codebase. You own every pixel.',
    icon: Blocks,
    wide: true,
  },
  {
    title: 'Accessible by default',
    description:
      'A focus-trapped dialog with full keyboard navigation: arrows, Escape, and zoom shortcuts. Screen-reader naming hooks built in, and prefers-reduced-motion respected.',
    icon: Accessibility,
    wide: true,
  },
  {
    title: 'RTL support',
    description: 'One dir="rtl" mirrors slide order, arrow keys, thumbnails, and even the morph geometry.',
    icon: Languages,
  },
  {
    title: 'Typed and tiny',
    description:
      'Fully typed, tree-shakeable, zero runtime dependencies. The zoom, morph, and pull engines lazy-load on demand, so a full gallery ships around 19 KB gzipped up front.',
    icon: FileCode2,
    wide: true,
  },
  {
    title: 'Images, video, anything',
    description:
      'Photos, videos, 3D models, or any React content. Responsive srcset images and first-class Next.js Image support.',
    icon: Clapperboard,
  },
];

export function FeaturesBento() {
  return (
    <section id="features" className="mx-auto w-full max-w-5xl px-6 pb-24 md:pb-32">
      <h2 className="text-balance text-center text-3xl font-semibold tracking-tight text-neutral-950 md:text-4xl dark:text-neutral-50">
        Everything a lightbox should do.
      </h2>
      {/* Deliberately different vocabulary from the hero paragraph: the hero
          claims the gesture set (morph, swipe, zoom, pull-to-dismiss) and
          "unstyled, accessible primitives", so repeating it here read as
          filler. This line covers the same ground in search phrases that
          appear nowhere else on the page — image viewer, photos app,
          keyboard, screen readers, gallery. */}
      <p className="mx-auto mt-4 max-w-xl text-pretty text-center text-neutral-500 dark:text-neutral-400">
        An image viewer that feels like the native photos app, from gestures to keyboard and screen-reader support. Zero
        opinions about how your gallery looks.
      </p>

      <div className="mt-12 grid gap-4 md:grid-cols-3 md:gap-5">
        {FEATURES.map((feature) => {
          const cardClass = cn(
            'rounded-3xl border border-neutral-200 p-7 dark:border-neutral-800',
            feature.wide && 'md:col-span-2',
          );
          return (
            <div key={feature.title} className={cardClass}>
              <feature.icon aria-hidden className="size-5 text-neutral-400 dark:text-neutral-500" strokeWidth={1.75} />
              <h3 className="mt-4 text-[15px] font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">
                {feature.title}
              </h3>
              <p className="mt-2 text-pretty text-[14px] leading-6 text-neutral-500 dark:text-neutral-400">
                {feature.description}
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
