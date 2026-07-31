'use client';

import * as React from 'react';

import type { LightboxGalleryItem } from '../../_components/lightbox-chrome';

import './dynamic-items.css';

/** Matches `--dynamic-item-remove-duration` in dynamic-items.css */
export const DYNAMIC_ITEM_REMOVE_MS = 380;

function itemKey(item: LightboxGalleryItem): string {
  return String(item.id ?? item.src);
}

function reconcileActiveIndex(
  activeIndex: number,
  removedIndex: number,
  nextLength: number,
  autoRecover: boolean,
): number {
  if (nextLength === 0) return 0;
  if (autoRecover && removedIndex === activeIndex) {
    return Math.min(activeIndex, nextLength - 1);
  }
  if (removedIndex < activeIndex) return activeIndex - 1;
  if (activeIndex >= nextLength) return nextLength - 1;
  return activeIndex;
}

export function useAnimatedItemRemoval({
  items,
  setItems,
  activeIndex,
  setActiveIndex,
  autoRecover,
}: {
  items: LightboxGalleryItem[];
  setItems: React.Dispatch<React.SetStateAction<LightboxGalleryItem[]>>;
  activeIndex: number;
  setActiveIndex: React.Dispatch<React.SetStateAction<number>>;
  autoRecover: boolean;
}) {
  const [removingIds, setRemovingIds] = React.useState<ReadonlySet<string>>(() => new Set());
  const timersRef = React.useRef<Map<string, number>>(new Map());
  const itemsRef = React.useRef(items);
  const activeIndexRef = React.useRef(activeIndex);
  const autoRecoverRef = React.useRef(autoRecover);

  itemsRef.current = items;
  activeIndexRef.current = activeIndex;
  autoRecoverRef.current = autoRecover;

  const clearPending = React.useCallback(() => {
    timersRef.current.forEach((id) => window.clearTimeout(id));
    timersRef.current.clear();
    setRemovingIds(new Set());
  }, []);

  React.useEffect(() => clearPending, [clearPending]);

  const isRemoving = React.useCallback(
    (item: LightboxGalleryItem) => removingIds.has(itemKey(item)),
    [removingIds],
  );

  const removeAt = React.useCallback(
    (index: number) => {
      const snapshot = itemsRef.current;
      const item = snapshot[index];
      if (!item) return;

      const key = itemKey(item);
      if (timersRef.current.has(key)) return;

      const ai = activeIndexRef.current;
      const isActive = index === ai;
      const wasActive = isActive;

      setRemovingIds((prev) => new Set(prev).add(key));

      const timer = window.setTimeout(() => {
        timersRef.current.delete(key);
        setItems((prev) => {
          const removeIndex = prev.findIndex((entry) => itemKey(entry) === key);
          if (removeIndex === -1) return prev;
          const next = prev.filter((entry) => itemKey(entry) !== key);
          setActiveIndex((current) => {
            if (next.length === 0) return 0;
            if (autoRecoverRef.current && wasActive) {
              return Math.min(removeIndex, next.length - 1);
            }
            return reconcileActiveIndex(current, removeIndex, next.length, autoRecoverRef.current);
          });
          return next;
        });
        setRemovingIds((prev) => {
          if (!prev.has(key)) return prev;
          const next = new Set(prev);
          next.delete(key);
          return next;
        });
      }, DYNAMIC_ITEM_REMOVE_MS);

      timersRef.current.set(key, timer);
    },
    [setActiveIndex, setItems],
  );

  return { removingIds, isRemoving, removeAt, clearPending };
}
