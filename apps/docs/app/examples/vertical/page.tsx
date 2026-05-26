'use client';

import { ChevronDown, ChevronUp } from 'lucide-react';
import { ScrollGallery } from 'react-image-gallery';
import { ExampleShell } from '../../_components/example-shell';
import { IconButton } from '../../_components/icon-button';
import { MarkerDots } from '../../_components/marker-dots';
import { PersonRowCard } from '../../_components/person-card';
import { people } from '../../_data/people';

export default function Page() {
  return (
    <ExampleShell
      title="Vertical"
      description={
        <>
          Pass <code className="rounded bg-neutral-100 px-1 py-0.5 text-xs dark:bg-neutral-800">orientation=&quot;vertical&quot;</code>{' '}
          to flip the axis. Arrow Up / Down replace Left / Right for keyboard navigation.
        </>
      }
    >
      <ScrollGallery.Root defaultValue={0} orientation="vertical">
        <div className="flex gap-3">
          <ScrollGallery.Viewport
            aria-label="Team members"
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
              overflowY: 'auto',
              scrollSnapType: 'y mandatory',
              scrollbarWidth: 'none',
              height: 360,
            }}
          >
            {people.map((person) => (
              <ScrollGallery.Item key={person.name} style={{ scrollSnapAlign: 'start', flexShrink: 0 }}>
                <PersonRowCard person={person} />
              </ScrollGallery.Item>
            ))}
          </ScrollGallery.Viewport>

          <div className="flex flex-col items-center gap-2">
            <ScrollGallery.Previous aria-label="Previous" render={<IconButton />}>
              <ChevronUp className="h-4 w-4" />
            </ScrollGallery.Previous>

            <ScrollGallery.ScrollMarkerGroup aria-label="Choose team member" className="flex flex-col gap-1.5">
              <MarkerDots count={people.length} />
            </ScrollGallery.ScrollMarkerGroup>

            <ScrollGallery.Next aria-label="Next" render={<IconButton />}>
              <ChevronDown className="h-4 w-4" />
            </ScrollGallery.Next>
          </div>
        </div>
      </ScrollGallery.Root>
    </ExampleShell>
  );
}
