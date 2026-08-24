import { describe, expect, it, vi } from 'vitest';

import { mergeProps } from './merge-props';

/**
 * Prop merging is what makes a part composable: a consumer's handler must not
 * clobber the internal one that closes the lightbox, and vice versa. These pin
 * the merge rules the parts rely on.
 */
describe('mergeProps', () => {
  it('lets the rightmost object win an ordinary conflict', () => {
    const merged = mergeProps<'div'>({ id: 'ours', tabIndex: 0 }, { id: 'theirs' });

    expect(merged.id).toBe('theirs');
    expect(merged.tabIndex).toBe(0);
  });

  it('skips absent prop sets', () => {
    const merged = mergeProps<'div'>({ id: 'ours' }, undefined, { tabIndex: 1 });

    expect(merged).toEqual({ id: 'ours', tabIndex: 1 });
  });

  it('chains event handlers, rightmost first', () => {
    const order: string[] = [];
    const merged = mergeProps<'button'>(
      { onClick: () => order.push('internal') },
      { onClick: () => order.push('consumer') },
    );

    merged.onClick?.({} as never);

    // The consumer sees the click before the part acts on it.
    expect(order).toEqual(['consumer', 'internal']);
  });

  it('steps over a handler key whose value is explicitly undefined', () => {
    const order: string[] = [];
    const merged = mergeProps<'button'>(
      { onClick: () => order.push('internal') },
      { onClick: undefined },
      { onClick: () => order.push('consumer') },
    );

    merged.onClick?.({} as never);

    expect(order).toEqual(['consumer', 'internal']);
  });

  it('keeps a lone handler callable, from either side', () => {
    const ours = vi.fn();
    const theirs = vi.fn();

    mergeProps<'button'>({ onClick: ours }, {}).onClick?.({} as never);
    mergeProps<'button'>({}, { onClick: theirs }).onClick?.({} as never);

    expect(ours).toHaveBeenCalledTimes(1);
    expect(theirs).toHaveBeenCalledTimes(1);
  });

  it('passes every argument and returns the rightmost handler’s value', () => {
    const ours = vi.fn();
    const theirs = vi.fn(() => 'from theirs');
    const merged = mergeProps<'div'>(
      { onPointerDown: ours as never },
      { onPointerDown: theirs as never },
    );

    const event = { type: 'pointerdown' };
    const returned = (merged.onPointerDown as unknown as (e: unknown, x: number) => unknown)(
      event,
      42,
    );

    expect(returned).toBe('from theirs');
    expect(ours).toHaveBeenCalledWith(event, 42);
    expect(theirs).toHaveBeenCalledWith(event, 42);
  });

  // The parts also chain callbacks that are not DOM events — `onOpenChange`,
  // `onIndexChange` — whose first argument is a plain value rather than an
  // event. Nothing in the chaining may assume an event-shaped argument.
  it.each([[true], [13], ['a string'], [{ key: 'value' }], [['value']], [() => 'value']])(
    'chains callbacks whose first argument is %o',
    (argument) => {
      const order: string[] = [];
      const merged = mergeProps<'div'>(
        { onValueChange: () => order.push('internal') } as never,
        { onValueChange: () => order.push('consumer') } as never,
      );

      (merged as Record<string, (value: unknown) => void>).onValueChange!(argument);

      expect(order).toEqual(['consumer', 'internal']);
    },
  );

  it('forwards every argument to a lone non-event callback', () => {
    const handler = vi.fn();
    const merged = mergeProps<'div'>({}, { onOpenChange: handler } as never);
    const details = { reason: 'test' };

    (merged as Record<string, (...args: unknown[]) => void>).onOpenChange!(true, details);

    expect(handler).toHaveBeenCalledWith(true, details);
  });

  it('treats only on[A-Z] props as handlers', () => {
    const only = () => 'kept';
    const merged = mergeProps<'div'>({ onceUpon: only } as never, {
      online: 'not a handler',
    } as never);

    expect((merged as Record<string, unknown>).onceUpon).toBe(only);
    expect((merged as Record<string, unknown>).online).toBe('not a handler');
  });

  it('concatenates className with the rightmost class first', () => {
    const merged = mergeProps<'div'>({ className: 'internal' }, { className: 'consumer' });

    expect(merged.className).toBe('consumer internal');
  });

  it('concatenates three classNames, still rightmost first', () => {
    const merged = mergeProps<'div'>(
      { className: 'one' },
      { className: 'two' },
      { className: 'three' },
    );

    expect(merged.className).toBe('three two one');
  });

  it('keeps whichever className is present when only one is', () => {
    expect(mergeProps<'div'>({ className: 'internal' }, {}).className).toBe('internal');
    expect(mergeProps<'div'>({}, { className: 'consumer' }).className).toBe('consumer');
  });

  // An absent className must stay absent rather than become the string
  // "undefined", which would render as a class and break `[class]` selectors.
  it('leaves className and style undefined when neither side has them', () => {
    const merged = mergeProps<'div'>({ id: 'x' }, { tabIndex: 0 });

    expect(merged.className).toBeUndefined();
    expect(merged.style).toBeUndefined();
  });

  it('does not stringify an explicitly undefined className', () => {
    expect(mergeProps<'div'>({ className: 'internal' }, { className: undefined }).className).toBe(
      'internal',
    );
  });

  it('merges style objects, rightmost declaration winning', () => {
    const merged = mergeProps<'div'>(
      { style: { position: 'relative', width: '100%' } },
      { style: { width: '50%' } },
    );

    expect(merged.style).toEqual({ position: 'relative', width: '50%' });
  });

  it('keeps whichever style is present when only one is', () => {
    expect(mergeProps<'div'>({ style: { color: 'red' } }, {}).style).toEqual({ color: 'red' });
    expect(mergeProps<'div'>({}, { style: { color: 'blue' } }).style).toEqual({ color: 'blue' });
  });

  it('keeps the existing style when the other side passes style: undefined', () => {
    const merged = mergeProps<'div'>({ style: { color: 'red' } }, { style: undefined });

    expect(merged.style).toEqual({ color: 'red' });
  });

  it('does not merge ref — the rightmost simply wins', () => {
    const ours = { current: null };
    const theirs = { current: null };

    expect(mergeProps<'div'>({ ref: ours }, { ref: theirs }).ref).toBe(theirs);
  });

  it('merges four sets left to right', () => {
    const order: string[] = [];
    const merged = mergeProps<'div'>(
      { id: 'a', onClick: () => order.push('a') },
      { id: 'b' },
      { className: 'c' },
      { id: 'd', onClick: () => order.push('d') },
    );

    merged.onClick?.({} as never);

    expect(merged.id).toBe('d');
    expect(merged.className).toBe('c');
    expect(order).toEqual(['d', 'a']);
  });

  it('does not mutate the objects it was given', () => {
    const ours = { className: 'internal', onClick: () => {} };
    const theirs = { className: 'consumer' };

    mergeProps<'div'>(ours, theirs);

    expect(ours.className).toBe('internal');
    expect(theirs.className).toBe('consumer');
  });
});
