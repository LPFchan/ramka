'use client';

import * as React from 'react';

/**
 * Options for {@link useLightboxScrollSync}.
 *
 * Mirrors the controlled/uncontrolled shape of both `Lightbox.Root` and
 * `ScrollGallery.Root`, plus the navigation options that must stay identical
 * on both to avoid drift (`loop`, `orientation`, `scrollBehavior`).
 */
interface UseLightboxScrollSyncOptions {
  /** Uncontrolled initial active index. @default 0 */
  defaultValue?: number;
  /** Controlled active index. When provided, the hook is fully controlled. */
  value?: number;
  /** Fires whenever the active index changes (deduped against no-op updates). */
  onValueChange?: (index: number) => void;
  /**
   * Wrap navigation at the boundaries. Applied to BOTH roots so keyboard,
   * markers, and swipe all agree on wrapping behavior.
   * @default false
   */
  loop?: boolean;
  /** Scroll orientation of the composed gallery. @default 'horizontal' */
  orientation?: 'horizontal' | 'vertical';
  /** Programmatic scroll behavior for the gallery. @default 'smooth' */
  scrollBehavior?: 'smooth' | 'instant';
}

interface LightboxRootSyncProps {
  value: number;
  onValueChange: (index: number) => void;
  loop: boolean;
}

interface ScrollGalleryRootSyncProps {
  value: number;
  onValueChange: (index: number) => void;
  loop: boolean;
  orientation: 'horizontal' | 'vertical';
  scrollBehavior: 'smooth' | 'instant';
}

interface UseLightboxScrollSyncReturn {
  /** The single shared active index. */
  activeIndex: number;
  /** Imperatively set the active index (deduped against the current value). */
  setActiveIndex: (index: number) => void;
  /** Spread onto `Lightbox.Root`. */
  lightboxRootProps: LightboxRootSyncProps;
  /** Spread onto `ScrollGallery.Root`. */
  scrollGalleryRootProps: ScrollGalleryRootSyncProps;
}

/**
 * Wires a `Lightbox.Root` and a nested `ScrollGallery.Root` to a single
 * source of truth for the active index.
 *
 * Composing a lightbox with a scroll gallery otherwise requires hand-lifting
 * one piece of state and feeding it to both roots' `value`/`onValueChange`,
 * which is easy to get subtly wrong (feedback loops, mismatched `loop`, and
 * interrupting scroll momentum). This hook owns that state, dedupes redundant
 * updates coming from either root, and returns ready-to-spread prop bags that
 * keep `loop`, `orientation`, and `scrollBehavior` consistent.
 *
 * @example
 * const sync = useLightboxScrollSync({ loop: true, scrollBehavior: 'instant' });
 * return (
 *   <Lightbox.Root viewTransition {...sync.lightboxRootProps}>
 *     <Lightbox.Content>
 *       <ScrollGallery.Root {...sync.scrollGalleryRootProps}>
 *         ...
 *       </ScrollGallery.Root>
 *     </Lightbox.Content>
 *   </Lightbox.Root>
 * );
 */
function useLightboxScrollSync(options: UseLightboxScrollSyncOptions = {}): UseLightboxScrollSyncReturn {
  const {
    defaultValue = 0,
    value: valueProp,
    onValueChange,
    loop = false,
    orientation = 'horizontal',
    scrollBehavior = 'smooth',
  } = options;

  const isControlled = valueProp !== undefined;
  const [internalIndex, setInternalIndex] = React.useState(defaultValue);
  const activeIndex = isControlled ? valueProp : internalIndex;

  // Keep the latest onValueChange in a ref so setActiveIndex stays stable.
  const onValueChangeRef = React.useRef(onValueChange);
  React.useEffect(() => {
    onValueChangeRef.current = onValueChange;
  }, [onValueChange]);

  // Mirror the current index in a ref so setActiveIndex can dedupe redundant
  // updates without needing the value in its dependency array. Both roots
  // funnel their onValueChange here; when they emit the same value (e.g. the
  // value the gallery just reported from a native scroll), we skip re-firing
  // the consumer's onValueChange.
  const indexRef = React.useRef(activeIndex);
  indexRef.current = activeIndex;

  const setActiveIndex = React.useCallback(
    (index: number) => {
      if (index === indexRef.current) return;
      indexRef.current = index;
      if (!isControlled) {
        setInternalIndex(index);
      }
      onValueChangeRef.current?.(index);
    },
    [isControlled],
  );

  const lightboxRootProps = React.useMemo<LightboxRootSyncProps>(
    () => ({ value: activeIndex, onValueChange: setActiveIndex, loop }),
    [activeIndex, setActiveIndex, loop],
  );

  const scrollGalleryRootProps = React.useMemo<ScrollGalleryRootSyncProps>(
    () => ({ value: activeIndex, onValueChange: setActiveIndex, loop, orientation, scrollBehavior }),
    [activeIndex, setActiveIndex, loop, orientation, scrollBehavior],
  );

  return { activeIndex, setActiveIndex, lightboxRootProps, scrollGalleryRootProps };
}

export { useLightboxScrollSync };
export type {
  UseLightboxScrollSyncOptions,
  UseLightboxScrollSyncReturn,
  LightboxRootSyncProps,
  ScrollGalleryRootSyncProps,
};
