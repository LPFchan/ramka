/*!
 * Adapted from Base UI (@base-ui/react), MIT licensed.
 * Copyright (c) 2019 Material-UI SAS — see THIRD-PARTY-NOTICES.md.
 */

import type * as React from 'react';

/**
 * Merges sets of React props, `Object.assign`-style: the rightmost object wins
 * a conflict. Three props are special-cased instead of overwritten:
 *
 * - event handlers are chained, rightmost first, so a consumer's `onClick`
 *   runs before the part's internal one and neither is lost;
 * - `className` strings are concatenated, rightmost first;
 * - `style` objects are merged, with rightmost declarations winning.
 *
 * `ref` is not merged here — `useRender` merges refs separately, because a
 * part's own ref, the consumer's ref, and a `render` element's ref all have to
 * land on the same node.
 *
 * Base UI also accepts props *getters* and lets a handler cancel the ones
 * merged before it (`event.preventBaseUIHandler()`). Neither is used here, so
 * neither was carried over.
 */
type PropsOf<T extends React.ElementType> = React.ComponentPropsWithRef<T>;
type InputProps<T extends React.ElementType> = PropsOf<T> | undefined;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyProps = Record<string, any>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type EventHandler = (...args: any[]) => unknown;

function mergeProps<T extends React.ElementType>(
  a: InputProps<T>,
  b: InputProps<T>,
  c: InputProps<T>,
  d: InputProps<T>,
): PropsOf<T>;
function mergeProps<T extends React.ElementType>(
  a: InputProps<T>,
  b: InputProps<T>,
  c: InputProps<T>,
): PropsOf<T>;
function mergeProps<T extends React.ElementType>(a: InputProps<T>, b: InputProps<T>): PropsOf<T>;
function mergeProps<T extends React.ElementType>(...propSets: InputProps<T>[]): PropsOf<T> {
  const merged: AnyProps = { ...(propSets[0] as AnyProps | undefined) };
  for (let i = 1; i < propSets.length; i += 1) {
    const next = propSets[i] as AnyProps | undefined;
    if (!next) continue;
    for (const key in next) {
      const value = next[key];
      if (key === 'style') {
        merged.style = mergeStyles(merged.style, value);
      } else if (key === 'className') {
        merged.className = mergeClassNames(merged.className, value);
      } else if (isEventHandlerProp(key, value)) {
        merged[key] = chainEventHandlers(merged[key], value);
      } else {
        merged[key] = value;
      }
    }
  }
  return merged as PropsOf<T>;
}

/** `onClick`, `onPointerDown`, … — an `on` prefix followed by a capital. */
function isEventHandlerProp(key: string, value: unknown): value is EventHandler | undefined {
  return (
    key.charCodeAt(0) === 111 /* o */ &&
    key.charCodeAt(1) === 110 /* n */ &&
    key.charCodeAt(2) >= 65 /* A */ &&
    key.charCodeAt(2) <= 90 /* Z */ &&
    (typeof value === 'function' || typeof value === 'undefined')
  );
}

function chainEventHandlers(
  ours: EventHandler | undefined,
  theirs: EventHandler | undefined,
): EventHandler | undefined {
  if (!theirs) return ours;
  if (!ours) return theirs;
  // Theirs first: the outer caller's handler should observe the event before
  // an internal one gets a chance to close the lightbox or navigate away.
  return (...args) => {
    const result = theirs(...args);
    ours(...args);
    return result;
  };
}

function mergeClassNames(ours?: string, theirs?: string): string | undefined {
  if (!theirs) return ours;
  if (!ours) return theirs;
  return `${theirs} ${ours}`;
}

function mergeStyles(
  ours: React.CSSProperties | undefined,
  theirs: React.CSSProperties | undefined,
): React.CSSProperties | undefined {
  if (!ours) return theirs;
  if (!theirs) return ours;
  return { ...ours, ...theirs };
}

export { mergeClassNames, mergeProps, mergeStyles };
