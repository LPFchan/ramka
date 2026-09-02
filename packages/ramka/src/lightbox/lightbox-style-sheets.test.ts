import { afterEach, describe, expect, it, vi } from 'vitest';

import { insertDynamicRules } from './lightbox-style-sheets';
import { stubConstructedSheets, type ConstructedSheetsStub } from './lightbox-style-sheets-test-utils';
import { ensureLibrarySheet } from './vt-style-sheets';

let stub: ConstructedSheetsStub | null = null;

afterEach(() => {
  vi.useRealTimers();
  stub?.restore();
  stub = null;
  document.documentElement.removeAttribute('data-ramka-view-transition');
  document.head.querySelectorAll('style').forEach((el) => el.remove());
});

/** Everything currently adopted, as one string. */
const adopted = () => stub!.adoptedCss().join('\n');

describe('vt-style-sheets — constructed stylesheets', () => {
  it('adopts the CSS instead of putting a <style> in the document', () => {
    stub = stubConstructedSheets();

    ensureLibrarySheet('data-test-once', () => '#a { color: red }');
    const handle = insertDynamicRules('morph-vars', ['#b { color: blue }'], 'data-test-handle');

    // The whole point: CSP's style-src has nothing to block.
    expect(document.head.querySelectorAll('style')).toHaveLength(0);
    expect(adopted()).toContain('#a { color: red }');
    expect(adopted()).toContain('#b { color: blue }');
    handle.release();
  });

  it('adopts a once-only sheet a single time per marker', () => {
    stub = stubConstructedSheets();
    const buildCss = vi.fn(() => '#a { color: red }');

    ensureLibrarySheet('data-test-once', buildCss);
    ensureLibrarySheet('data-test-once', buildCss);

    expect(buildCss).toHaveBeenCalledTimes(1);
    expect(stub.adoptedCss().filter(Boolean)).toHaveLength(1);
  });

  it('adopts every dynamic channel in a single assignment', () => {
    // Each adoptedStyleSheets change is a full-document restyle in WebKit, so
    // the channels must arrive together, not one per first use.
    stub = stubConstructedSheets();
    const before = document.adoptedStyleSheets.length;

    insertDynamicRules('media-fill', ['#a { width: 100% }'], 'data-test-fill');
    const afterFirst = document.adoptedStyleSheets.length;
    insertDynamicRules('morph-vars', ['#b { color: blue }'], 'data-test-vars');

    expect(afterFirst).toBe(before + 4);
    expect(document.adoptedStyleSheets.length).toBe(afterFirst);
  });

  it('defers rule deletion to idle and keeps the channel sheets adopted', () => {
    vi.useFakeTimers();
    stub = stubConstructedSheets();
    const consumerSheet = new CSSStyleSheet();
    consumerSheet.replaceSync('#consumer { color: green }');
    document.adoptedStyleSheets = [consumerSheet];

    const handle = insertDynamicRules('morph-vars', ['#ours { color: blue }'], 'data-test-handle');
    const sheetCount = document.adoptedStyleSheets.length;

    handle.release();
    // Deletion is deferred: `deleteRule` is a full-document restyle in WebKit,
    // paid at idle rather than inside the morph teardown.
    expect(adopted()).toContain('#ours { color: blue }');

    vi.advanceTimersByTime(1500);

    expect(adopted()).not.toContain('#ours { color: blue }');
    // The consumer's sheet and the (now empty) channel sheets stay adopted —
    // removing a sheet would itself force a full restyle.
    expect(adopted()).toContain('#consumer { color: green }');
    expect(document.adoptedStyleSheets.length).toBe(sheetCount);
  });

  it('holds the deletion batch while a morph is running', () => {
    vi.useFakeTimers();
    stub = stubConstructedSheets();

    const handle = insertDynamicRules('morph-vars', ['#ours { color: blue }'], 'data-test-handle');
    document.documentElement.setAttribute('data-ramka-view-transition', 'opening');
    handle.release();

    vi.advanceTimersByTime(1500);
    expect(adopted()).toContain('#ours { color: blue }');

    document.documentElement.removeAttribute('data-ramka-view-transition');
    vi.advanceTimersByTime(1500);
    expect(adopted()).not.toContain('#ours { color: blue }');
  });

  it('survives an engine that refuses a rule, keeping the rest', () => {
    stub = stubConstructedSheets();
    const insertRule = CSSStyleSheet.prototype.insertRule;
    vi.spyOn(CSSStyleSheet.prototype, 'insertRule').mockImplementation(function (
      this: CSSStyleSheet,
      rule: string,
      index?: number,
    ) {
      if (rule.includes('#refused')) throw new Error('unsupported selector');
      return insertRule.call(this, rule, index);
    });

    insertDynamicRules('morph-vars', ['#refused { color: red }', '#kept { color: blue }'], 'data-test');

    expect(adopted()).not.toContain('#refused');
    expect(adopted()).toContain('#kept { color: blue }');
  });
});

describe('vt-style-sheets — <style> fallback', () => {
  it('falls back to an element when the engine has no constructable sheets', () => {
    ensureLibrarySheet('data-test-once', () => '#a { color: red }');

    const el = document.head.querySelector('style[data-test-once]');
    expect(el?.textContent).toBe('#a { color: red }');
  });

  it('prepends the fallback element when asked, so consumer CSS cascades after it', () => {
    document.head.appendChild(document.createElement('style'));

    ensureLibrarySheet('data-test-once', () => '#a { color: red }', true);

    expect(document.head.firstElementChild?.hasAttribute('data-test-once')).toBe(true);
  });

  it('re-creates a fallback element that was removed from the document', () => {
    ensureLibrarySheet('data-test-once', () => '#a { color: red }');
    document.head.querySelector('style[data-test-once]')!.remove();

    ensureLibrarySheet('data-test-once', () => '#a { color: red }');

    expect(document.head.querySelectorAll('style[data-test-once]')).toHaveLength(1);
  });

  it('joins dynamic rules into one marker element and removes it synchronously on release', () => {
    const handle = insertDynamicRules(
      'morph-vars',
      ['#b { color: blue }', '#c { color: cyan }'],
      'data-test-handle',
    );

    const el = document.head.querySelector('style[data-test-handle]');
    expect(el?.textContent).toBe('#b { color: blue }\n#c { color: cyan }');

    handle.release();

    expect(document.head.querySelectorAll('style[data-test-handle]')).toHaveLength(0);
  });
});
