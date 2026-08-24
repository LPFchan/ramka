import { render, screen } from '@testing-library/react';
import * as React from 'react';
import { describe, expect, it, vi } from 'vitest';

import { useMergedRefs } from './use-merged-refs';

/**
 * Three refs can point at one part's element: the part's own, the consumer's,
 * and one on a `render` element. Losing any of them is a silent failure — a
 * gesture handler that never binds, a morph that never finds its node — so the
 * forking, the detaching and the callback identity are all pinned here.
 */
describe('useMergedRefs', () => {
  function Div({
    a,
    b,
    c,
    ...rest
  }: {
    a?: React.Ref<HTMLDivElement>;
    b?: React.Ref<HTMLDivElement>;
    c?: React.Ref<HTMLDivElement>;
  } & React.ComponentProps<'div'>) {
    return <div {...rest} ref={useMergedRefs(a, b, c)} />;
  }

  it('sends the node to all three refs', () => {
    const object = React.createRef<HTMLDivElement>();
    const seen: Array<HTMLDivElement | null> = [];
    const collect = (node: HTMLDivElement | null) => {
      seen.push(node);
    };

    render(<Div a={object} b={collect} c={collect} data-testid="probe" />);

    const el = screen.getByTestId('probe');
    expect(object.current).toBe(el);
    expect(seen).toEqual([el, el]);
  });

  it('returns no callback at all when every ref is absent', () => {
    const seen: Array<React.RefCallback<HTMLDivElement> | null> = [];

    function Bare() {
      seen.push(useMergedRefs<HTMLDivElement>(undefined, undefined, undefined));
      return <div data-testid="probe" />;
    }
    render(<Bare />);

    expect(seen[0]).toBeNull();
    expect(screen.getByTestId('probe')).toBeInTheDocument();
  });

  it('attaches a ref that appears on a later render', () => {
    const late = React.createRef<HTMLDivElement>();
    const view = render(<Div data-testid="probe" />);
    expect(late.current).toBeNull();

    view.rerender(<Div a={late} data-testid="probe" />);

    expect(late.current).toBe(screen.getByTestId('probe'));
  });

  it('clears a ref that is swapped out, and fills the one that replaces it', () => {
    const kept = React.createRef<HTMLDivElement>();
    const dropped = React.createRef<HTMLDivElement>();
    const added = React.createRef<HTMLDivElement>();

    const view = render(<Div a={kept} b={dropped} data-testid="probe" />);
    const el = screen.getByTestId('probe');
    expect(kept.current).toBe(el);
    expect(dropped.current).toBe(el);

    view.rerender(<Div a={kept} b={added} data-testid="probe" />);

    expect(kept.current).toBe(el);
    expect(dropped.current).toBeNull();
    expect(added.current).toBe(el);
  });

  it('keeps one identity while the refs hold still, so the node is never detached', () => {
    const stable = React.createRef<HTMLDivElement>();
    const callbacks = new Set<unknown>();

    function Rerendered({ id }: { id: string }) {
      callbacks.add(useMergedRefs<HTMLDivElement>(stable));
      return <div id={id} data-testid="probe" />;
    }

    const view = render(<Rerendered id="one" />);
    view.rerender(<Rerendered id="two" />);

    expect(callbacks.size).toBe(1);
  });

  it('clears object refs and calls function refs with null on unmount', () => {
    const object = React.createRef<HTMLDivElement>();
    const fn = vi.fn();

    const view = render(<Div a={object} b={fn} data-testid="probe" />);
    expect(object.current).not.toBeNull();

    view.unmount();

    expect(object.current).toBeNull();
    expect(fn).toHaveBeenLastCalledWith(null);
  });

  // React 19 lets a ref callback return a cleanup function. When one does, that
  // cleanup replaces the `null` call rather than joining it.
  it('prefers a returned cleanup over calling the ref with null', () => {
    const cleanup = vi.fn();
    const withCleanup = vi.fn(() => cleanup);
    const withoutCleanup = vi.fn();

    const view = render(
      <Div a={withCleanup} b={withoutCleanup} data-testid="probe" />,
    );
    expect(cleanup).not.toHaveBeenCalled();

    view.unmount();

    expect(cleanup).toHaveBeenCalledTimes(1);
    expect(withCleanup).toHaveBeenCalledTimes(1);
    expect(withoutCleanup).toHaveBeenLastCalledWith(null);
  });
});
