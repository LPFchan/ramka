import { render, screen } from '@testing-library/react';
import * as React from 'react';
import { describe, expect, it } from 'vitest';

import { getElementRef, inertWhen } from './react-compat';

/**
 * These two helpers exist only because React 18 and React 19 disagree, so the
 * point of testing them is that the same call works on both. CI runs the suite
 * against each major, which is what makes these assertions worth anything.
 */
describe('getElementRef', () => {
  it('finds the ref on an element, wherever this React keeps it', () => {
    const ref = React.createRef<HTMLDivElement>();

    expect(getElementRef(<div ref={ref} />)).toBe(ref);
  });

  it('returns null for an element without one', () => {
    expect(getElementRef(<div />)).toBeNull();
  });

  it('returns null for a fragment, which cannot take a ref', () => {
    expect(
      getElementRef(
        <React.Fragment>
          <p>one</p>
        </React.Fragment>,
      ),
    ).toBeNull();
  });

  // Listed inline rather than through `it.each`, whose test-name formatter
  // crashes trying to inspect a React 18 element.
  it('returns null for anything that is not a single element', () => {
    expect(getElementRef(false)).toBeNull();
    expect(getElementRef(undefined)).toBeNull();
    expect(getElementRef(null)).toBeNull();
    expect(getElementRef(1)).toBeNull();
    expect(getElementRef('a string')).toBeNull();
    expect(getElementRef([<div key="1" />, <div key="2" />])).toBeNull();
  });
});

describe('inertWhen', () => {
  it('spreads nothing when the condition is false', () => {
    expect(inertWhen(false)).toEqual({});
  });

  // React 18 drops `inert={true}` and React 19 drops `inert=""`, so the only
  // spelling that survives both is a non-empty string. Assert the rendered
  // attribute rather than the prop, since that is what fails in the browser.
  it('renders an inert attribute on both React majors when true', () => {
    render(
      <div data-testid="parked" {...inertWhen(true)}>
        <button type="button">unreachable</button>
      </div>,
    );

    expect(screen.getByTestId('parked')).toHaveAttribute('inert');
  });

  it('reuses one object so spreading it does not churn props', () => {
    expect(inertWhen(true)).toBe(inertWhen(true));
  });
});
