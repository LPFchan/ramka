'use client';

import * as React from 'react';
import { ChevronDown, ListPlus, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

import type { LightboxGalleryItem } from '../../../_components/lightbox-chrome';

export type DynamicItemsPanelProps = {
  items: LightboxGalleryItem[];
  activeIndex: number;
  itemCount: number;
  autoRecover: boolean;
  isRemoving: (item: LightboxGalleryItem) => boolean;
  onAutoRecoverChange: (next: boolean) => void;
  onAddItemAtStart: () => void;
  onAddItemAtEnd: () => void;
  onRemoveActive: () => void;
  onRemoveAt: (index: number) => void;
  onReset: () => void;
};

/**
 * In-viewer controls for mutating the gallery list while the lightbox is open.
 */
export function DynamicItemsPanel({
  items,
  activeIndex,
  itemCount,
  autoRecover,
  isRemoving,
  onAutoRecoverChange,
  onAddItemAtStart,
  onAddItemAtEnd,
  onRemoveActive,
  onRemoveAt,
  onReset,
}: DynamicItemsPanelProps) {
  const activeItem = items[activeIndex];
  const activeLabel = activeItem?.caption ?? activeItem?.alt ?? `Slide ${activeIndex + 1}`;
  const activeRemoving = activeItem ? isRemoving(activeItem) : false;

  return (
    <div
      className="pointer-events-auto absolute left-1/2 top-[calc(0.75rem+env(safe-area-inset-top,0px))] z-40 flex max-w-[min(100%-1.5rem,36rem)] -translate-x-1/2 flex-col gap-2 rounded-xl border border-white/20 bg-black/45 p-3 text-white shadow-lg backdrop-blur-xl backdrop-saturate-150 lightbox-demo-chrome-hide"
      data-testid="dynamic-items-panel"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-medium tracking-wide text-white/80 uppercase">Dynamic items</p>
        <span className="rounded-md bg-white/10 px-2 py-0.5 font-mono text-[11px] tabular-nums text-white/70">
          index {activeIndex} · count {itemCount}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="secondary"
                size="sm"
                className="border-white/15 bg-white/15 text-white hover:bg-white/25"
              />
            }
          >
            <ListPlus data-icon="inline-start" />
            Items
            <ChevronDown data-icon="inline-end" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            <DropdownMenuGroup>
              <DropdownMenuLabel>Mutate gallery</DropdownMenuLabel>
              <DropdownMenuItem onClick={onAddItemAtStart}>Add slide at beginning</DropdownMenuItem>
              <DropdownMenuItem onClick={onAddItemAtEnd}>Add slide at end</DropdownMenuItem>
              <DropdownMenuItem disabled={items.length === 0 || activeRemoving} onClick={onRemoveActive}>
                <Trash2 />
                Remove current slide
              </DropdownMenuItem>
            </DropdownMenuGroup>
            {items.length > 0 ? (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger inset>Remove by slide</DropdownMenuSubTrigger>
                  <DropdownMenuSubContent className="max-h-64 overflow-y-auto">
                    {items.map((item, i) => (
                      <DropdownMenuItem
                        key={item.id ?? i}
                        disabled={isRemoving(item)}
                        onClick={() => onRemoveAt(i)}
                      >
                        {i === activeIndex ? '● ' : ''}
                        {item.caption ?? item.alt ?? `Slide ${i + 1}`}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
              </>
            ) : null}
            <DropdownMenuSeparator />
            <DropdownMenuCheckboxItem
              checked={autoRecover}
              onCheckedChange={(checked) => onAutoRecoverChange(checked === true)}
            >
              Auto-recover active slide
            </DropdownMenuCheckboxItem>
            <DropdownMenuItem onClick={onReset}>Reset to 3 slides</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <span className="min-w-0 truncate text-xs text-white/65">
          Viewing: <span className="text-white/90">{activeLabel}</span>
        </span>
      </div>

      <p className="text-[11px] leading-relaxed text-white/60">
        Simulate collaborative edits while the viewer stays open. The active slide
        dissolves before unmount; auto-recover waits for that fade before jumping to a
        neighbor.
      </p>
    </div>
  );
}
