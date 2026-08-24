'use client';

import { notFound } from 'next/navigation';
import * as React from 'react';
import Image, { type StaticImageData } from 'next/image';
import * as Lightbox from '@ramka/react/lightbox';
import { useLightboxContext } from '@ramka/react';

import {
  type LightboxGalleryItem,
  triggerFocusClass,
} from '../../../_components/lightbox-chrome';

import { DynamicItemsGallery } from './dynamic-items-gallery';
import { DynamicItemsPanel } from './dynamic-items-panel';
import { dynamicPoolImages } from './images.generated';
import { useAnimatedItemRemoval } from './use-animated-item-removal';
import './dynamic-items.css';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

const INITIAL_TRIGGER_COUNT = 3;

type TriggerMode = 'fixed' | 'synced';

let nextItemSerial = 1;

/** Newly added items cycle through a fixed pool of local assets by serial. */
function createItem(seed: number): LightboxGalleryItem {
  const serial = nextItemSerial++;
  const image = dynamicPoolImages[seed % dynamicPoolImages.length]!;
  return {
    id: `dynamic-${serial}`,
    src: image,
    thumb: image,
    alt: `Dynamic slide ${serial}`,
    caption: `Slide ${serial} · ${image.width}×${image.height}`,
    width: image.width,
    height: image.height,
  };
}

function createInitialItems(count = 3): LightboxGalleryItem[] {
  return Array.from({ length: count }, (_, i) => createItem(i));
}

const INITIAL_ITEMS = createInitialItems();

function DynamicItemsPanelBridge({
  items,
  autoRecover,
  onAutoRecoverChange,
  onAddItemAtStart,
  onAddItemAtEnd,
  onRemoveActive,
  onRemoveAt,
  onReset,
  isRemoving,
}: {
  items: LightboxGalleryItem[];
  autoRecover: boolean;
  onAutoRecoverChange: (next: boolean) => void;
  onAddItemAtStart: () => void;
  onAddItemAtEnd: () => void;
  onRemoveActive: () => void;
  onRemoveAt: (index: number) => void;
  onReset: () => void;
  isRemoving: (item: LightboxGalleryItem) => boolean;
}) {
  const { activeIndex, itemCount } = useLightboxContext();
  return (
    <DynamicItemsPanel
      items={items}
      activeIndex={activeIndex}
      itemCount={itemCount}
      autoRecover={autoRecover}
      onAutoRecoverChange={onAutoRecoverChange}
      onAddItemAtStart={onAddItemAtStart}
      onAddItemAtEnd={onAddItemAtEnd}
      onRemoveActive={onRemoveActive}
      onRemoveAt={onRemoveAt}
      onReset={onReset}
      isRemoving={isRemoving}
    />
  );
}

/**
 * Dev-only: default docs chrome with an in-viewer dropdown to add/remove slides
 * while the lightbox stays open — collaborative-editor stress test.
 */
export default function DynamicItemsDebugPage() {
  if (process.env.NODE_ENV === 'production') {
    notFound();
  }

  const [items, setItems] = React.useState(INITIAL_ITEMS);
  const [activeIndex, setActiveIndex] = React.useState(0);
  const [autoRecover, setAutoRecover] = React.useState(false);
  const [triggerMode, setTriggerMode] = React.useState<TriggerMode>('synced');
  const [fixedTriggers, setFixedTriggers] = React.useState(() =>
    INITIAL_ITEMS.slice(0, INITIAL_TRIGGER_COUNT),
  );
  const itemSeedRef = React.useRef(INITIAL_ITEMS.length);

  const { isRemoving, removeAt, clearPending } = useAnimatedItemRemoval({
    items,
    setItems,
    activeIndex,
    setActiveIndex,
    autoRecover,
  });

  const removeActive = React.useCallback(() => {
    const item = items[activeIndex];
    if (item && isRemoving(item)) return;
    removeAt(activeIndex);
  }, [activeIndex, items, isRemoving, removeAt]);

  const addItemAtEnd = React.useCallback(() => {
    const seed = itemSeedRef.current++;
    setItems((prev) => [...prev, createItem(seed)]);
  }, []);

  const addItemAtStart = React.useCallback(() => {
    const seed = itemSeedRef.current++;
    setItems((prev) => [createItem(seed), ...prev]);
    setActiveIndex((ai) => ai + 1);
  }, []);

  const resetItems = React.useCallback(() => {
    clearPending();
    nextItemSerial = 1;
    itemSeedRef.current = 3;
    const next = createInitialItems();
    setItems(next);
    setFixedTriggers(next.slice(0, INITIAL_TRIGGER_COUNT));
    setActiveIndex(0);
  }, [clearPending]);

  const handleRemoveAt = React.useCallback(
    (index: number) => {
      const item = items[index];
      if (!item?.id || isRemoving(item)) return;
      removeAt(index);
    },
    [items, isRemoving, removeAt],
  );

  const handleTriggerModeChange = React.useCallback(
    (value: TriggerMode | null) => {
      if (!value) return;
      setTriggerMode(value);
      if (value === 'fixed') {
        setFixedTriggers(items.slice(0, INITIAL_TRIGGER_COUNT));
      }
    },
    [items],
  );

  const triggerItems = triggerMode === 'synced' ? items : fixedTriggers;

  const panelProps = {
    items,
    autoRecover,
    onAutoRecoverChange: setAutoRecover,
    onAddItemAtStart: addItemAtStart,
    onAddItemAtEnd: addItemAtEnd,
    onRemoveActive: removeActive,
    onRemoveAt: handleRemoveAt,
    onReset: resetItems,
    isRemoving,
  };

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-6 py-12">
      <header>
        <p className="text-[11px] font-semibold tracking-widest text-amber-700 uppercase dark:text-amber-400">
          Debug · development only
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">
          Dynamic items
        </h1>
        <p className="mt-3 max-w-2xl text-base leading-relaxed text-neutral-600 dark:text-neutral-400">
          Open the lightbox, then use the Items dropdown to add or remove slides without
          closing the viewer. Toggle auto-recover to compare raw library behavior vs.
          app-level reconciliation when the active slide disappears.
        </p>
      </header>

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-neutral-900 dark:text-neutral-100">What to verify</h2>
        <ul className="list-disc space-y-1 pl-5 text-sm text-neutral-600 dark:text-neutral-400">
          <li>Counter and thumbnail strip update as items mount/unmount</li>
          <li>Removing a non-active slide reindexes remaining slides (array-index model)</li>
          <li>With auto-recover off, deleting the active slide can leave a blank viewer</li>
          <li>With auto-recover on, deleting the active slide jumps to the nearest neighbor</li>
          <li>Slides and thumbnails dissolve out before unmounting (380ms ease-out)</li>
          <li>With auto-recover on, the viewer steps to a neighbor after the fade completes</li>
          <li>
            Fixed triggers: page grid stays at {INITIAL_TRIGGER_COUNT} tiles (frozen thumbs,
            index-bound); synced triggers grow/shrink with the gallery
          </li>
        </ul>
      </section>

      <fieldset className="space-y-3 rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
        <legend className="px-1 text-sm font-medium text-neutral-900 dark:text-neutral-100">
          Trigger mode
        </legend>
        <RadioGroup
          value={triggerMode}
          onValueChange={handleTriggerModeChange}
          className="gap-3"
        >
          <Label className="cursor-pointer font-normal">
            <RadioGroupItem value="synced" />
            Synced — new page triggers appear when slides are added
          </Label>
          <Label className="cursor-pointer font-normal">
            <RadioGroupItem value="fixed" />
            Fixed — page triggers stay at {INITIAL_TRIGGER_COUNT} tiles (thumbs frozen, still open
            by index)
          </Label>
        </RadioGroup>
      </fieldset>

      <Lightbox.Root value={activeIndex} onValueChange={setActiveIndex}>
        <div className="grid max-w-md grid-cols-3 gap-3">
          {triggerItems.map((item, i) => (
            <Lightbox.Trigger
              key={triggerMode === 'fixed' ? `fixed-${i}` : item.id}
              index={i}
              className={`block overflow-hidden rounded-2xl ${triggerFocusClass}${
                triggerMode === 'synced' && isRemoving(item) ? ' dynamic-items-thumb-removing' : ''
              }`}
            >
              {({ imageRef }) => (
                <Image
                  ref={imageRef}
                  src={item.thumb as StaticImageData}
                  alt={item.alt}
                  placeholder="blur"
                  sizes="140px"
                  className="aspect-square w-full object-cover"
                />
              )}
            </Lightbox.Trigger>
          ))}
        </div>
        <p className="mt-2 text-xs text-neutral-500">
          {triggerItems.length} page trigger{triggerItems.length === 1 ? '' : 's'} (
          {triggerMode}) · {items.length} slide{items.length === 1 ? '' : 's'} in gallery
        </p>

        <DynamicItemsGallery
          items={items}
          ariaLabel="Dynamic items debug gallery"
          isRemoving={isRemoving}
          overlay={<DynamicItemsPanelBridge {...panelProps} />}
        />
      </Lightbox.Root>
    </div>
  );
}
