import { render, screen } from '@testing-library/react';
import * as React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useRender } from './use-render';

/**
 * Every part renders through `useRender`, so this covers the contract the parts
 * assume: state becomes data attributes, `render` replaces or wraps the
 * element, and every ref aimed at the part reaches the same node.
 */

afterEach(() => {
  vi.restoreAllMocks();
});

interface ProbeState extends Record<string, unknown> {
  active?: boolean;
  index?: number;
}

function Probe(
  props: useRender.ComponentProps<'div', ProbeState> & {
    state?: ProbeState;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    stateAttributesMapping?: any;
    tag?: 'div' | 'button';
  },
) {
  const { render: renderProp, state, stateAttributesMapping, tag, ...elementProps } = props;
  return useRender({
    render: renderProp,
    state,
    stateAttributesMapping,
    props: elementProps,
    defaultTagName: tag ?? 'div',
  });
}

describe('default element', () => {
  it('renders the default tag with the given props', () => {
    render(<Probe data-testid="probe" className="mine" />);

    const el = screen.getByTestId('probe');
    expect(el.tagName).toBe('DIV');
    expect(el).toHaveClass('mine');
  });

  it('gives a button a type so it never submits a surrounding form', () => {
    render(<Probe tag="button" data-testid="probe" />);

    expect(screen.getByTestId('probe')).toHaveAttribute('type', 'button');
  });
});

describe('state as data attributes', () => {
  it('renders true as an empty attribute and other values stringified', () => {
    render(<Probe data-testid="probe" state={{ active: true, index: 2 }} />);

    const el = screen.getByTestId('probe');
    expect(el).toHaveAttribute('data-active', '');
    expect(el).toHaveAttribute('data-index', '2');
  });

  it('omits falsy state so a presence selector means what it says', () => {
    render(<Probe data-testid="probe" state={{ active: false, index: 0 }} />);

    const el = screen.getByTestId('probe');
    expect(el).not.toHaveAttribute('data-active');
    expect(el).not.toHaveAttribute('data-index');
  });

  it('lets a mapping rename the attribute, or drop it by returning null', () => {
    render(
      <Probe
        data-testid="probe"
        state={{ active: true, index: 5 }}
        stateAttributesMapping={{
          active: (value: boolean) => (value ? { 'data-open': 'yes' } : null),
          index: () => null,
        }}
      />,
    );

    const el = screen.getByTestId('probe');
    expect(el).toHaveAttribute('data-open', 'yes');
    expect(el).not.toHaveAttribute('data-active');
    expect(el).not.toHaveAttribute('data-index');
  });

  it('lets props win over a state attribute of the same name', () => {
    render(<Probe data-testid="probe" state={{ active: true }} data-active="overridden" />);

    expect(screen.getByTestId('probe')).toHaveAttribute('data-active', 'overridden');
  });
});

describe('render prop as an element', () => {
  it('clones the element, merging props and chaining handlers', () => {
    const order: string[] = [];
    render(
      <Probe
        data-testid="probe"
        className="internal"
        onClick={() => order.push('internal')}
        render={
          // eslint-disable-next-line jsx-a11y/anchor-is-valid
          <a href="/x" className="theirs" onClick={() => order.push('render')} />
        }
      />,
    );

    const el = screen.getByTestId('probe');
    expect(el.tagName).toBe('A');
    expect(el).toHaveAttribute('href', '/x');
    expect(el.className).toBe('theirs internal');

    el.click();
    expect(order).toEqual(['render', 'internal']);
  });

  it('keeps the render element’s own ref working alongside the part’s', () => {
    const theirs = React.createRef<HTMLElement>();
    const ours = React.createRef<HTMLElement>();

    function WithRef() {
      return useRender({
        ref: ours,
        props: { 'data-testid': 'probe' },
        render: <section ref={theirs} />,
      });
    }
    render(<WithRef />);

    const el = screen.getByTestId('probe');
    expect(theirs.current).toBe(el);
    expect(ours.current).toBe(el);
  });

  it('throws a readable error in development when render is not an element', () => {
    expect(() =>
      render(<Probe render={'just a string' as unknown as React.ReactElement} />),
    ).toThrow(/not a React element/);
  });
});

describe('render prop as a function', () => {
  it('hands the function the merged props and the state', () => {
    const seen: Array<Record<string, unknown>> = [];
    render(
      <Probe
        data-testid="probe"
        state={{ active: true }}
        render={(props, state) => {
          seen.push({ props, state });
          return <span {...props} />;
        }}
      />,
    );

    expect(screen.getByTestId('probe').tagName).toBe('SPAN');
    expect(seen).toHaveLength(1);
    expect(seen[0]!.state).toEqual({ active: true });
    expect((seen[0]!.props as Record<string, unknown>)['data-active']).toBe('');
  });

  it('warns when the function looks like a component, since its hooks would misfire', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    render(<Probe render={function Thing(props) { return <span {...props} />; }} />);

    expect(warn).toHaveBeenCalledWith(expect.stringContaining('looks like a component'));
  });

  it('stays quiet for an ordinary render callback', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    render(<Probe render={function renderSpan(props) { return <span {...props} />; }} />);

    expect(warn).not.toHaveBeenCalled();
  });
});

describe('refs', () => {
  it('sends the node to a callback ref and an object ref together', () => {
    const object = React.createRef<HTMLDivElement>();
    const seen: Array<HTMLDivElement | null> = [];

    function WithRefs() {
      return useRender<Record<string, unknown>, HTMLDivElement>({
        ref: object,
        props: { 'data-testid': 'probe', ref: (node: HTMLDivElement | null) => seen.push(node) },
      });
    }
    const view = render(<WithRefs />);

    const el = screen.getByTestId('probe');
    expect(object.current).toBe(el);
    expect(seen[0]).toBe(el);

    view.unmount();
    expect(object.current).toBeNull();
    expect(seen[seen.length - 1]).toBeNull();
  });

  it('runs a React 19 style ref cleanup on detach', () => {
    const cleanup = vi.fn();

    function WithCleanupRef() {
      return useRender<Record<string, unknown>, HTMLDivElement>({
        props: { 'data-testid': 'probe', ref: () => cleanup },
      });
    }
    const view = render(<WithCleanupRef />);
    expect(cleanup).not.toHaveBeenCalled();

    view.unmount();
    expect(cleanup).toHaveBeenCalledTimes(1);
  });

  it('keeps the same merged callback across renders, so the node is not detached', () => {
    const attaches: Array<HTMLDivElement | null> = [];
    const stable = (node: HTMLDivElement | null) => attaches.push(node);

    function Rerendered({ label }: { label: string }) {
      return useRender<Record<string, unknown>, HTMLDivElement>({
        props: { 'data-testid': 'probe', 'aria-label': label, ref: stable },
      });
    }
    const view = render(<Rerendered label="one" />);
    view.rerender(<Rerendered label="two" />);

    expect(screen.getByTestId('probe')).toHaveAttribute('aria-label', 'two');
    expect(attaches).toEqual([screen.getByTestId('probe')]);
  });
});
