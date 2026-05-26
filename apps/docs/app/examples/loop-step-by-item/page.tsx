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
      title="Loop + step by item"
      description="Combining `loop` with `step={1}` gives a classic carousel: one-item-at-a-time navigation that wraps around at the boundaries."
    >
      <ScrollGallery.Root defaultValue={0} loop>
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
