import { afterEach, describe, expect, it, vi } from 'vitest';

import { insertLibrarySheet } from './lightbox-style-sheets';
import { stubConstructedSheets, type ConstructedSheetsStub } from './lightbox-style-sheets-test-utils';
import { ensureLibrarySheet } from './vt-style-sheets';

let stub: ConstructedSheetsStub | null = null;

afterEach(() => {
  stub?.restore();
  stub = null;
  document.head.querySelectorAll('style').forEach((el) => el.remove());
});

describe('vt-style-sheets — constructed stylesheets', () => {
  it('adopts the CSS instead of putting a <style> in the document', () => {
    stub = stubConstructedSheets();

    ensureLibrarySheet('data-test-once', () => '#a { color: red }');
    const handle = insertLibrarySheet('#b { color: blue }', 'data-test-handle');

    // The whole point: CSP's style-src has nothing to block.
    expect(document.head.querySelectorAll('style')).toHaveLength(0);
    expect(stub.adoptedCss()).toEqual(['#a { color: red }', '#b { color: blue }']);
    handle.release();
  });

  it('adopts a once-only sheet a single time per marker', () => {
    stub = stubConstructedSheets();
    const buildCss = vi.fn(() => '#a { color: red }');

    ensureLibrarySheet('data-test-once', buildCss);
    ensureLibrarySheet('data-test-once', buildCss);

    expect(buildCss).toHaveBeenCalledTimes(1);
    expect(stub.adoptedCss()).toHaveLength(1);
  });

  it('releases only its own sheet, leaving the consumer’s adopted sheets alone', () => {
    stub = stubConstructedSheets();
    const consumerSheet = new CSSStyleSheet();
    consumerSheet.replaceSync('#consumer { color: green }');
    document.adoptedStyleSheets = [consumerSheet];

    const handle = insertLibrarySheet('#ours { color: blue }', 'data-test-handle');
    expect(stub.adoptedCss()).toHaveLength(2);

    handle.release();

    expect(stub.adoptedCss()).toEqual(['#consumer { color: green }']);
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

  it('removes the fallback element on release', () => {
    insertLibrarySheet('#b { color: blue }', 'data-test-handle').release();

    expect(document.head.querySelectorAll('style[data-test-handle]')).toHaveLength(0);
  });
});
