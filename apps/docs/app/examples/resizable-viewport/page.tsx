'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { ScrollGallery } from 'react-image-gallery';
import { ExampleShell } from '../../_components/example-shell';
import { IconButton } from '../../_components/icon-button';
import { MarkerDots } from '../../_components/marker-dots';
import { PersonCard } from '../../_components/person-card';
import { people } from '../../_data/people';

export default function Page() {
  return (
    <ExampleShell
      title="Resizable viewport"
      description={
        <>
          The viewport is wrapped in a <code className="rounded bg-neutral-100 px-1 py-0.5 text-xs dark:bg-neutral-800">resize: horizontal</code> container. Grab the bottom-right corner of the inner box to resize it — the ResizeObserver on the viewport recomputes the active item and updates marker / button state automatically.
        </>
      }
    >
      <div
        style={{
          resize: 'horizontal',
          overflow: 'auto',
          border: '1px dashed rgba(115, 115, 115, 0.4)',
          padding: 12,
          borderRadius: 12,
          width: 500,
          minWidth: 280,
          maxWidth: '100%',
        }}
      >
        <ScrollGallery.Root defaultValue={0}>
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
      </div>
    </ExampleShell>
  );
}
