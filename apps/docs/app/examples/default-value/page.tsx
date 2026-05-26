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
  const [activeIndex, setActiveIndex] = useState(3);
  const [log, setLog] = useState<{ index: number; source: string }[]>([]);

  return (
    <ExampleShell
      title="Default value"
      description={
        <>
          Use <code className="rounded bg-neutral-100 px-1 py-0.5 text-xs dark:bg-neutral-800">defaultValue</code> to
          initialize the gallery at a specific item. The viewport scrolls there instantly on mount and the corresponding
          marker is active. Here we start at item <strong>3</strong> (James Wright). Pair with{' '}
          <code className="rounded bg-neutral-100 px-1 py-0.5 text-xs dark:bg-neutral-800">onValueChange</code> to track
          the active index as the user scrolls.
        </>
      }
    >
      <p className="mb-2 text-xs text-neutral-500">
        Active:{' '}
        <code className="rounded bg-neutral-100 px-1.5 py-0.5 font-mono text-xs dark:bg-neutral-800">{activeIndex}</code>
      </p>

      <ScrollGallery.Root
        defaultValue={3}
        onValueChange={(newValue, { source }) => {
          setActiveIndex(newValue);
          setLog((prev) => [{ index: newValue, source }, ...prev].slice(0, 10));
        }}
      >
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
            <ScrollGallery.Previous aria-label="Previous" render={<IconButton />}>
              <ChevronLeft className="h-4 w-4" />
            </ScrollGallery.Previous>
            <ScrollGallery.Next aria-label="Next" render={<IconButton />}>
              <ChevronRight className="h-4 w-4" />
            </ScrollGallery.Next>
          </div>

          <ScrollGallery.ScrollMarkerGroup aria-label="Choose team member" className="flex gap-1.5">
            <MarkerDots count={people.length} />
          </ScrollGallery.ScrollMarkerGroup>
        </div>
      </ScrollGallery.Root>

      <div className="mt-6">
        <div className="mb-2 text-sm font-semibold">onValueChange log</div>
        <div className="min-h-[120px] rounded-lg border border-neutral-200 bg-neutral-50 p-3 font-mono text-xs leading-relaxed text-neutral-700 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300">
          {log.length === 0 ? (
            <span className="text-neutral-500">Scroll or click markers to see events…</span>
          ) : (
            log.map((entry, i) => (
              <div key={i}>
                index: <code className="text-neutral-900 dark:text-neutral-100">{entry.index}</code> source:{' '}
                <code className={entry.source === 'scroll' ? 'text-neutral-500' : 'text-indigo-600 dark:text-indigo-400'}>
                  {entry.source}
                </code>
              </div>
            ))
          )}
        </div>
      </div>
    </ExampleShell>
  );
}
