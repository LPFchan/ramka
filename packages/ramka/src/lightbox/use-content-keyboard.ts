'use client';

import * as React from 'react';

import { arrowKeyIndexDelta, type TextDirection } from './lightbox-direction';
import type { LightboxCloseOptions, NavigationSource } from './lightbox-context';
import type { ActiveZoomControls } from './lightbox-zoom-context';
import type { InitializedRef } from '../react-compat';

interface UseContentKeyboardOptions {
  mounted: boolean;
  contentRef: React.RefObject<HTMLDivElement | null>;
  setOpen: (open: boolean, options?: LightboxCloseOptions) => void;
  activeZoomRef: React.RefObject<ActiveZoomControls | null>;
  stageElementRef: React.MutableRefObject<HTMLElement | null>;
  itemCount: number;
  loop: boolean;
  activeIndex: number;
  navigate: (index: number, source: NavigationSource) => void;
  /** Reading direction — mirrors the horizontal arrow keys. */
  dir: TextDirection;
  /**
   * True while a `Lightbox.Slides` user scroll/fling is in flight. Discrete
   * keyboard zoom is dropped — applying a zoom animation mid-swipe aborts
   * compositor scrolling without `scrollend` and freezes pull/pinch/thumbs.
   */
  isScrollingRef?: InitializedRef<boolean>;
}

/**
 * Keyboard is owned entirely by Content — the single authority while focus
 * is inside this dialog. Portaled overlays (menu, dialog, etc.) keep focus
 * outside this subtree; React still re-bubbles their key events through the
 * React tree, so ignore keys whose DOM target is outside this host element.
 */
export function useContentKeyboard({
  mounted,
  contentRef,
  setOpen,
  activeZoomRef,
  stageElementRef,
  itemCount,
  loop,
  activeIndex,
  navigate,
  dir,
  isScrollingRef,
}: UseContentKeyboardOptions): (event: React.KeyboardEvent) => void {
  return React.useCallback(
    (event: React.KeyboardEvent) => {
      // Parked keepMounted content stays in the DOM but must not handle keys.
      if (!mounted) return;

      const el = contentRef.current;
      const target = event.target as Node | null;
      if (el && target && !el.contains(target)) return;

      // A descendant (e.g. a Lightbox.Slides viewport or the thumbnail
      // group) already handled this key and called preventDefault. Defer so
      // navigation has a single authority and we don't double-handle it.
      if (event.defaultPrevented) return;

      // Close on Escape. Handled here (rather than a document listener) so it
      // stays scoped to the focused instance: focus is contained within this
      // dialog, so with multiple lightboxes open only the active one closes.
      if (event.key === 'Escape') {
        event.preventDefault();
        // Keyboard-driven close → restore a visible focus ring on the trigger.
        setOpen(false, { focusVisible: true });
        return;
      }

      // Typing surfaces (skin reply boxes, search fields) own every key
      // except Escape — swallowing "+" / "-" / arrows here would eat the
      // user's input. Escape (above) still closes the dialog.
      const targetEl = target instanceof HTMLElement ? target : null;
      if (
        targetEl &&
        (targetEl.isContentEditable ||
          targetEl.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"])'))
      ) {
        return;
      }

      const zoomCtl = activeZoomRef.current;

      // Modified shortcuts belong to the browser and the OS. ⌘/Ctrl + `+`,
      // `-`, `0` are the browser's page-zoom controls — the primary WCAG
      // 1.4.4 text-resize mechanism — and Alt/⌘ + arrows are history and
      // caret navigation. Never handle or preventDefault them: page zoom
      // must keep working while the dialog is open, so a user can enlarge
      // the viewer's controls and captions independently of the image.
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      // When Stage is mounted, media actions (image zoom, arrows / Home /
      // End, zoomed pan) run while focus is inside Stage — or on Content
      // itself (default focus after open). Without Stage, Content is the
      // stage. Escape stays dialog-scoped.
      const stage = stageElementRef.current;
      const focusOutsideStage =
        !!stage && !!target && target !== el && !stage.contains(target);

      // Image zoom rides the *unmodified* keys only, so it coexists with
      // browser page zoom (above). Runs when focus is in Stage (or Content,
      // when Stage is absent / dialog-focused).
      // Bare `=` counts as zoom-in: `+` is the shifted character of that key
      // on common layouts, and viewers (Maps, Figma, Preview) accept both.
      // Bare `0` resets, mirroring the browser's ⌘/Ctrl+0 idiom.
      const zoomInKey = event.key === '+' || event.key === '=';
      const zoomOutKey = event.key === '-' || event.key === '_';
      const zoomResetKey = event.key === '0';
      if (zoomInKey || zoomOutKey || zoomResetKey) {
        event.preventDefault();
        // Don't start image zoom until the scroller has settled (same guard
        // as ZoomIn/ZoomOut clicks).
        if (isScrollingRef?.current) return;
        if (zoomCtl && !focusOutsideStage) {
          if (zoomInKey) zoomCtl.zoomIn();
          else if (zoomOutKey) zoomCtl.zoomOut();
          else zoomCtl.reset();
        }
        return;
      }

      const isArrow = event.key.startsWith('Arrow');
      const isGalleryNavKey =
        isArrow || event.key === 'Home' || event.key === 'End';

      if (isGalleryNavKey && focusOutsideStage) {
        return;
      }

      // While zoomed in, arrows pan the active slide instead of navigating.
      // Panning stays *physical* in both reading directions: this is direct
      // manipulation of a 2D surface, not travel through an ordered list, so
      // ArrowRight moves the viewport right the way it does on a map.
      if (isArrow && (zoomCtl?.getZoom() ?? 1) > 1 && zoomCtl) {
        // The step is content px (screen travel scales with zoom) — unlike
        // drag/wheel, which map physical hand movement 1:1 to the screen,
        // keyboard is a discrete command over a range: the pannable range in
        // screen px grows with zoom, so content-space steps keep the press
        // count to cross the image roughly constant at any zoom.
        const d = zoomCtl.keyboardPanDistance;
        switch (event.key) {
          case 'ArrowRight':
            zoomCtl.panBy(d, 0);
            break;
          case 'ArrowLeft':
            zoomCtl.panBy(-d, 0);
            break;
          case 'ArrowDown':
            zoomCtl.panBy(0, d);
            break;
          case 'ArrowUp':
            zoomCtl.panBy(0, -d);
            break;
          default:
            return;
        }
        event.preventDefault();
        return;
      }

      if (itemCount === 0) return;

      let nextIndex: number | null = null;
      // Horizontal arrows follow the reading direction, so ArrowLeft advances
      // an RTL gallery. Vertical arrows always follow index order.
      const delta = arrowKeyIndexDelta(event.key, dir);

      if (delta !== 0) {
        nextIndex = loop
          ? (activeIndex + delta + itemCount) % itemCount
          : Math.min(Math.max(activeIndex + delta, 0), itemCount - 1);
      } else if (event.key === 'Home') {
        nextIndex = 0;
      } else if (event.key === 'End') {
        nextIndex = itemCount - 1;
      } else {
        return;
      }

      if (nextIndex !== null && nextIndex !== activeIndex) {
        event.preventDefault();
        // `navigate` routes through a mounted ThumbnailStrip so the strip
        // scrubs with discrete keyboard nav (plain setActiveIndex otherwise).
        navigate(nextIndex, 'keyboard');
      }
    },
    [
      mounted,
      activeIndex,
      itemCount,
      loop,
      navigate,
      setOpen,
      activeZoomRef,
      stageElementRef,
      isScrollingRef,
      dir,
    ],
  );
}
