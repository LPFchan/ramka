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
      title="Without scroll snap"
      description="The same gallery without `scroll-snap-type`. Scrolling is freeform; the active marker still tracks the nearest item using the CSS Overflow 5 algorithm."
    >
      <ScrollGallery.Root defaultValue={0}>
        <ScrollGallery.Viewport
          aria-label="Team members (no snap)"
          style={{
            display: 'flex',
            gap: 12,
            overflowX: 'auto',
            overscrollBehaviorX: 'contain',
            scrollbarWidth: 'none',
          }}
        >
          {people.map((person) => (
            <ScrollGallery.Item key={person.name} style={{ flexShrink: 0 }}>
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
    </ExampleShell>
  );
}
