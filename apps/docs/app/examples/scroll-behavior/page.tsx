'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { ScrollGallery } from 'react-image-gallery';
import { ExampleShell } from '../../_components/example-shell';
import { IconButton } from '../../_components/icon-button';
import { MarkerDots } from '../../_components/marker-dots';
import { PersonCard } from '../../_components/person-card';
import { people } from '../../_data/people';

export default function Page() {
  const [behavior, setBehavior] = useState<'smooth' | 'instant'>('smooth');

  const segment = (active: boolean) =>
    `rounded-md px-3 py-1.5 text-xs font-medium transition ${
      active
        ? 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900'
        : 'bg-neutral-100 text-neutral-800 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700'
    }`;

  return (
    <ExampleShell
      title="Scroll behavior"
      description={
        <>
          Switch between <code className="rounded bg-neutral-100 px-1 py-0.5 text-xs dark:bg-neutral-800">smooth</code>{' '}
          and <code className="rounded bg-neutral-100 px-1 py-0.5 text-xs dark:bg-neutral-800">instant</code>{' '}
          programmatic scrolls. Buttons, markers, and the imperative <code className="rounded bg-neutral-100 px-1 py-0.5 text-xs dark:bg-neutral-800">scrollTo</code> all honor this setting. The user&apos;s reduced motion preference always wins.
        </>
      }
    >
      <div className="mb-4 inline-flex rounded-lg bg-neutral-100 p-1 dark:bg-neutral-800">
        <button type="button" className={segment(behavior === 'smooth')} onClick={() => setBehavior('smooth')}>
          smooth
        </button>
        <button type="button" className={segment(behavior === 'instant')} onClick={() => setBehavior('instant')}>
          instant
        </button>
      </div>

      <ScrollGallery.Root defaultValue={0} scrollBehavior={behavior} key={behavior}>
        <ScrollGallery.Viewport
          aria-label="Team members"
          style={{
            display: 'flex',
            gap: 12,
            overflowX: 'auto',
            overscrollBehaviorX: 'contain',
            scrollSnapType: 'x mandatory',
            scrollbarWidth: 'none',
          }}
        >
          {people.map((person) => (
            <ScrollGallery.Item key={person.name} style={{ scrollSnapAlign: 'start', flexShrink: 0 }}>
              <PersonCard person={person} />
            </ScrollGallery.Item>
          ))}
        </ScrollGallery.Viewport>

        <div className="mt-4 flex items-center justify-between">
          <div className="flex gap-2">
            <ScrollGallery.Previous aria-label="Previous" step={1} render={<IconButton />}>
              <ChevronLeft className="h-4 w-4" />
            </ScrollGallery.Previous>
            <ScrollGallery.Next aria-label="Next" step={1} render={<IconButton />}>
              <ChevronRight className="h-4 w-4" />
            </ScrollGallery.Next>
          </div>

          <ScrollGallery.ScrollMarkerGroup aria-label="Choose team member" className="flex gap-1.5">
            <MarkerDots count={people.length} />
          </ScrollGallery.ScrollMarkerGroup>
        </div>
      </ScrollGallery.Root>
    </ExampleShell>
  );
}
