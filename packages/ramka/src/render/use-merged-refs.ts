'use client';

/*!
 * Adapted from Base UI (@base-ui/utils), MIT licensed.
 * Copyright (c) 2019 Material-UI SAS — see THIRD-PARTY-NOTICES.md.
 */

import * as React from 'react';

type Ref<T> = React.Ref<T> | undefined;

interface ForkRef<T> {
  callback: React.RefCallback<T> | null;
  cleanup: (() => void) | null;
  refs: Ref<T>[];
}

/**
 * Merges up to three refs into one stable callback ref, so a part's own ref,
 * the consumer's ref, and a `render` element's ref all see the same node.
 *
 * The callback identity only changes when one of the inputs does, which matters
 * because React detaches and reattaches a ref whose identity changed — a new
 * callback every render would mean a `null` then re-attach on every commit.
 *
 * React 19 ref callbacks may return a cleanup function; those are collected and
 * run on detach. The merged callback itself returns nothing, which is what
 * React 18 requires.
 */
function useMergedRefs<T>(a?: Ref<T>, b?: Ref<T>, c?: Ref<T>): React.RefCallback<T> | null {
  const forkRef = useLazyRef<ForkRef<T>>(createForkRef).current;

  if (forkRef.refs[0] !== a || forkRef.refs[1] !== b || forkRef.refs[2] !== c) {
    update(forkRef, [a, b, c]);
  }

  return forkRef.callback;
}

function createForkRef<T>(): ForkRef<T> {
  return { callback: null, cleanup: null, refs: [] };
}

function update<T>(forkRef: ForkRef<T>, refs: Ref<T>[]): void {
  forkRef.refs = refs;

  if (refs.every((ref) => ref == null)) {
    forkRef.callback = null;
    return;
  }

  forkRef.callback = (instance: T | null) => {
    if (forkRef.cleanup) {
      forkRef.cleanup();
      forkRef.cleanup = null;
    }
    if (instance == null) return;

    const cleanups: Array<(() => void) | null> = refs.map(() => null);
    refs.forEach((ref, i) => {
      if (ref == null) return;
      if (typeof ref === 'function') {
        const returned = ref(instance);
        if (typeof returned === 'function') cleanups[i] = returned;
      } else {
        (ref as React.MutableRefObject<T | null>).current = instance;
      }
    });

    forkRef.cleanup = () => {
      refs.forEach((ref, i) => {
        if (ref == null) return;
        if (typeof ref === 'function') {
          const cleanup = cleanups[i];
          if (cleanup) cleanup();
          else ref(null);
        } else {
          (ref as React.MutableRefObject<T | null>).current = null;
        }
      });
    };
  };
}

/** `useRef` with a lazily-built initial value. */
function useLazyRef<T>(init: () => T): { current: T } {
  const ref = React.useRef<T | null>(null);
  if (ref.current === null) {
    ref.current = init();
  }
  return ref as { current: T };
}

export { useMergedRefs };
