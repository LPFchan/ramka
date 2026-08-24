'use client';

/*!
 * Adapted from Base UI (@base-ui/react), MIT licensed.
 * Copyright (c) 2019 Material-UI SAS — see THIRD-PARTY-NOTICES.md.
 */

import * as React from 'react';

import { getElementRef } from '../react-compat';
import { mergeProps } from './merge-props';
import { useMergedRefs } from './use-merged-refs';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyProps = Record<string, any>;

/** Maps a state field onto the data attributes it should render as. */
type StateAttributesMapping<State> = {
  [Key in keyof State]?: (value: State[Key]) => Record<string, string> | null;
};

/** A `render` prop: an element to clone, or a function returning one. */
type RenderProp<State> =
  | React.ReactElement
  | ((props: AnyProps, state: State) => React.ReactElement);

interface UseRenderParameters<State, RenderedElementType extends Element> {
  /** Element or function that replaces the part's default element. */
  render?: RenderProp<State> | undefined;
  /** Ref for the rendered element, merged with the element's other refs. */
  ref?: React.Ref<RenderedElementType> | undefined;
  /**
   * Part state. Passed to a `render` callback and, unless remapped, rendered as
   * `data-*` attributes so it can be styled from CSS.
   */
  state?: State | undefined;
  /**
   * Overrides how state fields become attributes.
   * @example { disabled: (value) => (value ? { 'data-disabled': '' } : null) }
   */
  stateAttributesMapping?: StateAttributesMapping<State> | undefined;
  /**
   * Props for the rendered element, already merged by the part.
   *
   * Typed as `object` rather than `Record<string, unknown>` because React's
   * element prop types are intersections of interfaces, which TypeScript
   * refuses to hand an implicit index signature.
   */
  props?: object | undefined;
  /** Element to render when there is no `render` prop. @default 'div' */
  defaultTagName?: keyof React.JSX.IntrinsicElements | undefined;
}

const EMPTY_STATE = Object.freeze({});

const COMPONENT_IDENTIFIER_PATTERN = /^[A-Z][A-Za-z0-9$]*$/;
const LOWERCASE_CHARACTER_PATTERN = /[a-z]/;

/**
 * Renders a part's element: its default tag, a cloned `render` element, or the
 * result of a `render` callback — with state exposed as data attributes and
 * every ref aimed at the same node.
 */
function useRender<State extends Record<string, unknown>, RenderedElementType extends Element>(
  params: UseRenderParameters<State, RenderedElementType>,
): React.ReactElement {
  const { render, ref, state, stateAttributesMapping, props, defaultTagName = 'div' } = params;

  const outProps: AnyProps = {
    ...getStateAttributes(state, stateAttributesMapping),
    ...props,
  };

  // A `render` element brings its own ref, which has to survive the clone.
  outProps.ref = useMergedRefs(outProps.ref, getElementRef(render), ref);

  return renderElement(defaultTagName, render, outProps, state ?? (EMPTY_STATE as State));
}

function renderElement<State>(
  tagName: keyof React.JSX.IntrinsicElements,
  render: RenderProp<State> | undefined,
  props: AnyProps,
  state: State,
): React.ReactElement {
  if (typeof render === 'function') {
    if (process.env.NODE_ENV !== 'production') {
      warnIfRenderLooksLikeComponent(render);
    }
    return render(props, state);
  }

  if (render) {
    const merged = mergeProps<'div'>(props, (render.props ?? undefined) as AnyProps);
    // The merge treats `ref` as an ordinary prop, so put the merged ref back.
    merged.ref = props.ref;

    if (process.env.NODE_ENV !== 'production') {
      if (!React.isValidElement(render)) {
        throw new Error(
          '[ramka] The `render` prop got something that is not a React element. It is cloned ' +
            'with the part’s props, so it has to be an element — or a function returning one.',
        );
      }
    }

    return React.cloneElement(render, merged);
  }

  if (tagName === 'button') {
    return React.createElement('button', { type: 'button', ...props });
  }
  return React.createElement(tagName, props);
}

/**
 * `render` is called as a plain function, so a component passed straight in
 * would run its hooks inside the parent's render — a rules-of-hooks violation
 * that only surfaces later, as a confusing crash.
 */
function warnIfRenderLooksLikeComponent(render: (...args: never[]) => unknown): void {
  const name = render.name;
  if (
    name.length === 0 ||
    !COMPONENT_IDENTIFIER_PATTERN.test(name) ||
    !LOWERCASE_CHARACTER_PATTERN.test(name)
  ) {
    return;
  }
  // eslint-disable-next-line no-console
  console.warn(
    `[ramka] The \`render\` prop got a function named \`${name}\`, which looks like a component. ` +
      'It is called as a plain function, so its hooks would run in the wrong place. Pass ' +
      '`render={<Component />}` or `render={(props) => <Component {...props} />}` instead.',
  );
}

/**
 * `{ active: true, index: 2 }` becomes `data-active=""` and `data-index="2"`.
 * Falsy values render nothing, so `[data-active]` means what it says.
 */
function getStateAttributes<State extends Record<string, unknown>>(
  state: State | undefined,
  mapping: StateAttributesMapping<State> | undefined,
): Record<string, string> {
  const attributes: Record<string, string> = {};
  if (!state) return attributes;

  for (const key in state) {
    const value = state[key];
    if (mapping && Object.prototype.hasOwnProperty.call(mapping, key)) {
      const custom = mapping[key]?.(value as State[typeof key]);
      if (custom != null) Object.assign(attributes, custom);
      continue;
    }
    if (value === true) {
      attributes[`data-${key.toLowerCase()}`] = '';
    } else if (value) {
      attributes[`data-${key.toLowerCase()}`] = String(value);
    }
  }
  return attributes;
}

// eslint-disable-next-line @typescript-eslint/no-namespace
namespace useRender {
  /** Props of a part: everything its element accepts, plus `render`. */
  export type ComponentProps<
    ElementType extends React.ElementType,
    State = object,
  > = React.ComponentPropsWithRef<ElementType> & {
    /**
     * Replaces the part's default element with another tag or component.
     * Accepts an element to clone, or a function that returns one.
     */
    render?: RenderProp<State> | undefined;
  };
  /** Props of a part's element, without `render`. */
  export type ElementProps<ElementType extends React.ElementType> =
    React.ComponentPropsWithRef<ElementType>;
}

export { useRender };
export type { StateAttributesMapping };
