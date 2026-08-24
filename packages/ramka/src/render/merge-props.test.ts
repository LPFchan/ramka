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

  it('keeps whichever className is present when only one is', () => {
    expect(mergeProps<'div'>({ className: 'internal' }, {}).className).toBe('internal');
    expect(mergeProps<'div'>({}, { className: 'consumer' }).className).toBe('consumer');
  });

  it('merges style objects, rightmost declaration winning', () => {
    const merged = mergeProps<'div'>(
      { style: { position: 'relative', width: '100%' } },
      { style: { width: '50%' } },
    );

    expect(merged.style).toEqual({ position: 'relative', width: '50%' });
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
