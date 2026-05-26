'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useRef, useState } from 'react';
import { ScrollGallery } from 'react-image-gallery';
import { COLOR_CLASSES } from '../../_components/colors';
import { ExampleShell } from '../../_components/example-shell';
import { IconButton } from '../../_components/icon-button';
import { MarkerDots } from '../../_components/marker-dots';
import { colors, type PersonColor } from '../../_data/people';

interface Item {
  id: number;
  name: string;
  color: PersonColor;
  initials: string;
}

function makeItem(id: number): Item {
  const color = colors[id % colors.length] ?? 'rose';
  return { id, name: `Item ${id}`, color, initials: `${id}` };
}

export default function Page() {
  const nextId = useRef(2);
  const [items, setItems] = useState<Item[]>(() => [makeItem(0), makeItem(1)]);

  const prepend = () => {
    const id = nextId.current++;
    setItems((prev) => [makeItem(id), ...prev]);
  };
  const append = () => {
    const id = nextId.current++;
    setItems((prev) => [...prev, makeItem(id)]);
  };
  const removeFirst = () => setItems((prev) => prev.slice(1));
  const removeLast = () => setItems((prev) => prev.slice(0, -1));

  const actionBtn =
    'rounded-md px-3 py-1.5 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-40';
  const neutralBtn = `${actionBtn} bg-neutral-100 text-neutral-800 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700`;
  const dangerBtn = `${actionBtn} bg-red-100 text-red-800 hover:bg-red-200 dark:bg-red-950 dark:text-red-200`;

  return (
    <ExampleShell
      title="Dynamic items"
      description="Items can be added or removed at runtime. The viewport re-registers them, the marker count updates, and Previous/Next button state stays in sync."
    >
      <div className="mb-4 flex flex-wrap gap-2">
        <button type="button" className={neutralBtn} onClick={prepend}>
          Prepend
        </button>
        <button type="button" className={dangerBtn} onClick={removeFirst} disabled={items.length === 0}>
          Remove first
        </button>
        <button type="button" className={dangerBtn} onClick={removeLast} disabled={items.length === 0}>
          Remove last
        </button>
        <button type="button" className={neutralBtn} onClick={append}>
          Append
        </button>
      </div>

      <p className="mb-2 text-xs text-neutral-500">
        {items.length} item{items.length !== 1 && 's'}
      </p>

      <ScrollGallery.Root defaultValue={0}>
        <ScrollGallery.Viewport
          aria-label="Dynamic items"
          style={{
            display: 'flex',
            gap: 12,
            overflowX: 'auto',
            overscrollBehaviorX: 'contain',
            scrollSnapType: 'x mandatory',
            scrollbarWidth: 'none',
          }}
        >
          {items.map((item) => {
            const c = COLOR_CLASSES[item.color];
            return (
              <ScrollGallery.Item key={item.id} style={{ scrollSnapAlign: 'start', flexShrink: 0 }}>
                <div className="w-[220px] rounded-xl border border-neutral-200 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
                  <div className="flex flex-col items-center gap-3 py-2">
                    <div
                      className={`flex h-14 w-14 items-center justify-center rounded-full text-base font-semibold text-white ${c.avatarBg}`}
                    >
                      {item.initials}
                    </div>
                    <div className="text-center">
                      <div className="text-sm font-bold text-neutral-900 dark:text-neutral-50">{item.name}</div>
                      <span
                        className={`mt-1 inline-block rounded px-2 py-0.5 text-xs font-medium ${c.badgeBg} ${c.badgeText}`}
                      >
                        {item.color}
                      </span>
                    </div>
                  </div>
                </div>
              </ScrollGallery.Item>
            );
          })}
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

          <ScrollGallery.ScrollMarkerGroup aria-label="Choose item" className="flex gap-1.5">
            <MarkerDots count={items.length} />
          </ScrollGallery.ScrollMarkerGroup>
        </div>
      </ScrollGallery.Root>
    </ExampleShell>
  );
}
