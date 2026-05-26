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
  const [value, setValue] = useState(0);
  const [log, setLog] = useState<{ index: number; source: string }[]>([]);

  return (
    <ExampleShell
      title="Controlled (value)"
      description={
        <>
          Pass both <code className="rounded bg-neutral-100 px-1 py-0.5 text-xs dark:bg-neutral-800">value</code> and{' '}
          <code className="rounded bg-neutral-100 px-1 py-0.5 text-xs dark:bg-neutral-800">onValueChange</code> for full
          control: your state becomes the single source of truth and external buttons can drive the gallery by setting
          the value directly.
        </>
      }
    >
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <span className="text-sm">
          External value:{' '}
          <code className="rounded bg-neutral-100 px-1.5 py-0.5 font-mono text-xs dark:bg-neutral-800">{value}</code>
        </span>
        <div className="flex gap-1.5">
          {people.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setValue(i)}
              className={`h-7 w-7 rounded-md text-xs font-medium transition ${
                value === i
                  ? 'bg-neutral-900 text-white hover:bg-neutral-800 dark:bg-neutral-100 dark:text-neutral-900'
                  : 'bg-neutral-100 text-neutral-800 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700'
              }`}
            >
              {i}
            </button>
          ))}
        </div>
      </div>

      <ScrollGallery.Root
        value={value}
        onValueChange={(newValue, { source }) => {
          setValue(newValue);
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
            <span className="text-neutral-500">Scroll, click markers, or use the external buttons…</span>
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
