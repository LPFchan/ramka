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
  // The production-mode cases stub NODE_ENV, which would otherwise leak into
  // every test that runs after them in this file.
  vi.unstubAllEnvs();
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

  it('falls back to a div when no default tag is named', () => {
    function Bare() {
      return useRender({ props: { 'data-testid': 'probe' } });
    }
    render(<Bare />);

    expect(screen.getByTestId('probe').tagName).toBe('DIV');
  });

  it('lets a render element override the default tag', () => {
    render(<Probe tag="button" data-testid="probe" render={<span />} />);

    expect(screen.getByTestId('probe').tagName).toBe('SPAN');
  });
});

describe('state as data attributes', () => {
  it('renders true as an empty attribute and other values stringified', () => {
    render(<Probe data-testid="probe" state={{ active: true, index: 2 }} />);

    const el = screen.getByTestId('probe');
    expect(el).toHaveAttribute('data-active', '');
    expect(el).toHaveAttribute('data-index', '2');
  });

  // The DOM lowercases attribute names on its own, so the only place the
  // casing is observable is the props object — which a `render` callback sees,
  // and which a consumer spreads onto something that is not an HTML element.
  it('lowercases a camelCase state field', () => {
    const seen: Array<Record<string, unknown>> = [];
    render(
      <Probe
        state={{ zoomLevel: 2, isOpen: true }}
        render={(props) => {
          seen.push(props);
          return <span data-testid="probe" {...props} />;
        }}
      />,
    );

    expect(Object.keys(seen[0]!)).toEqual(
      expect.arrayContaining(['data-zoomlevel', 'data-isopen']),
    );
    expect(seen[0]!['data-zoomlevel']).toBe('2');
    expect(screen.getByTestId('probe')).toHaveAttribute('data-isopen', '');
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
          // A hash target: jsdom refuses to navigate anywhere else, and the
          // click below is what proves both handlers ran.
          <a href="#x" className="theirs" onClick={() => order.push('render')} />
        }
      />,
    );

    const el = screen.getByTestId('probe');
    expect(el.tagName).toBe('A');
    expect(el).toHaveAttribute('href', '#x');
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

  // The check exists only to replace React's message with one that names the
  // prop, so production drops it and lets React object on its own terms.
  it('leaves the diagnostic out of production, where React reports it instead', () => {
    vi.stubEnv('NODE_ENV', 'production');

    let message = '';
    try {
      render(<Probe render={'just a string' as unknown as React.ReactElement} />);
    } catch (error) {
      message = (error as Error).message;
    }

    expect(message).not.toBe('');
    expect(message).not.toMatch(/not a React element/);
  });

  // A code-split component is the realistic lazy case, and the one that works
  // the same on React 18 and 19.
  it('clones an element whose type is lazy, once it has loaded', async () => {
    function LazyDiv(props: React.ComponentProps<'div'>) {
      return <div data-lazy="true" {...props} />;
    }
    const Lazy = React.lazy(async () => ({ default: LazyDiv }));

    render(
      <React.Suspense fallback={<span>loading</span>}>
        <Probe className="internal" render={<Lazy data-testid="probe" />} />
      </React.Suspense>,
    );

    const el = await screen.findByTestId('probe');
    expect(el).toHaveAttribute('data-lazy', 'true');
    expect(el).toHaveClass('internal');
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

  it('hands the function an empty state object when the part has none', () => {
    const seen: unknown[] = [];
    render(
      <Probe
        data-testid="probe"
        render={(props, state) => {
          seen.push(state);
          return <span {...props} />;
        }}
      />,
    );

    expect(seen[0]).toEqual({});
  });

  // That empty state is a frozen module-level object, so anything that wrote to
  // it would throw here rather than in a consumer's app.
  it('does not write to the shared empty state', () => {
    expect(() =>
      render(<Probe data-testid="probe" className="mine" style={{ color: 'red' }} />),
    ).not.toThrow();

    expect(screen.getByTestId('probe')).toHaveClass('mine');
  });

  it('leaves an absent className absent rather than rendering "undefined"', () => {
    render(<Probe render={(props) => <span {...props} data-testid="probe" />} />);

    expect(screen.getByTestId('probe').className).toBe('');
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

  it('warns for an acronym-prefixed component name', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    render(<Probe render={function SVGThing(props) { return <span {...props} />; }} />);

    expect(warn).toHaveBeenCalledWith(expect.stringContaining('looks like a component'));
  });

  // A name that is not a plain identifier is not a component reference, so
  // there is nothing to warn about.
  it.each(['RENDER_THING', 'render_thing'])('stays quiet for a callback named %s', (name) => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const fn = Object.defineProperty(
      (props: Record<string, unknown>) => <span {...props} />,
      'name',
      { value: name },
    );

    render(<Probe render={fn} />);

    expect(warn).not.toHaveBeenCalled();
  });

  it('stays quiet for an anonymous callback', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const fn = Object.defineProperty(
      (props: Record<string, unknown>) => <span {...props} />,
      'name',
      { value: '' },
    );

    render(<Probe render={fn} />);

    expect(warn).not.toHaveBeenCalled();
  });

  // The warning is a development aid, so it costs consumers nothing in a
  // production build even when the callback would have tripped it.
  it('stays quiet in production for a callback that would warn in development', () => {
    vi.stubEnv('NODE_ENV', 'production');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    render(<Probe data-testid="probe" render={function Thing(props) { return <span {...props} />; }} />);

    expect(screen.getByTestId('probe')).toBeInTheDocument();
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
