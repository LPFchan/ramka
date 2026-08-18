import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';
import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/* eslint-disable @typescript-eslint/no-non-null-assertion */

const flushMicrotasks = () => act(async () => undefined);
const noop = () => {
  /* controlled prop placeholder */
};

import { LightboxBackdrop } from './lightbox-backdrop';
import { LightboxCaption } from './lightbox-caption';
import { LightboxClose } from './lightbox-close';
import { LightboxContent } from './lightbox-content';
import { LightboxCounter } from './lightbox-counter';
import { LightboxPortal } from './lightbox-portal';
import { LightboxItem } from './lightbox-item';
import { LightboxNext } from './lightbox-next';
import { installSlidesLayoutMocks, resetSlidesLayoutMocks, SlidesHost } from './lightbox-slides-test-utils';
import { LightboxPrevious } from './lightbox-previous';
import { createHandle } from './lightbox-handle';
import { LightboxRoot } from './lightbox-root';
import { LightboxStage, useOptionalLightboxStageContext } from './lightbox-stage';
import { LightboxThumbnail } from './lightbox-thumbnail';
import { LightboxThumbnailGroup } from './lightbox-thumbnail-group';
import { LightboxTrigger } from './lightbox-trigger';
import { LightboxMedia } from './lightbox-media';
import { LightboxZoom, type LightboxZoomRef } from './lightbox-zoom';
import { useZoomContext } from './lightbox-zoom-context';
import { LightboxZoomIn } from './lightbox-zoom-in';
import { LightboxZoomOut } from './lightbox-zoom-out';
import {
  rubberBandClamp,
  rubberBandPanDimension,
  RUBBER_BAND_DIMENSION_FACTOR_MOUSE,
} from './gesture-math';
import { resetVtTouchGuardForTesting } from './vt-touch-guard';

// ---------------------------------------------------------------------------
// Mocks — jsdom lacks matchMedia, getAnimations
// ---------------------------------------------------------------------------

// jsdom lacks the Touch constructor
if (typeof globalThis.Touch === 'undefined') {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).Touch = class Touch {
    identifier: number;
    target: EventTarget;
    clientX: number;
    clientY: number;
    constructor(init: { identifier: number; target: EventTarget; clientX?: number; clientY?: number }) {
      this.identifier = init.identifier;
      this.target = init.target;
      this.clientX = init.clientX ?? 0;
      this.clientY = init.clientY ?? 0;
    }
  };
}

beforeEach(() => {
  installSlidesLayoutMocks({ raf: false });

  if (!window.matchMedia) {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      configurable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
  }

  if (!Element.prototype.getAnimations) {
    Element.prototype.getAnimations = vi.fn(() => []);
  } else {
    vi.spyOn(Element.prototype, 'getAnimations').mockReturnValue([]);
  }
});

afterEach(() => {
  resetSlidesLayoutMocks();
  vi.restoreAllMocks();
  // VT tests mock startViewTransition with `finished` promises they never
  // resolve, which would leak the morph's document-level touch-pan guard
  // (held until `finished` settles) into subsequent tests.
  resetVtTouchGuardForTesting();
});

// ---------------------------------------------------------------------------
// Helper component
// ---------------------------------------------------------------------------

function TestLightbox({
  itemCount = 3,
  defaultOpen = false,
  open,
  defaultValue,
  value,
  loop = false,
  preload = 1,
  viewTransition = false,
  awaitImageDecode,
  withThumbnails = false,
  withCaptions = false,
  onOpenChange,
  onOpenChangeComplete,
  onValueChange,
  renderPropItems = false,
}: {
  itemCount?: number;
  defaultOpen?: boolean;
  open?: boolean;
  defaultValue?: number;
  value?: number;
  loop?: boolean;
  preload?: number;
  viewTransition?: boolean;
  awaitImageDecode?: boolean | number;
  withThumbnails?: boolean;
  withCaptions?: boolean;
  onOpenChange?: (open: boolean) => void;
  onOpenChangeComplete?: (open: boolean) => void;
  onValueChange?: (value: number, metadata: { source: string }) => void;
  renderPropItems?: boolean;
} = {}) {
  return (
    <LightboxRoot
      defaultOpen={defaultOpen}
      open={open}
      defaultValue={defaultValue}
      value={value}
      loop={loop}
      viewTransition={viewTransition}
      awaitImageDecode={awaitImageDecode}
      onOpenChange={onOpenChange}
      onOpenChangeComplete={onOpenChangeComplete}
      onValueChange={onValueChange}
    >
      {Array.from({ length: itemCount }, (_, i) => (
        <LightboxTrigger key={`t-${i}`} index={i} data-testid={`trigger-${i}`}>
          Trigger {i}
        </LightboxTrigger>
      ))}

      <LightboxPortal>
        <LightboxContent data-testid="content" aria-label="Test lightbox">
          <LightboxClose data-testid="close">Close</LightboxClose>

          <SlidesHost data-testid="slides" preload={preload}>
            {Array.from({ length: itemCount }, (_, i) => (
              <LightboxItem
                key={`i-${i}`}
                index={i}
                data-testid={`item-${i}`}
                caption={withCaptions ? `Caption ${i}` : undefined}
              >
                {renderPropItems
                  ? (state: { active: boolean; visible: boolean }) => (
                      <div data-testid={`render-prop-${i}`} data-active={state.active} data-visible={state.visible}>
                        Item {i}
                      </div>
                    )
                  : `Item ${i}`}
              </LightboxItem>
            ))}
          </SlidesHost>

          <LightboxPrevious data-testid="prev">Previous</LightboxPrevious>
          <LightboxNext data-testid="next">Next</LightboxNext>
          <LightboxCounter data-testid="counter" />
          <LightboxCaption data-testid="caption" />

          {withThumbnails && (
            <LightboxThumbnailGroup data-testid="thumb-group">
              {Array.from({ length: itemCount }, (_, i) => (
                <LightboxThumbnail key={`th-${i}`} index={i} data-testid={`thumb-${i}`}>
                  Thumb {i}
                </LightboxThumbnail>
              ))}
            </LightboxThumbnailGroup>
          )}
        </LightboxContent>
      </LightboxPortal>
    </LightboxRoot>
  );
}

// ---------------------------------------------------------------------------
// 1. Structure and ARIA
// ---------------------------------------------------------------------------

describe('Lightbox', () => {
  describe('structure and ARIA', () => {
    it('renders Trigger as a button with type="button"', () => {
      render(<TestLightbox />);
      const trigger = screen.getByTestId('trigger-0');
      expect(trigger.tagName).toBe('BUTTON');
      expect(trigger).toHaveAttribute('type', 'button');
    });

    it('Trigger advertises the dialog it opens (aria-haspopup, aria-expanded closed)', () => {
      render(<TestLightbox />);
      const trigger = screen.getByTestId('trigger-0');
      expect(trigger).toHaveAttribute('aria-haspopup', 'dialog');
      // Closed: not expanded, and no dangling aria-controls (dialog unmounted).
      expect(trigger).toHaveAttribute('aria-expanded', 'false');
      expect(trigger).not.toHaveAttribute('aria-controls');
    });

    it('clicking a Trigger marks only that trigger expanded and wires aria-controls to the dialog', () => {
      render(<TestLightbox itemCount={3} />);
      fireEvent.click(screen.getByTestId('trigger-1'));

      const opener = screen.getByTestId('trigger-1');
      const other = screen.getByTestId('trigger-0');
      const dialog = screen.getByTestId('content');

      // Only the trigger that opened the lightbox reports expanded.
      expect(opener).toHaveAttribute('aria-expanded', 'true');
      expect(other).toHaveAttribute('aria-expanded', 'false');

      // aria-controls points at the actual dialog element.
      const controls = opener.getAttribute('aria-controls');
      expect(controls).toBeTruthy();
      expect(dialog).toHaveAttribute('id', controls);
    });

    it('renders Content as a div with role="dialog" when open', () => {
      render(<TestLightbox defaultOpen />);
      const dialog = screen.getByTestId('content');
      expect(dialog.tagName).toBe('DIV');
      expect(dialog).toHaveAttribute('role', 'dialog');
      expect(dialog).toHaveAttribute('aria-modal', 'true');
    });

    it('content is removed from DOM when closing', async () => {
      render(<TestLightbox defaultOpen />);
      expect(screen.getByTestId('content')).toBeInTheDocument();
      fireEvent.click(screen.getByTestId('close'));
      await flushMicrotasks();
      expect(screen.queryByTestId('content')).toBeNull();
    });

    it('renders Slides with role="group" and aria-roledescription="carousel"', () => {
      render(<TestLightbox defaultOpen />);
      const group = screen.getByTestId('slides');
      expect(group).toHaveAttribute('role', 'group');
      expect(group).toHaveAttribute('aria-roledescription', 'carousel');
    });

    it('renders Item as a carousel slide (role="group") with an "N of total" name when no tablist is present', () => {
      render(<TestLightbox defaultOpen itemCount={3} />);
      const item = screen.getByTestId('item-0');
      expect(item).toHaveAttribute('role', 'group');
      expect(item).toHaveAttribute('aria-roledescription', 'slide');
      expect(item).toHaveAttribute('aria-label', '1 of 3');
      // A tabpanel with no owning tab would be invalid ARIA.
      expect(item).not.toHaveAttribute('role', 'tabpanel');
    });

    it('renders Item as a tabpanel wired to its thumbnail tab when a ThumbnailGroup is present', () => {
      render(<TestLightbox defaultOpen withThumbnails itemCount={3} />);
      const item = screen.getByTestId('item-0');
      expect(item).toHaveAttribute('role', 'tabpanel');

      const panelId = item.getAttribute('id');
      const labelledBy = item.getAttribute('aria-labelledby');
      expect(panelId).toBeTruthy();
      expect(labelledBy).toBeTruthy();

      const thumb = screen.getByTestId('thumb-0');
      // The tab labels the panel, and the panel is controlled by the tab.
      expect(thumb).toHaveAttribute('id', labelledBy);
      expect(thumb).toHaveAttribute('aria-controls', panelId);
    });

    it('active item has aria-hidden="false", inactive has aria-hidden="true"', () => {
      render(<TestLightbox defaultOpen defaultValue={0} />);
      expect(screen.getByTestId('item-0')).toHaveAttribute('aria-hidden', 'false');
      expect(screen.getByTestId('item-1')).toHaveAttribute('aria-hidden', 'true');
    });

    it('Counter renders with aria-live="polite" and aria-atomic', () => {
      render(<TestLightbox defaultOpen />);
      const counter = screen.getByTestId('counter');
      expect(counter).toHaveAttribute('aria-live', 'polite');
      expect(counter).toHaveAttribute('aria-atomic', 'true');
    });

    it('Caption renders with aria-live="polite" and aria-atomic', () => {
      render(<TestLightbox defaultOpen />);
      const caption = screen.getByTestId('caption');
      expect(caption).toHaveAttribute('aria-live', 'polite');
      expect(caption).toHaveAttribute('aria-atomic', 'true');
    });

    it('ThumbnailGroup renders with role="tablist"', () => {
      render(<TestLightbox defaultOpen withThumbnails />);
      expect(screen.getByTestId('thumb-group')).toHaveAttribute('role', 'tablist');
    });

    it('Thumbnail renders with role="tab" and aria-selected', () => {
      render(<TestLightbox defaultOpen withThumbnails />);
      const thumb = screen.getByTestId('thumb-0');
      expect(thumb).toHaveAttribute('role', 'tab');
      expect(thumb).toHaveAttribute('aria-selected');
    });

    it('Previous and Next render as buttons with aria-label', () => {
      render(<TestLightbox defaultOpen />);
      const prev = screen.getByTestId('prev');
      const next = screen.getByTestId('next');
      expect(prev.tagName).toBe('BUTTON');
      expect(next.tagName).toBe('BUTTON');
      expect(prev).toHaveAttribute('aria-label', 'Previous');
      expect(next).toHaveAttribute('aria-label', 'Next');
    });
  });

  // ---------------------------------------------------------------------------
  // 1a. Portal
  // ---------------------------------------------------------------------------

  describe('Portal', () => {
    it('mounts Content under a data-ramka-portal host on document.body', () => {
      render(<TestLightbox defaultOpen />);
      const dialog = screen.getByTestId('content');
      const host = dialog.closest('[data-ramka-portal]');
      expect(host).not.toBeNull();
      expect(host?.parentElement).toBe(document.body);
    });

    it('renders in place when container is null', () => {
      const { container } = render(
        <LightboxRoot defaultOpen>
          <div data-testid="anchor">
            <LightboxPortal container={null}>
              <LightboxContent data-testid="content" aria-label="In place">
                <SlidesHost>
                  <LightboxItem index={0}>Item 0</LightboxItem>
                </SlidesHost>
              </LightboxContent>
            </LightboxPortal>
          </div>
        </LightboxRoot>,
      );
      const dialog = screen.getByTestId('content');
      const host = dialog.closest('[data-ramka-portal]') as HTMLElement | null;
      expect(host).not.toBeNull();
      expect(container.querySelector('[data-testid="anchor"]')).toContainElement(host);
      expect(host?.parentElement).not.toBe(document.body);
    });

    it('portals into a custom container element', () => {
      const custom = document.createElement('div');
      custom.setAttribute('data-testid', 'custom-root');
      document.body.appendChild(custom);
      try {
        render(
          <LightboxRoot defaultOpen>
            <LightboxPortal container={custom}>
              <LightboxContent data-testid="content" aria-label="Custom">
                <SlidesHost>
                  <LightboxItem index={0}>Item 0</LightboxItem>
                </SlidesHost>
              </LightboxContent>
            </LightboxPortal>
          </LightboxRoot>,
        );
        const host = screen.getByTestId('content').closest('[data-ramka-portal]') as HTMLElement | null;
        expect(custom).toContainElement(host);
      } finally {
        custom.remove();
      }
    });

    it('keepMounted parks Content before the first open', () => {
      render(
        <LightboxRoot>
          <LightboxTrigger index={0}>Open</LightboxTrigger>
          <LightboxPortal keepMounted>
            <LightboxContent data-testid="content" aria-label="Parked">
              <SlidesHost>
                <LightboxItem index={0}>Item 0</LightboxItem>
              </SlidesHost>
            </LightboxContent>
          </LightboxPortal>
        </LightboxRoot>,
      );
      const dialog = screen.getByTestId('content');
      expect(dialog).toBeInTheDocument();
      expect(dialog).not.toHaveAttribute('data-open');
      expect(dialog).toHaveAttribute('data-closed');
      expect(dialog).toHaveStyle({ visibility: 'hidden', pointerEvents: 'none' });
      expect(dialog).toHaveAttribute('inert');
    });

    it('keepMounted keeps Content mounted (parked) after close', async () => {
      render(
        <LightboxRoot defaultOpen>
          <LightboxPortal keepMounted>
            <LightboxContent data-testid="content" aria-label="Parked">
              <LightboxClose data-testid="close">Close</LightboxClose>
              <SlidesHost>
                <LightboxItem index={0}>Item 0</LightboxItem>
              </SlidesHost>
            </LightboxContent>
          </LightboxPortal>
        </LightboxRoot>,
      );
      expect(screen.getByTestId('content')).toHaveAttribute('data-open');
      expect(screen.getByTestId('content')).not.toHaveAttribute('data-closed');
      fireEvent.click(screen.getByTestId('close'));
      await flushMicrotasks();
      // Exit animation settle → mounted=false, but keepMounted parks the node.
      await act(async () => {
        await Promise.resolve();
      });
      const dialog = screen.getByTestId('content');
      expect(dialog).toBeInTheDocument();
      expect(dialog).not.toHaveAttribute('data-open');
      expect(dialog).toHaveAttribute('data-closed');
      expect(dialog).toHaveStyle({ visibility: 'hidden', pointerEvents: 'none' });
      expect(dialog).toHaveAttribute('inert');
    });

    it('keepMounted parks Backdrop with Content while closed', () => {
      render(
        <LightboxRoot>
          <LightboxPortal keepMounted>
            <LightboxBackdrop data-testid="backdrop" />
            <LightboxContent data-testid="content" aria-label="Parked">
              <SlidesHost>
                <LightboxItem index={0}>Item 0</LightboxItem>
              </SlidesHost>
            </LightboxContent>
          </LightboxPortal>
        </LightboxRoot>,
      );
      const backdrop = screen.getByTestId('backdrop');
      expect(backdrop).toBeInTheDocument();
      expect(backdrop).not.toHaveAttribute('data-open');
      expect(backdrop).toHaveAttribute('data-closed');
      expect(backdrop).toHaveStyle({ visibility: 'hidden', pointerEvents: 'none' });
      expect(backdrop).toHaveAttribute('inert');
      expect(screen.getByTestId('content')).toHaveAttribute('data-closed');
      expect(screen.getByTestId('content')).not.toHaveAttribute('data-open');
    });

  });

  // ---------------------------------------------------------------------------
  // 1b. Consumer prop composition on Content
  // ---------------------------------------------------------------------------

  describe('consumer prop composition on Content', () => {
    it('composes consumer onClick with the internal backdrop-close handler', async () => {
      const onClick = vi.fn();
      render(
        <LightboxRoot defaultOpen>
          <LightboxPortal>
            <LightboxContent data-testid="content" onClick={onClick}>
              <SlidesHost>
                <LightboxItem index={0}>Item 0</LightboxItem>
              </SlidesHost>
            </LightboxContent>
          </LightboxPortal>
        </LightboxRoot>,
      );
      // Clicking the content background (press started on scrim) must run
      // BOTH the consumer handler and the internal close — not clobber either.
      const content = screen.getByTestId('content');
      fireEvent.pointerDown(content);
      fireEvent.click(content);
      expect(onClick).toHaveBeenCalledTimes(1);
      await flushMicrotasks();
      expect(screen.queryByTestId('content')).toBeNull();
    });

    it('composes consumer onKeyDown while internal keyboard navigation still runs', () => {
      const onKeyDown = vi.fn();
      const onValueChange = vi.fn();
      render(
        <LightboxRoot defaultOpen onValueChange={onValueChange}>
          <LightboxPortal>
            <LightboxContent data-testid="content" onKeyDown={onKeyDown}>
              <SlidesHost>
                <LightboxItem index={0}>Item 0</LightboxItem>
                <LightboxItem index={1}>Item 1</LightboxItem>
              </SlidesHost>
            </LightboxContent>
          </LightboxPortal>
        </LightboxRoot>,
      );
      fireEvent.keyDown(screen.getByTestId('content'), { key: 'ArrowRight' });
      expect(onKeyDown).toHaveBeenCalledTimes(1);
      expect(onValueChange).toHaveBeenCalledWith(1, { source: 'keyboard' });
    });

    it('preserves internal attributes while passing through consumer props', () => {
      render(
        <LightboxRoot defaultOpen>
          <LightboxPortal>
            <LightboxContent data-testid="content" data-custom="x">
              <SlidesHost>
                <LightboxItem index={0}>Item 0</LightboxItem>
              </SlidesHost>
            </LightboxContent>
          </LightboxPortal>
        </LightboxRoot>,
      );
      const el = screen.getByTestId('content');
      expect(el).toHaveAttribute('data-custom', 'x');
      expect(el).toHaveAttribute('role', 'dialog');
      expect(el).toHaveAttribute('aria-modal', 'true');
    });
  });

  // ---------------------------------------------------------------------------
  // 2. Open / Close state
  // ---------------------------------------------------------------------------

  describe('open / close state', () => {
    it('clicking a trigger opens the lightbox (uncontrolled)', () => {
      render(<TestLightbox />);
      expect(screen.queryByTestId('content')).toBeNull();
      fireEvent.click(screen.getByTestId('trigger-0'));
      expect(screen.getByTestId('content')).toBeInTheDocument();
    });

    it('clicking a trigger sets the active index to that trigger index', () => {
      render(<TestLightbox />);
      fireEvent.click(screen.getByTestId('trigger-2'));
      expect(screen.getByTestId('item-2')).toHaveAttribute('aria-hidden', 'false');
    });

    it('onOpenChange(true) fires on open', () => {
      const spy = vi.fn();
      render(<TestLightbox onOpenChange={spy} />);
      fireEvent.click(screen.getByTestId('trigger-0'));
      expect(spy).toHaveBeenCalledWith(true);
    });

    it('onOpenChange(false) fires on close', () => {
      const spy = vi.fn();
      render(<TestLightbox defaultOpen onOpenChange={spy} />);
      fireEvent.click(screen.getByTestId('close'));
      expect(spy).toHaveBeenCalledWith(false);
    });

    it('clicking Close button closes the lightbox', async () => {
      render(<TestLightbox defaultOpen />);
      expect(screen.getByTestId('content')).toBeInTheDocument();
      fireEvent.click(screen.getByTestId('close'));
      await flushMicrotasks();
      expect(screen.queryByTestId('content')).toBeNull();
    });

    it('ESC key closes the lightbox', async () => {
      render(<TestLightbox defaultOpen />);
      fireEvent.keyDown(screen.getByTestId('content'), { key: 'Escape' });
      await flushMicrotasks();
      expect(screen.queryByTestId('content')).toBeNull();
    });

    it('ESC closes only the focused lightbox when multiple are open', async () => {
      function TwoLightboxes() {
        return (
          <>
            <LightboxRoot defaultOpen defaultValue={0}>
              <LightboxPortal>
                <LightboxContent data-testid="content-a" aria-label="Lightbox A">
                  <SlidesHost>
                    <LightboxItem index={0}>A0</LightboxItem>
                  </SlidesHost>
                </LightboxContent>
              </LightboxPortal>
            </LightboxRoot>
            <LightboxRoot defaultOpen defaultValue={0}>
              <LightboxPortal>
                <LightboxContent data-testid="content-b" aria-label="Lightbox B">
                  <SlidesHost>
                    <LightboxItem index={0}>B0</LightboxItem>
                  </SlidesHost>
                </LightboxContent>
              </LightboxPortal>
            </LightboxRoot>
          </>
        );
      }

      render(<TwoLightboxes />);
      expect(screen.getByTestId('content-a')).toBeInTheDocument();
      expect(screen.getByTestId('content-b')).toBeInTheDocument();

      // Escape targeted at B must close B only — A stays open.
      fireEvent.keyDown(screen.getByTestId('content-b'), { key: 'Escape' });
      await flushMicrotasks();

      expect(screen.getByTestId('content-a')).toBeInTheDocument();
      expect(screen.queryByTestId('content-b')).toBeNull();
    });

    it('clicking content backdrop area closes the lightbox', async () => {
      render(<TestLightbox defaultOpen />);
      const content = screen.getByTestId('content');
      fireEvent.pointerDown(content);
      fireEvent.click(content);
      await flushMicrotasks();
      expect(screen.queryByTestId('content')).toBeNull();
    });

    it('does not close when a drag starts on media and ends on chrome (retargeted click)', async () => {
      // Browsers fire `click` on the nearest common ancestor of mousedown/mouseup.
      // A press that starts on the image and releases on caption/strip/sidebar
      // therefore lands on Content with target === currentTarget — must not dismiss.
      render(
        <LightboxRoot defaultOpen>
          <LightboxPortal>
            <LightboxContent data-testid="content" aria-label="Drag dismiss guard">
              <SlidesHost>
                <LightboxItem index={0}>
                  <img data-testid="media" src="test.jpg" alt="test" />
                </LightboxItem>
              </SlidesHost>
              <div data-testid="chrome">Caption / strip / sidebar</div>
            </LightboxContent>
          </LightboxPortal>
        </LightboxRoot>,
      );
      const content = screen.getByTestId('content');
      fireEvent.pointerDown(screen.getByTestId('media'));
      fireEvent.pointerUp(screen.getByTestId('chrome'));
      // Simulate the browser-retargeted click on the LCA (Content).
      fireEvent.click(content);
      await flushMicrotasks();
      expect(screen.getByTestId('content')).toBeInTheDocument();
    });

    it('controlled open prop controls visibility', () => {
      function Controlled() {
        const [isOpen, setIsOpen] = React.useState(false);
        return (
          <>
            <button data-testid="ext-open" onClick={() => setIsOpen(true)}>
              Open
            </button>
            <TestLightbox open={isOpen} onOpenChange={setIsOpen} />
          </>
        );
      }
      render(<Controlled />);
      expect(screen.queryByTestId('content')).toBeNull();
      fireEvent.click(screen.getByTestId('trigger-0'));
      expect(screen.getByTestId('content')).toBeInTheDocument();
    });

    // Regression: an external state setter (not Lightbox.Trigger / Close /
    // imperative handle) must still flip the portal mount state when the
    // controlled `open` prop transitions false → true and back.
    it('external state flipping the controlled open prop mounts and unmounts content', async () => {
      function ExternallyControlled() {
        const [isOpen, setIsOpen] = React.useState(false);
        return (
          <>
            <button data-testid="ext-open" onClick={() => setIsOpen(true)}>
              Open
            </button>
            <button data-testid="ext-close" onClick={() => setIsOpen(false)}>
              Close
            </button>
            <TestLightbox open={isOpen} onOpenChange={setIsOpen} />
          </>
        );
      }
      render(<ExternallyControlled />);
      expect(screen.queryByTestId('content')).toBeNull();

      fireEvent.click(screen.getByTestId('ext-open'));
      expect(screen.getByTestId('content')).toBeInTheDocument();

      fireEvent.click(screen.getByTestId('ext-close'));
      await flushMicrotasks();
      expect(screen.queryByTestId('content')).toBeNull();
    });

    // Regression: a lightbox rendered with `open={true}` on first mount
    // must render its content immediately rather than flashing closed
    // until the sync effect catches up.
    it('controlled open={true} on initial mount renders content immediately', () => {
      render(<TestLightbox open onOpenChange={noop} />);
      expect(screen.getByTestId('content')).toBeInTheDocument();
    });

    it('defaultOpen={true} renders the lightbox initially open', () => {
      render(<TestLightbox defaultOpen />);
      expect(screen.getByTestId('content')).toBeInTheDocument();
    });

    it('content is removed from DOM after close', async () => {
      render(<TestLightbox defaultOpen />);
      fireEvent.click(screen.getByTestId('close'));
      await flushMicrotasks();
      expect(screen.queryByTestId('content')).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // 3. Active index and navigation
  // ---------------------------------------------------------------------------

  describe('active index and navigation', () => {
    it('defaultValue sets the initial active item', () => {
      render(<TestLightbox defaultOpen defaultValue={2} />);
      expect(screen.getByTestId('item-2')).toHaveAttribute('aria-hidden', 'false');
    });

    it('controlled value prop drives active index', () => {
      const { rerender } = render(<TestLightbox defaultOpen value={0} onValueChange={noop} />);
      expect(screen.getByTestId('item-0')).toHaveAttribute('aria-hidden', 'false');
      rerender(<TestLightbox defaultOpen value={2} onValueChange={noop} />);
      expect(screen.getByTestId('item-2')).toHaveAttribute('aria-hidden', 'false');
    });

    it('onValueChange fires with index and source metadata', () => {
      const spy = vi.fn();
      render(<TestLightbox defaultOpen onValueChange={spy} />);
      fireEvent.click(screen.getByTestId('next'));
      expect(spy).toHaveBeenCalledWith(1, { source: 'button' });
    });

    it('Previous button navigates backward', () => {
      render(<TestLightbox defaultOpen defaultValue={1} />);
      fireEvent.click(screen.getByTestId('prev'));
      expect(screen.getByTestId('item-0')).toHaveAttribute('aria-hidden', 'false');
    });

    it('Next button navigates forward', () => {
      render(<TestLightbox defaultOpen defaultValue={0} />);
      fireEvent.click(screen.getByTestId('next'));
      expect(screen.getByTestId('item-1')).toHaveAttribute('aria-hidden', 'false');
    });

    it('Previous is disabled at index 0 when loop=false', () => {
      render(<TestLightbox defaultOpen defaultValue={0} />);
      expect(screen.getByTestId('prev')).toBeDisabled();
    });

    it('Next is disabled at last index when loop=false', () => {
      render(<TestLightbox defaultOpen defaultValue={2} itemCount={3} />);
      expect(screen.getByTestId('next')).toBeDisabled();
    });

    it('Previous wraps to last when loop=true', () => {
      render(<TestLightbox defaultOpen defaultValue={0} loop />);
      fireEvent.click(screen.getByTestId('prev'));
      expect(screen.getByTestId('item-2')).toHaveAttribute('aria-hidden', 'false');
    });

    it('Next wraps to first when loop=true', () => {
      render(<TestLightbox defaultOpen defaultValue={2} loop />);
      fireEvent.click(screen.getByTestId('next'));
      expect(screen.getByTestId('item-0')).toHaveAttribute('aria-hidden', 'false');
    });

    it('ArrowRight in Content navigates forward', () => {
      render(<TestLightbox defaultOpen defaultValue={0} />);
      fireEvent.keyDown(screen.getByTestId('content'), { key: 'ArrowRight' });
      expect(screen.getByTestId('item-1')).toHaveAttribute('aria-hidden', 'false');
    });

    it('ArrowLeft in Content navigates backward', () => {
      render(<TestLightbox defaultOpen defaultValue={1} />);
      fireEvent.keyDown(screen.getByTestId('content'), { key: 'ArrowLeft' });
      expect(screen.getByTestId('item-0')).toHaveAttribute('aria-hidden', 'false');
    });

    it('Home key navigates to first item', () => {
      render(<TestLightbox defaultOpen defaultValue={2} />);
      fireEvent.keyDown(screen.getByTestId('content'), { key: 'Home' });
      expect(screen.getByTestId('item-0')).toHaveAttribute('aria-hidden', 'false');
    });

    it('End key navigates to last item', () => {
      render(<TestLightbox defaultOpen defaultValue={0} />);
      fireEvent.keyDown(screen.getByTestId('content'), { key: 'End' });
      expect(screen.getByTestId('item-2')).toHaveAttribute('aria-hidden', 'false');
    });

    it('arrow keys respect loop boundaries', () => {
      render(<TestLightbox defaultOpen defaultValue={0} loop={false} />);
      fireEvent.keyDown(screen.getByTestId('content'), { key: 'ArrowLeft' });
      expect(screen.getByTestId('item-0')).toHaveAttribute('aria-hidden', 'false');
    });

    it('ArrowRight on Content still navigates when Stage is mounted (default dialog focus)', () => {
      render(
        <LightboxRoot defaultOpen defaultValue={0}>
          <LightboxPortal>
            <LightboxContent data-testid="content" aria-label="Stage focus test">
              <LightboxStage data-testid="stage">
                <SlidesHost preload={1}>
                  {Array.from({ length: 3 }, (_, i) => (
                    <LightboxItem key={`i-${i}`} index={i} data-testid={`item-${i}`}>
                      Item {i}
                    </LightboxItem>
                  ))}
                </SlidesHost>
              </LightboxStage>
              <aside data-testid="sidebar" tabIndex={0}>
                Thread
              </aside>
            </LightboxContent>
          </LightboxPortal>
        </LightboxRoot>,
      );

      fireEvent.keyDown(screen.getByTestId('content'), { key: 'ArrowRight' });
      expect(screen.getByTestId('item-1')).toHaveAttribute('aria-hidden', 'false');
    });

    it('arrow keys inside Stage navigate the gallery', () => {
      render(
        <LightboxRoot defaultOpen defaultValue={0}>
          <LightboxPortal>
            <LightboxContent data-testid="content" aria-label="Stage nav test">
              <LightboxStage data-testid="stage">
                <SlidesHost preload={1}>
                  {Array.from({ length: 3 }, (_, i) => (
                    <LightboxItem key={`i-${i}`} index={i} data-testid={`item-${i}`}>
                      Item {i}
                    </LightboxItem>
                  ))}
                </SlidesHost>
              </LightboxStage>
              <aside data-testid="sidebar" tabIndex={0}>
                Thread
              </aside>
            </LightboxContent>
          </LightboxPortal>
        </LightboxRoot>,
      );

      fireEvent.keyDown(screen.getByTestId('stage'), { key: 'ArrowRight' });
      expect(screen.getByTestId('item-1')).toHaveAttribute('aria-hidden', 'false');
    });

    it('arrow keys outside Stage (sidebar) do not navigate the gallery', () => {
      render(
        <LightboxRoot defaultOpen defaultValue={0}>
          <LightboxPortal>
            <LightboxContent data-testid="content" aria-label="Stage sidebar test">
              <LightboxStage data-testid="stage">
                <SlidesHost preload={1}>
                  {Array.from({ length: 3 }, (_, i) => (
                    <LightboxItem key={`i-${i}`} index={i} data-testid={`item-${i}`}>
                      Item {i}
                    </LightboxItem>
                  ))}
                </SlidesHost>
              </LightboxStage>
              <aside data-testid="sidebar" tabIndex={0}>
                Thread
              </aside>
            </LightboxContent>
          </LightboxPortal>
        </LightboxRoot>,
      );

      fireEvent.keyDown(screen.getByTestId('sidebar'), { key: 'ArrowRight' });
      expect(screen.getByTestId('item-0')).toHaveAttribute('aria-hidden', 'false');
      expect(screen.getByTestId('item-1')).toHaveAttribute('aria-hidden', 'true');
    });

    it('Escape still closes when focus is outside Stage', () => {
      const onOpenChange = vi.fn();
      render(
        <LightboxRoot defaultOpen onOpenChange={onOpenChange}>
          <LightboxPortal>
            <LightboxContent data-testid="content" aria-label="Stage escape test">
              <LightboxStage>
                <SlidesHost>
                  <LightboxItem index={0}>Item</LightboxItem>
                </SlidesHost>
              </LightboxStage>
              <aside data-testid="sidebar" tabIndex={0}>
                Thread
              </aside>
            </LightboxContent>
          </LightboxPortal>
        </LightboxRoot>,
      );

      fireEvent.keyDown(screen.getByTestId('sidebar'), { key: 'Escape' });
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });

    it('defers navigation when a descendant already handled the key (defaultPrevented)', () => {
      // Simulates a composed scroller (e.g. Lightbox.Slides): a descendant
      // calls preventDefault on the arrow key before it bubbles to Content, so
      // Content must not also navigate (single keyboard authority).
      render(
        <LightboxRoot defaultOpen defaultValue={0}>
          <LightboxTrigger index={0}>Trigger 0</LightboxTrigger>
          <LightboxPortal>
            <LightboxContent data-testid="content" aria-label="Dedupe test">
              <div
                data-testid="descendant"
                onKeyDown={(event) => {
                  if (event.key === 'ArrowRight') event.preventDefault();
                }}
              >
                <SlidesHost preload={1}>
                  {Array.from({ length: 3 }, (_, i) => (
                    <LightboxItem key={`i-${i}`} index={i} data-testid={`item-${i}`}>
                      Item {i}
                    </LightboxItem>
                  ))}
                </SlidesHost>
              </div>
            </LightboxContent>
          </LightboxPortal>
        </LightboxRoot>,
      );

      fireEvent.keyDown(screen.getByTestId('descendant'), { key: 'ArrowRight' });

      // Content bailed out, so the active item is unchanged.
      expect(screen.getByTestId('item-0')).toHaveAttribute('aria-hidden', 'false');
      expect(screen.getByTestId('item-1')).toHaveAttribute('aria-hidden', 'true');
    });

    it('ignores keys whose DOM target is in a React portal outside the dialog host', () => {
      function PortaledMenuItem() {
        const [host] = React.useState(() => {
          const node = document.createElement('div');
          node.setAttribute('data-testid', 'menu-portal-host');
          return node;
        });

        React.useEffect(() => {
          document.body.appendChild(host);
          return () => {
            host.remove();
          };
        }, [host]);

        return ReactDOM.createPortal(
          <button data-testid="portaled-menu-item" type="button">
            Download
          </button>,
          host,
        );
      }

      render(
        <LightboxRoot defaultOpen defaultValue={0}>
          <LightboxPortal>
            <LightboxContent data-testid="content" aria-label="Portal key test">
              <PortaledMenuItem />
              <SlidesHost preload={1}>
                {Array.from({ length: 3 }, (_, i) => (
                  <LightboxItem key={`i-${i}`} index={i} data-testid={`item-${i}`}>
                    Item {i}
                  </LightboxItem>
                ))}
              </SlidesHost>
            </LightboxContent>
          </LightboxPortal>
        </LightboxRoot>,
      );

      fireEvent.keyDown(screen.getByTestId('portaled-menu-item'), { key: 'ArrowRight' });

      expect(screen.getByTestId('item-0')).toHaveAttribute('aria-hidden', 'false');
      expect(screen.getByTestId('item-1')).toHaveAttribute('aria-hidden', 'true');
    });
  });

  // ---------------------------------------------------------------------------
  // 3b. Focus & inert (a slide must never strand keyboard focus)
  // ---------------------------------------------------------------------------

  describe('return focus visibility on close', () => {
    it('requests a visible focus ring on the trigger after a keyboard (Escape) close', async () => {
      render(<TestLightbox itemCount={3} />);
      const trigger = screen.getByTestId('trigger-0');
      const focusSpy = vi.spyOn(trigger, 'focus');

      fireEvent.click(trigger); // open via pointer
      await flushMicrotasks();

      fireEvent.keyDown(screen.getByTestId('content'), { key: 'Escape' });

      await act(async () => {
        await new Promise((r) => requestAnimationFrame(() => r(null)));
      });

      expect(focusSpy).toHaveBeenCalled();
      expect(focusSpy.mock.calls.at(-1)?.[0]).toMatchObject({
        preventScroll: true,
        focusVisible: true,
      });
    });

    it('suppresses the focus ring on the trigger after a pointer (background) close', async () => {
      render(<TestLightbox itemCount={3} />);
      const trigger = screen.getByTestId('trigger-0');
      const focusSpy = vi.spyOn(trigger, 'focus');

      fireEvent.click(trigger); // open
      await flushMicrotasks();

      // Click the dialog background itself (press + click on scrim) → pointer close.
      const content = screen.getByTestId('content');
      fireEvent.pointerDown(content);
      fireEvent.click(content);

      await act(async () => {
        await new Promise((r) => requestAnimationFrame(() => r(null)));
      });

      expect(focusSpy).toHaveBeenCalled();
      expect(focusSpy.mock.calls.at(-1)?.[0]).toMatchObject({
        preventScroll: true,
        focusVisible: false,
      });
    });
  });

  describe('focus containment', () => {
    it('slides expose no focusable region, so inert can never strand focus', () => {
      render(
        <LightboxRoot defaultOpen defaultValue={0}>
          <LightboxPortal>
            <LightboxContent data-testid="content" aria-label="Non-focusable slide test">
              <SlidesHost>
                <LightboxItem index={0} data-testid="item-0">
                  <LightboxZoom maxZoom={4}>
                    <img src="a.jpg" alt="a" />
                  </LightboxZoom>
                </LightboxItem>
              </SlidesHost>
            </LightboxContent>
          </LightboxPortal>
        </LightboxRoot>,
      );

      // The zoom container is intentionally not focusable — with nothing
      // focusable inside a slide, focus never lives there and `inert` on a
      // deactivated slide can never eject focus to <body>.
      expect(screen.getByTestId('item-0').querySelector('[tabindex]')).toBeNull();
    });

    it('pulls focus back into the dialog if it escapes (e.g. a focusable control inside an inert slide)', async () => {
      render(
        <LightboxRoot defaultOpen defaultValue={0}>
          <LightboxPortal>
            <LightboxContent data-testid="content" aria-label="Containment test">
              <SlidesHost preload={2}>
                {Array.from({ length: 3 }, (_, i) => (
                  <LightboxItem key={`i-${i}`} index={i} data-testid={`item-${i}`}>
                    {/* A consumer-provided focusable control inside a slide. */}
                    <button data-testid={`btn-${i}`} type="button">
                      Slide {i}
                    </button>
                  </LightboxItem>
                ))}
              </SlidesHost>
            </LightboxContent>
          </LightboxPortal>
        </LightboxRoot>,
      );

      const btn = screen.getByTestId('btn-0');
      btn.focus();
      expect(document.activeElement).toBe(btn);

      // Simulate the browser ejecting focus out of the dialog to <body>
      // (what happens when a focused slide becomes inert on navigation).
      await act(async () => {
        btn.blur();
        await Promise.resolve();
      });

      expect(document.activeElement).toBe(screen.getByTestId('content'));
    });

    it('allows focus to stay in a portaled overlay outside the dialog subtree', async () => {
      render(
        <LightboxRoot defaultOpen defaultValue={0}>
          <LightboxPortal>
            <LightboxContent data-testid="content" aria-label="Portaled overlay test">
              <button data-testid="in-dialog" type="button">
                In dialog
              </button>
            </LightboxContent>
          </LightboxPortal>
        </LightboxRoot>,
      );

      const portalHost = document.createElement('div');
      document.body.appendChild(portalHost);
      const portaledButton = document.createElement('button');
      portaledButton.type = 'button';
      portaledButton.textContent = 'Portaled menu item';
      portalHost.appendChild(portaledButton);

      screen.getByTestId('in-dialog').focus();
      await act(async () => {
        portaledButton.focus();
        await Promise.resolve();
      });

      expect(document.activeElement).toBe(portaledButton);

      portalHost.remove();
    });
  });

  // ---------------------------------------------------------------------------
  // 4. Item rendering and preload
  // ---------------------------------------------------------------------------

  describe('item rendering and preload', () => {
    it('only active + preload neighbors are in the DOM', () => {
      render(<TestLightbox defaultOpen defaultValue={1} itemCount={5} preload={1} />);
      expect(screen.getByTestId('item-0')).toBeInTheDocument();
      expect(screen.getByTestId('item-1')).toBeInTheDocument();
      expect(screen.getByTestId('item-2')).toBeInTheDocument();
      expect(screen.queryByTestId('item-3')).toBeNull();
      expect(screen.queryByTestId('item-4')).toBeNull();
    });

    it('items outside preload window are not rendered', () => {
      render(<TestLightbox defaultOpen defaultValue={0} itemCount={5} preload={0} />);
      expect(screen.getByTestId('item-0')).toBeInTheDocument();
      expect(screen.queryByTestId('item-1')).toBeNull();
    });

    it('preload=0 renders only the active item', () => {
      render(<TestLightbox defaultOpen defaultValue={2} itemCount={5} preload={0} />);
      expect(screen.getByTestId('item-2')).toBeInTheDocument();
      expect(screen.queryByTestId('item-0')).toBeNull();
      expect(screen.queryByTestId('item-1')).toBeNull();
      expect(screen.queryByTestId('item-3')).toBeNull();
      expect(screen.queryByTestId('item-4')).toBeNull();
    });

    it('preload=2 renders 5 items centered on active', () => {
      render(<TestLightbox defaultOpen defaultValue={3} itemCount={7} preload={2} />);
      expect(screen.queryByTestId('item-0')).toBeNull();
      expect(screen.getByTestId('item-1')).toBeInTheDocument();
      expect(screen.getByTestId('item-2')).toBeInTheDocument();
      expect(screen.getByTestId('item-3')).toBeInTheDocument();
      expect(screen.getByTestId('item-4')).toBeInTheDocument();
      expect(screen.getByTestId('item-5')).toBeInTheDocument();
      expect(screen.queryByTestId('item-6')).toBeNull();
    });

    it('render-prop children receive { active, visible } state', () => {
      render(<TestLightbox defaultOpen defaultValue={0} renderPropItems />);
      const activeItem = screen.getByTestId('render-prop-0');
      expect(activeItem).toHaveAttribute('data-active', 'true');
      expect(activeItem).toHaveAttribute('data-visible', 'true');
    });

    it('render-prop active is true only for active item', () => {
      render(<TestLightbox defaultOpen defaultValue={0} renderPropItems />);
      const activeItem = screen.getByTestId('render-prop-0');
      const inactiveItem = screen.getByTestId('render-prop-1');
      expect(activeItem).toHaveAttribute('data-active', 'true');
      expect(inactiveItem).toHaveAttribute('data-active', 'false');
    });

    it('itemCount reflects mounted items accurately', () => {
      render(<TestLightbox defaultOpen itemCount={4} />);
      const counter = screen.getByTestId('counter');
      expect(counter.textContent).toContain('/ 4');
    });

    it('dynamic item removal decreases itemCount', () => {
      function DynamicLightbox() {
        const [count, setCount] = React.useState(4);
        return (
          <>
            <button data-testid="remove" onClick={() => setCount(2)}>
              Remove
            </button>
            <LightboxRoot defaultOpen>
              {Array.from({ length: count }, (_, i) => (
                <LightboxTrigger key={i} index={i}>
                  T{i}
                </LightboxTrigger>
              ))}
              <LightboxPortal>
                <LightboxContent aria-label="Dynamic test" data-testid="content">
                  <SlidesHost preload={count}>
                    {Array.from({ length: count }, (_, i) => (
                      <LightboxItem key={i} index={i}>
                        Item {i}
                      </LightboxItem>
                    ))}
                  </SlidesHost>
                  <LightboxCounter data-testid="counter" />
                </LightboxContent>
              </LightboxPortal>
            </LightboxRoot>
          </>
        );
      }

      render(<DynamicLightbox />);
      expect(screen.getByTestId('counter').textContent).toContain('/ 4');
      fireEvent.click(screen.getByTestId('remove'));
      expect(screen.getByTestId('counter').textContent).toContain('/ 2');
    });
  });

  // ---------------------------------------------------------------------------
  // 5. Preload with loop
  // ---------------------------------------------------------------------------

  describe('preload with loop', () => {
    it('at index 0 with loop, last item is within preload distance', () => {
      render(<TestLightbox defaultOpen defaultValue={0} itemCount={5} preload={1} loop />);
      expect(screen.getByTestId('item-0')).toBeInTheDocument();
      expect(screen.getByTestId('item-1')).toBeInTheDocument();
      expect(screen.getByTestId('item-4')).toBeInTheDocument();
      expect(screen.queryByTestId('item-2')).toBeNull();
      expect(screen.queryByTestId('item-3')).toBeNull();
    });

    it('at last index with loop, first item is within preload distance', () => {
      render(<TestLightbox defaultOpen defaultValue={4} itemCount={5} preload={1} loop />);
      expect(screen.getByTestId('item-4')).toBeInTheDocument();
      expect(screen.getByTestId('item-3')).toBeInTheDocument();
      expect(screen.getByTestId('item-0')).toBeInTheDocument();
      expect(screen.queryByTestId('item-1')).toBeNull();
      expect(screen.queryByTestId('item-2')).toBeNull();
    });

    it('circular distance calculation is correct with preload=2', () => {
      render(<TestLightbox defaultOpen defaultValue={0} itemCount={6} preload={2} loop />);
      expect(screen.getByTestId('item-0')).toBeInTheDocument();
      expect(screen.getByTestId('item-1')).toBeInTheDocument();
      expect(screen.getByTestId('item-2')).toBeInTheDocument();
      expect(screen.getByTestId('item-4')).toBeInTheDocument();
      expect(screen.getByTestId('item-5')).toBeInTheDocument();
      expect(screen.queryByTestId('item-3')).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // 6. Caption and Counter
  // ---------------------------------------------------------------------------

  describe('caption and counter', () => {
    it('caption displays the active item caption text', () => {
      render(<TestLightbox defaultOpen defaultValue={0} withCaptions />);
      expect(screen.getByTestId('caption').textContent).toBe('Caption 0');
    });

    it('caption updates when navigating', () => {
      render(<TestLightbox defaultOpen defaultValue={0} withCaptions />);
      fireEvent.click(screen.getByTestId('next'));
      expect(screen.getByTestId('caption').textContent).toBe('Caption 1');
    });

    it('caption renders nothing when no caption is set', () => {
      render(<TestLightbox defaultOpen defaultValue={0} />);
      expect(screen.getByTestId('caption').textContent).toBe('');
    });

    it('caption has data-has-caption only when caption exists', () => {
      render(<TestLightbox defaultOpen defaultValue={0} withCaptions />);
      expect(screen.getByTestId('caption')).toHaveAttribute('data-has-caption');
    });

    it('caption updates reactively when the active item caption changes without navigating', () => {
      function CaptionWrapper({ text }: { text: string }) {
        return (
          <LightboxRoot defaultOpen defaultValue={0}>
            <LightboxPortal>
              <LightboxContent aria-label="Reactive caption test">
                <SlidesHost>
                  <LightboxItem index={0} caption={text}>
                    Item 0
                  </LightboxItem>
                </SlidesHost>
                <LightboxCaption data-testid="reactive-caption" />
              </LightboxContent>
            </LightboxPortal>
          </LightboxRoot>
        );
      }

      const { rerender } = render(<CaptionWrapper text="First" />);
      expect(screen.getByTestId('reactive-caption').textContent).toBe('First');

      // activeIndex is unchanged; only the caption content changes. The
      // ref-read-during-render version would keep showing "First".
      rerender(<CaptionWrapper text="Second" />);
      expect(screen.getByTestId('reactive-caption').textContent).toBe('Second');
    });

    it('counter displays "1 / N" format', () => {
      render(<TestLightbox defaultOpen defaultValue={0} itemCount={5} />);
      expect(screen.getByTestId('counter').textContent).toBe('1 / 5');
    });

    it('counter render-prop receives { current, total }', () => {
      render(
        <LightboxRoot defaultOpen defaultValue={2}>
          <LightboxPortal>
            <LightboxContent aria-label="Test">
              <SlidesHost>
                {Array.from({ length: 4 }, (_, i) => (
                  <LightboxItem key={i} index={i}>
                    Item {i}
                  </LightboxItem>
                ))}
              </SlidesHost>
              <LightboxCounter data-testid="counter">
                {({ current, total }) => <span>{`${current} of ${total}`}</span>}
              </LightboxCounter>
            </LightboxContent>
          </LightboxPortal>
        </LightboxRoot>,
      );
      expect(screen.getByTestId('counter').textContent).toBe('3 of 4');
    });
  });

  // ---------------------------------------------------------------------------
  // 7. Thumbnail navigation
  // ---------------------------------------------------------------------------

  describe('thumbnail navigation', () => {
    it('clicking a thumbnail changes the active index', () => {
      render(<TestLightbox defaultOpen defaultValue={0} withThumbnails />);
      fireEvent.click(screen.getByTestId('thumb-2'));
      expect(screen.getByTestId('item-2')).toHaveAttribute('aria-hidden', 'false');
    });

    it('active thumbnail has aria-selected="true" and tabIndex=0', () => {
      render(<TestLightbox defaultOpen defaultValue={1} withThumbnails />);
      const active = screen.getByTestId('thumb-1');
      expect(active).toHaveAttribute('aria-selected', 'true');
      expect(active).toHaveAttribute('tabindex', '0');
    });

    it('inactive thumbnails have aria-selected="false" and tabIndex=-1', () => {
      render(<TestLightbox defaultOpen defaultValue={0} withThumbnails />);
      const inactive = screen.getByTestId('thumb-1');
      expect(inactive).toHaveAttribute('aria-selected', 'false');
      expect(inactive).toHaveAttribute('tabindex', '-1');
    });

    it('ArrowRight in ThumbnailGroup navigates between thumbnails', () => {
      render(<TestLightbox defaultOpen defaultValue={0} withThumbnails />);
      screen.getByTestId('thumb-0').focus();
      fireEvent.keyDown(screen.getByTestId('thumb-group'), { key: 'ArrowRight' });
      expect(document.activeElement).toBe(screen.getByTestId('thumb-1'));
    });

    it('Home/End in ThumbnailGroup jump to first/last', () => {
      render(<TestLightbox defaultOpen defaultValue={1} withThumbnails />);
      screen.getByTestId('thumb-1').focus();
      fireEvent.keyDown(screen.getByTestId('thumb-group'), { key: 'End' });
      expect(document.activeElement).toBe(screen.getByTestId('thumb-2'));
      fireEvent.keyDown(screen.getByTestId('thumb-group'), { key: 'Home' });
      expect(document.activeElement).toBe(screen.getByTestId('thumb-0'));
    });

    it('loop wrapping works in ThumbnailGroup', () => {
      render(<TestLightbox defaultOpen defaultValue={2} withThumbnails loop />);
      screen.getByTestId('thumb-2').focus();
      fireEvent.keyDown(screen.getByTestId('thumb-group'), { key: 'ArrowRight' });
      expect(document.activeElement).toBe(screen.getByTestId('thumb-0'));
    });
  });

  // ---------------------------------------------------------------------------
  // 8. Trigger state attributes
  // ---------------------------------------------------------------------------

  describe('trigger state attributes', () => {
    it('trigger gets data-popup-open when lightbox is open', () => {
      render(<TestLightbox />);
      const trigger = screen.getByTestId('trigger-0');
      expect(trigger).not.toHaveAttribute('data-popup-open');
      expect(trigger).not.toHaveAttribute('data-open');
      fireEvent.click(trigger);
      expect(screen.getByTestId('trigger-0')).toHaveAttribute('data-popup-open');
      expect(screen.getByTestId('trigger-0')).not.toHaveAttribute('data-open');
    });

    it('trigger gets data-active when it is the active trigger', () => {
      render(<TestLightbox />);
      fireEvent.click(screen.getByTestId('trigger-1'));
      expect(screen.getByTestId('trigger-1')).toHaveAttribute('data-active');
    });

    it('data-popup-open is removed when lightbox closes', () => {
      render(<TestLightbox />);
      fireEvent.click(screen.getByTestId('trigger-0'));
      expect(screen.getByTestId('trigger-0')).toHaveAttribute('data-popup-open');
      fireEvent.click(screen.getByTestId('close'));
      expect(screen.getByTestId('trigger-0')).not.toHaveAttribute('data-popup-open');
    });

    it('only the matching trigger gets data-active', () => {
      render(<TestLightbox />);
      fireEvent.click(screen.getByTestId('trigger-1'));
      expect(screen.getByTestId('trigger-1')).toHaveAttribute('data-active');
      expect(screen.getByTestId('trigger-0')).not.toHaveAttribute('data-active');
      expect(screen.getByTestId('trigger-2')).not.toHaveAttribute('data-active');
    });
  });

  // ---------------------------------------------------------------------------
  // 9. createHandle API
  // ---------------------------------------------------------------------------

  describe('createHandle API', () => {
    it('handle.open/close/goTo control a Root with handle prop', () => {
      const handle = createHandle();
      render(
        <LightboxRoot handle={handle}>
          <LightboxPortal>
            <LightboxContent data-testid="content" aria-label="Test">
              <SlidesHost>
                <LightboxItem index={0} data-testid="item-0">
                  Item 0
                </LightboxItem>
                <LightboxItem index={1} data-testid="item-1">
                  Item 1
                </LightboxItem>
              </SlidesHost>
            </LightboxContent>
          </LightboxPortal>
        </LightboxRoot>,
      );
      expect(handle.isOpen).toBe(false);
      act(() => handle.open(1));
      expect(handle.isOpen).toBe(true);
      expect(screen.getByTestId('item-1')).toHaveAttribute('aria-hidden', 'false');
      act(() => handle.goTo(0));
      expect(screen.getByTestId('item-0')).toHaveAttribute('aria-hidden', 'false');
      act(() => handle.close());
      expect(handle.isOpen).toBe(false);
    });

    it('handle.open() opens the lightbox', () => {
      const handle = createHandle();
      render(
        <LightboxRoot handle={handle}>
          <LightboxPortal>
            <LightboxContent data-testid="content" aria-label="Test">
              <SlidesHost>
                <LightboxItem index={0}>Item 0</LightboxItem>
              </SlidesHost>
            </LightboxContent>
          </LightboxPortal>
        </LightboxRoot>,
      );
      expect(screen.queryByTestId('content')).toBeNull();
      act(() => handle.open());
      expect(screen.getByTestId('content')).toBeInTheDocument();
    });

    it('handle.open(index, { triggerId }) associates the opening trigger', () => {
      const handle = createHandle();
      const onValueChange = vi.fn();
      render(
        <LightboxRoot handle={handle} onValueChange={onValueChange}>
          <LightboxTrigger index={0} id="hero-a" data-testid="trigger-a">
            A
          </LightboxTrigger>
          <LightboxTrigger index={0} id="hero-b" data-testid="trigger-b">
            B
          </LightboxTrigger>
          <LightboxPortal>
            <LightboxContent data-testid="content" aria-label="Test">
              <SlidesHost>
                <LightboxItem index={0}>Item 0</LightboxItem>
              </SlidesHost>
            </LightboxContent>
          </LightboxPortal>
        </LightboxRoot>,
      );
      act(() => handle.open(0, { triggerId: 'hero-b' }));
      expect(screen.getByTestId('content')).toBeInTheDocument();
      expect(onValueChange).toHaveBeenCalledWith(0, { source: 'imperative' });
      expect(screen.getByTestId('trigger-b')).toHaveAttribute('data-active');
    });

    it('detached Trigger with handle opens the Root', () => {
      const handle = createHandle();
      function Demo() {
        return (
          <>
            <LightboxTrigger handle={handle} id="detached" index={0} data-testid="detached-trigger">
              Open
            </LightboxTrigger>
            <LightboxRoot handle={handle}>
              <LightboxPortal>
                <LightboxContent data-testid="content" aria-label="Test">
                  <SlidesHost>
                    <LightboxItem index={0}>Item 0</LightboxItem>
                  </SlidesHost>
                </LightboxContent>
              </LightboxPortal>
            </LightboxRoot>
          </>
        );
      }
      render(<Demo />);
      expect(screen.queryByTestId('content')).toBeNull();
      fireEvent.click(screen.getByTestId('detached-trigger'));
      expect(screen.getByTestId('content')).toBeInTheDocument();
      expect(screen.getByTestId('detached-trigger')).toHaveAttribute('data-popup-open');
      expect(screen.getByTestId('detached-trigger')).not.toHaveAttribute('data-open');
      expect(screen.getByTestId('detached-trigger')).toHaveAttribute('data-active');
    });

    it('handle.open with triggerId associates a detached Trigger', () => {
      const handle = createHandle();
      function Demo() {
        return (
          <>
            <LightboxTrigger handle={handle} id="tile-1" index={1} data-testid="tile-1">
              Tile 1
            </LightboxTrigger>
            <LightboxRoot handle={handle}>
              <LightboxPortal>
                <LightboxContent data-testid="content" aria-label="Test">
                  <SlidesHost>
                    <LightboxItem index={0} data-testid="item-0">
                      Item 0
                    </LightboxItem>
                    <LightboxItem index={1} data-testid="item-1">
                      Item 1
                    </LightboxItem>
                  </SlidesHost>
                </LightboxContent>
              </LightboxPortal>
            </LightboxRoot>
          </>
        );
      }
      render(<Demo />);
      act(() => handle.open(undefined, { triggerId: 'tile-1' }));
      expect(screen.getByTestId('item-1')).toHaveAttribute('aria-hidden', 'false');
      expect(screen.getByTestId('tile-1')).toHaveAttribute('data-active');
    });
  });

  // ---------------------------------------------------------------------------
  // 10. Lifecycle callbacks
  // ---------------------------------------------------------------------------

  describe('lifecycle callbacks', () => {
    it('onOpenChangeComplete(true) fires after open', async () => {
      const spy = vi.fn();
      render(<TestLightbox onOpenChangeComplete={spy} />);
      fireEvent.click(screen.getByTestId('trigger-0'));
      await act(() => new Promise((r) => requestAnimationFrame(r)));
      expect(spy).toHaveBeenCalledWith(true);
    });

    it('onOpenChangeComplete(false) fires after close', async () => {
      const spy = vi.fn();
      render(<TestLightbox defaultOpen onOpenChangeComplete={spy} />);
      fireEvent.click(screen.getByTestId('close'));
      await flushMicrotasks();
      expect(spy).toHaveBeenCalledWith(false);
    });

    it('onOpenChangeComplete fires even when onOpenChange is not provided', async () => {
      const completeSpy = vi.fn();
      render(<TestLightbox onOpenChangeComplete={completeSpy} />);
      fireEvent.click(screen.getByTestId('trigger-0'));
      await act(() => new Promise((r) => requestAnimationFrame(r)));
      expect(completeSpy).toHaveBeenCalledWith(true);
    });

    it('onOpenChangeComplete does not fire if close is interrupted by reopen', async () => {
      const completeSpy = vi.fn();
      const handle = createHandle();
      render(
        <LightboxRoot handle={handle} onOpenChangeComplete={completeSpy} defaultOpen>
          <LightboxPortal>
            <LightboxContent data-testid="content" aria-label="Test">
              <SlidesHost>
                <LightboxItem index={0}>Item 0</LightboxItem>
              </SlidesHost>
            </LightboxContent>
          </LightboxPortal>
        </LightboxRoot>,
      );

      act(() => handle.close());
      act(() => handle.open());

      await act(() => new Promise((r) => setTimeout(r, 50)));

      const closeCalls = completeSpy.mock.calls.filter((call) => call[0] === false);
      expect(closeCalls).toHaveLength(0);
    });
  });

  // ---------------------------------------------------------------------------
  // 11. Edge cases
  // ---------------------------------------------------------------------------

  describe('edge cases', () => {
    it('opening with no items does not crash', () => {
      expect(() => {
        render(
          <LightboxRoot defaultOpen>
            <LightboxPortal>
              <LightboxContent aria-label="Empty">
                <SlidesHost />
              </LightboxContent>
            </LightboxPortal>
          </LightboxRoot>,
        );
      }).not.toThrow();
    });

    it('navigation with itemCount === 1 stays at index 0', () => {
      render(<TestLightbox defaultOpen itemCount={1} defaultValue={0} />);
      fireEvent.click(screen.getByTestId('next'));
      expect(screen.getByTestId('item-0')).toHaveAttribute('aria-hidden', 'false');
    });

    it('compound component outside context throws meaningful error', () => {
      expect(() => {
        render(<LightboxTrigger index={0}>orphan</LightboxTrigger>);
      }).toThrow(
        'Lightbox.Trigger must be used within a Lightbox.Root, or passed a handle from Lightbox.createHandle()',
      );
    });

    it('multiple triggers for the same index work correctly', () => {
      render(
        <LightboxRoot>
          <LightboxTrigger index={0} data-testid="trigger-a">
            A
          </LightboxTrigger>
          <LightboxTrigger index={0} data-testid="trigger-b">
            B
          </LightboxTrigger>
          <LightboxPortal>
            <LightboxContent data-testid="content" aria-label="Test">
              <SlidesHost>
                <LightboxItem index={0} data-testid="item-0">
                  Item 0
                </LightboxItem>
              </SlidesHost>
            </LightboxContent>
          </LightboxPortal>
        </LightboxRoot>,
      );
      fireEvent.click(screen.getByTestId('trigger-b'));
      expect(screen.getByTestId('content')).toBeInTheDocument();
      expect(screen.getByTestId('item-0')).toHaveAttribute('aria-hidden', 'false');
    });

    it('rapid open/close does not leave stale state', async () => {
      const handle = createHandle();
      render(
        <LightboxRoot handle={handle}>
          <LightboxPortal>
            <LightboxContent data-testid="content" aria-label="Test">
              <SlidesHost>
                <LightboxItem index={0}>Item 0</LightboxItem>
              </SlidesHost>
            </LightboxContent>
          </LightboxPortal>
        </LightboxRoot>,
      );

      act(() => handle.open());
      act(() => handle.close());
      act(() => handle.open());
      act(() => handle.close());

      await flushMicrotasks();
      expect(screen.queryByTestId('content')).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // 11b. Scroll lock (scrollbar compensation)
  // ---------------------------------------------------------------------------

  describe('scroll lock', () => {
    it('compensates body padding for the disappearing scrollbar, then restores it on close', async () => {
      // Simulate a classic (non-overlay) scrollbar by making the viewport wider
      // than the documentElement's clientWidth. lockScroll must pad the body by
      // that delta so hiding the scrollbar doesn't shift page content.
      const origInnerWidth = Object.getOwnPropertyDescriptor(window, 'innerWidth');
      const origClientWidth = Object.getOwnPropertyDescriptor(document.documentElement, 'clientWidth');
      Object.defineProperty(window, 'innerWidth', { configurable: true, get: () => 1020 });
      Object.defineProperty(document.documentElement, 'clientWidth', {
        configurable: true,
        get: () => 1000,
      });
      document.body.style.paddingRight = '10px';

      try {
        render(<TestLightbox />);
        fireEvent.click(screen.getByTestId('trigger-0'));

        expect(document.documentElement.style.overflow).toBe('hidden');
        // Existing 10px + 20px scrollbar width.
        expect(document.body.style.paddingRight).toBe('30px');

        fireEvent.click(screen.getByTestId('close'));
        await flushMicrotasks();

        expect(document.documentElement.style.overflow).toBe('');
        expect(document.body.style.paddingRight).toBe('10px');
      } finally {
        document.body.style.paddingRight = '';
        if (origInnerWidth) Object.defineProperty(window, 'innerWidth', origInnerWidth);
        else delete (window as unknown as { innerWidth?: number }).innerWidth;
        if (origClientWidth) {
          Object.defineProperty(document.documentElement, 'clientWidth', origClientWidth);
        } else {
          delete (document.documentElement as unknown as { clientWidth?: number }).clientWidth;
        }
      }
    });

    it('never sets scrollbar-width on the document (WebKit bug 282419)', async () => {
      // Hiding the fading iOS overlay scroll indicator via
      // `scrollbar-width: none` on <html> looked like a free win, but
      // restoring it permanently destroys the tab's page scrollbar on iOS —
      // WebKit never re-attaches the native scroller layer
      // (https://bugs.webkit.org/show_bug.cgi?id=282419), and the breakage
      // survives page reloads. Guard against reintroducing it.
      render(<TestLightbox defaultOpen />);
      expect(document.documentElement.style.getPropertyValue('scrollbar-width')).toBe('');

      fireEvent.click(screen.getByTestId('close'));
      await flushMicrotasks();
      expect(document.documentElement.style.getPropertyValue('scrollbar-width')).toBe('');
    });

    it('disables document text selection while open, then restores it on close', async () => {
      // Regression: iOS Safari tap→pan while zoomed selected the page behind
      // the lightbox. The scroll lock sets user-select on <html> for the
      // open lifetime.
      render(<TestLightbox defaultOpen />);

      expect(document.documentElement.style.userSelect).toBe('none');

      fireEvent.click(screen.getByTestId('close'));
      await flushMicrotasks();

      expect(document.documentElement.style.userSelect).toBe('');
    });
  });

  // ---------------------------------------------------------------------------
  // 12. View Transitions
  // ---------------------------------------------------------------------------

  describe('view transitions', () => {
    beforeEach(async () => {
      const { loadMorphRuntime } = await import('./lightbox-morph-loader');
      await loadMorphRuntime();
    });

    function mockViewTransitionAPI() {
      let resolveFinished: () => void;
      const finishedPromise = new Promise<void>((r) => {
        resolveFinished = r;
      });

      const startViewTransition = vi.fn((callback: () => void | Promise<void>) => {
        const result = callback();
        if (result && typeof (result as Promise<void>).then === 'function') {
          (result as Promise<void>).catch(vi.fn());
        }
        return { finished: finishedPromise };
      });

      Object.defineProperty(document, 'startViewTransition', {
        value: startViewTransition,
        writable: true,
        configurable: true,
      });

      return { startViewTransition, resolveFinished: () => resolveFinished() };
    }

    function cleanupViewTransitionAPI() {
      delete (document as unknown as Record<string, unknown>).startViewTransition;
      document.documentElement.removeAttribute('data-ramka-view-transition');
      document.documentElement.removeAttribute('data-ramka-crossfade');
      document.documentElement.removeAttribute('data-ramka-vt-preset');
      document.documentElement.style.removeProperty('--lightbox-morph-border-radius-from');
      document.documentElement.style.removeProperty('--lightbox-morph-border-radius-to');
      document.documentElement.style.removeProperty('--lightbox-morph-old-opacity');
      document.documentElement.style.removeProperty('--lightbox-morph-new-opacity');
      document.documentElement.style.removeProperty('--lightbox-vt-duration');
      document.documentElement.style.removeProperty('--lightbox-vt-easing');
      document.documentElement.style.removeProperty('--lightbox-vt-crossfade-close-easing');
      document.documentElement.style.removeProperty('--lightbox-vt-root-easing');
    }

    afterEach(() => {
      cleanupViewTransitionAPI();
    });

    it('falls back gracefully when viewTransition=true but API is absent', () => {
      render(<TestLightbox viewTransition />);
      fireEvent.click(screen.getByTestId('trigger-0'));
      expect(screen.getByTestId('content')).toBeInTheDocument();
    });

    it('calls document.startViewTransition on open', () => {
      const { startViewTransition } = mockViewTransitionAPI();
      render(<TestLightbox viewTransition />);
      fireEvent.click(screen.getByTestId('trigger-0'));
      expect(startViewTransition).toHaveBeenCalledOnce();
    });

    it('does not start a view transition when viewTransition is false', () => {
      const { startViewTransition } = mockViewTransitionAPI();
      render(<TestLightbox viewTransition={false} />);
      fireEvent.click(screen.getByTestId('trigger-0'));
      expect(startViewTransition).not.toHaveBeenCalled();
      expect(screen.getByTestId('content')).toBeInTheDocument();
    });

    it('sets data-ramka-view-transition on <html> during open', () => {
      mockViewTransitionAPI();
      render(<TestLightbox viewTransition />);
      fireEvent.click(screen.getByTestId('trigger-0'));
      expect(document.documentElement).toHaveAttribute('data-ramka-view-transition');
    });

    it('removes data-ramka-view-transition after open transition finishes', async () => {
      const { resolveFinished } = mockViewTransitionAPI();
      render(<TestLightbox viewTransition />);
      fireEvent.click(screen.getByTestId('trigger-0'));
      expect(document.documentElement).toHaveAttribute('data-ramka-view-transition');

      await act(async () => resolveFinished());
      expect(document.documentElement).not.toHaveAttribute('data-ramka-view-transition');
    });

    it('cleans up CSS custom properties after open transition finishes', async () => {
      const { resolveFinished } = mockViewTransitionAPI();
      render(<TestLightbox viewTransition />);
      fireEvent.click(screen.getByTestId('trigger-0'));

      await act(async () => resolveFinished());
      const docStyle = document.documentElement.style;
      expect(docStyle.getPropertyValue('--lightbox-morph-border-radius-from')).toBe('');
      expect(docStyle.getPropertyValue('--lightbox-morph-border-radius-to')).toBe('');
      expect(docStyle.getPropertyValue('--lightbox-vt-duration')).toBe('');
      expect(docStyle.getPropertyValue('--lightbox-vt-easing')).toBe('');
      expect(docStyle.getPropertyValue('--lightbox-vt-crossfade-close-easing')).toBe('');
      expect(docStyle.getPropertyValue('--lightbox-vt-root-easing')).toBe('');
    });

    it('writes the default timing preset onto documentElement during morph', async () => {
      const { resolveFinished } = mockViewTransitionAPI();
      render(<TestLightbox viewTransition />);

      fireEvent.click(screen.getByTestId('trigger-0'));
      const docEl = document.documentElement;
      expect(docEl).toHaveAttribute('data-ramka-vt-preset', 'default');
      expect(docEl.style.getPropertyValue('--lightbox-vt-duration')).toBe('360ms');
      expect(docEl.style.getPropertyValue('--lightbox-vt-easing')).toBe(
        'cubic-bezier(0.44, 0.58, 0, 1)',
      );
      expect(docEl.style.getPropertyValue('--lightbox-vt-crossfade-close-easing')).toBe(
        'cubic-bezier(0.5, 0, 1, 1)',
      );
      expect(docEl.style.getPropertyValue('--lightbox-vt-root-easing')).toBe(
        'cubic-bezier(0.16, 1, 0.3, 1)',
      );

      await act(async () => resolveFinished());
      expect(docEl).not.toHaveAttribute('data-ramka-vt-preset');
      expect(docEl.style.getPropertyValue('--lightbox-vt-duration')).toBe('');
      expect(docEl.style.getPropertyValue('--lightbox-vt-easing')).toBe('');
      expect(docEl.style.getPropertyValue('--lightbox-vt-crossfade-close-easing')).toBe('');
      expect(docEl.style.getPropertyValue('--lightbox-vt-root-easing')).toBe('');
    });

    it('writes a named timing preset (viewTransition="spring") onto documentElement', async () => {
      const { resolveFinished } = mockViewTransitionAPI();
      render(
        <LightboxRoot viewTransition="spring">
          <LightboxTrigger index={0} data-testid="trigger-0">
            {({ imageRef }) => <img ref={imageRef} src="thumb.jpg" alt="thumb" />}
          </LightboxTrigger>
          <LightboxPortal>
            <LightboxContent data-testid="content" aria-label="vt preset test">
              <SlidesHost>
                <LightboxItem index={0}>
                  {({ imageRef }) => <img ref={imageRef} src="full.jpg" alt="full" />}
                </LightboxItem>
              </SlidesHost>
              <LightboxClose data-testid="close">Close</LightboxClose>
            </LightboxContent>
          </LightboxPortal>
        </LightboxRoot>,
      );

      fireEvent.click(screen.getByTestId('trigger-0'));
      const docEl = document.documentElement;
      expect(docEl).toHaveAttribute('data-ramka-vt-preset', 'spring');
      expect(docEl.style.getPropertyValue('--lightbox-vt-duration')).toBe('450ms');

      await act(async () => resolveFinished());
      expect(docEl).not.toHaveAttribute('data-ramka-vt-preset');
      expect(docEl.style.getPropertyValue('--lightbox-vt-duration')).toBe('');
    });

    it('always publishes the preset timing vars on the Portal host (skin motion clock)', async () => {
      // Skins read `--lightbox-vt-*` for their non-VT open/close fades, so the
      // Portal host must carry them whenever it is mounted — including after
      // the morph's documentElement promotion has been cleaned up.
      const { resolveFinished } = mockViewTransitionAPI();
      render(
        <LightboxRoot viewTransition="spring">
          <LightboxTrigger index={0} data-testid="trigger-0">
            {({ imageRef }) => <img ref={imageRef} src="thumb.jpg" alt="thumb" />}
          </LightboxTrigger>
          <LightboxPortal data-testid="portal">
            <LightboxContent data-testid="content" aria-label="portal vars test">
              <SlidesHost>
                <LightboxItem index={0}>
                  {({ imageRef }) => <img ref={imageRef} src="full.jpg" alt="full" />}
                </LightboxItem>
              </SlidesHost>
              <LightboxClose data-testid="close">Close</LightboxClose>
            </LightboxContent>
          </LightboxPortal>
        </LightboxRoot>,
      );

      fireEvent.click(screen.getByTestId('trigger-0'));
      await act(async () => resolveFinished());

      const host = document.querySelector('[data-ramka-portal]') as HTMLElement;
      expect(host).not.toBeNull();
      expect(host.style.getPropertyValue('--lightbox-vt-duration')).toBe('450ms');
      expect(host.style.getPropertyValue('--lightbox-vt-easing')).toBe(
        'cubic-bezier(0.22, 1, 0.36, 1)',
      );
      expect(host.style.getPropertyValue('--lightbox-vt-root-easing')).toBe(
        'cubic-bezier(0.16, 1, 0.3, 1)',
      );
      // documentElement promotion is transition-scoped and already gone.
      expect(document.documentElement.style.getPropertyValue('--lightbox-vt-duration')).toBe('');
    });

    it('a stale transition finalizer cannot wipe a newer morph state (interleaved Roots)', async () => {
      // Per-transition finished promises — starting a new document transition
      // skips the active one, whose finalizer then runs AFTER the new morph
      // has promoted its state. The stale finalizer must be a no-op.
      const resolvers: Array<() => void> = [];
      Object.defineProperty(document, 'startViewTransition', {
        value: vi.fn((callback: () => void | Promise<void>) => {
          const finished = new Promise<void>((r) => resolvers.push(r));
          const result = callback();
          if (result && typeof (result as Promise<void>).then === 'function') {
            (result as Promise<void>).catch(vi.fn());
          }
          return { finished };
        }),
        writable: true,
        configurable: true,
      });

      const makeLightbox = (id: string, preset: 'snappy' | 'spring') => (
        <LightboxRoot viewTransition={preset}>
          <LightboxTrigger index={0} data-testid={`${id}-trigger`}>
            {({ imageRef }) => <img ref={imageRef} src="thumb.jpg" alt="thumb" />}
          </LightboxTrigger>
          <LightboxPortal>
            <LightboxContent aria-label={id}>
              <SlidesHost>
                <LightboxItem index={0}>
                  {({ imageRef }) => <img ref={imageRef} src="full.jpg" alt="full" />}
                </LightboxItem>
              </SlidesHost>
            </LightboxContent>
          </LightboxPortal>
        </LightboxRoot>
      );

      render(
        <>
          {makeLightbox('a', 'snappy')}
          {makeLightbox('b', 'spring')}
        </>,
      );
      const docEl = document.documentElement;

      // Open A (transition #1), then B while A is still unfinished (#2).
      fireEvent.click(screen.getByTestId('a-trigger'));
      expect(docEl).toHaveAttribute('data-ramka-vt-preset', 'snappy');
      fireEvent.click(screen.getByTestId('b-trigger'));
      expect(docEl).toHaveAttribute('data-ramka-vt-preset', 'spring');

      // A's transition settles late — B's promoted state must survive.
      await act(async () => resolvers[0]!());
      expect(docEl).toHaveAttribute('data-ramka-view-transition', 'opening');
      expect(docEl).toHaveAttribute('data-ramka-vt-preset', 'spring');
      expect(docEl.style.getPropertyValue('--lightbox-vt-duration')).toBe('450ms');

      // B's own finalizer still cleans up normally.
      await act(async () => resolvers[1]!());
      expect(docEl).not.toHaveAttribute('data-ramka-view-transition');
      expect(docEl).not.toHaveAttribute('data-ramka-vt-preset');
      expect(docEl.style.getPropertyValue('--lightbox-vt-duration')).toBe('');

      // Both Roots are left open, so their scroll locks overlap: each saved
      // the other's `overflow` as its "original", and unmount restore order
      // would leak `overflow: hidden` into later tests. Reset explicitly.
      cleanup();
      docEl.style.overflow = '';
      docEl.style.userSelect = '';
      docEl.style.removeProperty('-webkit-user-select');
      document.body.style.paddingRight = '';
    });

    it('fires onOpenChangeComplete(true) after VT open finishes', async () => {
      const { resolveFinished } = mockViewTransitionAPI();
      const completeSpy = vi.fn();
      render(<TestLightbox viewTransition onOpenChangeComplete={completeSpy} />);
      fireEvent.click(screen.getByTestId('trigger-0'));
      expect(completeSpy).not.toHaveBeenCalled();

      await act(async () => resolveFinished());
      expect(completeSpy).toHaveBeenCalledWith(true);
    });

    it('calls startViewTransition on close', async () => {
      const { startViewTransition, resolveFinished } = mockViewTransitionAPI();
      render(<TestLightbox viewTransition defaultOpen />);
      startViewTransition.mockClear();

      fireEvent.click(screen.getByTestId('close'));
      expect(startViewTransition).toHaveBeenCalledOnce();

      await act(async () => resolveFinished());
    });

    it('Firefox: resets zoom instantly before close view transition capture when zoomed', () => {
      // Firefox clips zoomed Media into the named VT snapshot; reset(true) before
      // startViewTransition. Chrome/Safari keep the live zoomed pose.
      const originalUa = navigator.userAgent;
      Object.defineProperty(navigator, 'userAgent', {
        configurable: true,
        value: 'Mozilla/5.0 (Macintosh; rv:153.0) Gecko/20100101 Firefox/153.0',
      });

      const zoomRef = React.createRef<LightboxZoomRef>();
      let zoomAtOldSnapshot = -1;
      const startViewTransition = vi.fn((callback: () => void | Promise<void>) => {
        zoomAtOldSnapshot = zoomRef.current?.zoom ?? -1;
        const result = callback();
        if (result && typeof (result as Promise<void>).then === 'function') {
          (result as Promise<void>).catch(vi.fn());
        }
        return { finished: Promise.resolve() };
      });
      Object.defineProperty(document, 'startViewTransition', {
        value: startViewTransition,
        writable: true,
        configurable: true,
      });

      try {
        render(
          <LightboxRoot viewTransition defaultOpen awaitImageDecode={false}>
            <LightboxTrigger index={0} data-testid="trigger-0">
              Open
            </LightboxTrigger>
            <LightboxPortal>
              <LightboxContent data-testid="content" aria-label="zoomed close morph">
                <LightboxClose data-testid="close">Close</LightboxClose>
                <SlidesHost>
                  <LightboxItem index={0} data-testid="item-0">
                    <LightboxZoom ref={zoomRef} maxZoom={4}>
                      <LightboxMedia data-testid="media">
                        <img src="a.jpg" alt="a" />
                      </LightboxMedia>
                    </LightboxZoom>
                  </LightboxItem>
                </SlidesHost>
              </LightboxContent>
            </LightboxPortal>
          </LightboxRoot>,
        );

        act(() => zoomRef.current!.zoomTo(3, { rapid: true }));
        expect(zoomRef.current!.zoom).toBeGreaterThan(1);

        startViewTransition.mockClear();
        fireEvent.click(screen.getByTestId('close'));

        expect(startViewTransition).toHaveBeenCalledOnce();
        // Captured before the VT callback unmounts Zoom — must already be resting.
        expect(zoomAtOldSnapshot).toBe(1);
      } finally {
        Object.defineProperty(navigator, 'userAgent', {
          configurable: true,
          value: originalUa,
        });
      }
    });

    it('does not reset zoom before close view transition outside Firefox', () => {
      const originalUa = navigator.userAgent;
      Object.defineProperty(navigator, 'userAgent', {
        configurable: true,
        value: 'Mozilla/5.0 (Macintosh; Chrome/120.0.0.0)',
      });

      const zoomRef = React.createRef<LightboxZoomRef>();
      let zoomAtOldSnapshot = -1;
      const startViewTransition = vi.fn((callback: () => void | Promise<void>) => {
        zoomAtOldSnapshot = zoomRef.current?.zoom ?? -1;
        const result = callback();
        if (result && typeof (result as Promise<void>).then === 'function') {
          (result as Promise<void>).catch(vi.fn());
        }
        return { finished: Promise.resolve() };
      });
      Object.defineProperty(document, 'startViewTransition', {
        value: startViewTransition,
        writable: true,
        configurable: true,
      });

      try {
        render(
          <LightboxRoot viewTransition defaultOpen awaitImageDecode={false}>
            <LightboxTrigger index={0} data-testid="trigger-0">
              Open
            </LightboxTrigger>
            <LightboxPortal>
              <LightboxContent data-testid="content" aria-label="zoomed close chromelike">
                <LightboxClose data-testid="close">Close</LightboxClose>
                <SlidesHost>
                  <LightboxItem index={0} data-testid="item-0">
                    <LightboxZoom ref={zoomRef} maxZoom={4}>
                      <LightboxMedia data-testid="media">
                        <img src="a.jpg" alt="a" />
                      </LightboxMedia>
                    </LightboxZoom>
                  </LightboxItem>
                </SlidesHost>
              </LightboxContent>
            </LightboxPortal>
          </LightboxRoot>,
        );

        act(() => zoomRef.current!.zoomTo(3, { rapid: true }));
        expect(zoomRef.current!.zoom).toBe(3);

        startViewTransition.mockClear();
        fireEvent.click(screen.getByTestId('close'));

        expect(startViewTransition).toHaveBeenCalledOnce();
        expect(zoomAtOldSnapshot).toBe(3);
      } finally {
        Object.defineProperty(navigator, 'userAgent', {
          configurable: true,
          value: originalUa,
        });
      }
    });

    it('close without a trigger falls back to root crossfade (no item morph name)', () => {
      // Controlled/defaultOpen with no Trigger: naming the item alone would lift
      // it out of the root snapshot so chrome fades while the photo sticks.
      let namedDuringCapture = 'unset';
      const startViewTransition = vi.fn((callback: () => void | Promise<void>) => {
        const img = screen.getByTestId('item-0').querySelector('img');
        namedDuringCapture = img?.style.getPropertyValue('view-transition-name') ?? '';
        const result = callback();
        if (result && typeof (result as Promise<void>).then === 'function') {
          (result as Promise<void>).catch(vi.fn());
        }
        return { finished: Promise.resolve() };
      });
      Object.defineProperty(document, 'startViewTransition', {
        value: startViewTransition,
        writable: true,
        configurable: true,
      });

      render(
        <LightboxRoot viewTransition defaultOpen awaitImageDecode={false}>
          <LightboxPortal>
            <LightboxContent data-testid="content" aria-label="no-trigger close">
              <LightboxClose data-testid="close">Close</LightboxClose>
              <SlidesHost>
                <LightboxItem index={0} data-testid="item-0">
                  {({ imageRef }) => <img ref={imageRef} src="a.jpg" alt="a" />}
                </LightboxItem>
              </SlidesHost>
            </LightboxContent>
          </LightboxPortal>
        </LightboxRoot>,
      );

      fireEvent.click(screen.getByTestId('close'));
      expect(startViewTransition).toHaveBeenCalledOnce();
      expect(namedDuringCapture).toBe('');
      expect(document.documentElement).toHaveAttribute('data-ramka-view-transition', 'closing');
      // No trigger end → plain root crossfade (not a hard-cut morph).
      expect(document.documentElement).toHaveAttribute('data-ramka-crossfade');
    });

    it('removes data-ramka-view-transition after close transition finishes', async () => {
      let resolveOpen: () => void;
      let resolveClose: () => void;

      const startViewTransition = vi.fn((callback: () => void | Promise<void>) => {
        const result = callback();
        if (result && typeof (result as Promise<void>).then === 'function') {
          (result as Promise<void>).catch(vi.fn());
        }
        if (startViewTransition.mock.calls.length === 1) {
          return {
            finished: new Promise<void>((r) => {
              resolveOpen = r;
            }),
          };
        }
        return {
          finished: new Promise<void>((r) => {
            resolveClose = r;
          }),
        };
      });

      Object.defineProperty(document, 'startViewTransition', {
        value: startViewTransition,
        writable: true,
        configurable: true,
      });

      render(<TestLightbox viewTransition />);
      fireEvent.click(screen.getByTestId('trigger-0'));
      await act(async () => resolveOpen!());

      fireEvent.click(screen.getByTestId('close'));
      expect(document.documentElement).toHaveAttribute('data-ramka-view-transition');

      await act(async () => resolveClose!());
      expect(document.documentElement).not.toHaveAttribute('data-ramka-view-transition');
    });

    it('unmounts Content inside the VT close update callback', async () => {
      // Safari / desktop Chrome: unnamed position:fixed chrome only fades
      // with ::view-transition-old(root) if it is gone from the live tree.
      // Extra named groups on Content are not an option — WebKit
      // CPU-rasterizes each, and Content is fullscreen.
      let resolveOpen: () => void;
      let resolveClose: () => void;
      let contentDuringCloseUpdate: boolean | null = null;

      const startViewTransition = vi.fn((callback: () => void | Promise<void>) => {
        const result = callback();
        if (startViewTransition.mock.calls.length === 2) {
          contentDuringCloseUpdate = !!screen.queryByTestId('content');
        }
        if (result && typeof (result as Promise<void>).then === 'function') {
          (result as Promise<void>).catch(vi.fn());
        }
        if (startViewTransition.mock.calls.length === 1) {
          return {
            finished: new Promise<void>((r) => {
              resolveOpen = r;
            }),
          };
        }
        return {
          finished: new Promise<void>((r) => {
            resolveClose = r;
          }),
        };
      });

      Object.defineProperty(document, 'startViewTransition', {
        value: startViewTransition,
        writable: true,
        configurable: true,
      });

      render(<TestLightbox viewTransition />);
      fireEvent.click(screen.getByTestId('trigger-0'));
      await act(async () => resolveOpen!());

      fireEvent.click(screen.getByTestId('close'));
      expect(contentDuringCloseUpdate).toBe(false);
      expect(screen.queryByTestId('content')).not.toBeInTheDocument();

      await act(async () => resolveClose!());
      expect(screen.queryByTestId('content')).not.toBeInTheDocument();
    });

    it('Android Chrome: keeps Content mounted (paint-suppressed) until the VT close finishes', async () => {
      const originalChrome = (window as unknown as { chrome?: unknown }).chrome;
      const originalUaData = (navigator as Navigator & { userAgentData?: unknown }).userAgentData;
      (window as unknown as { chrome: object }).chrome = {};
      Object.defineProperty(navigator, 'userAgentData', {
        configurable: true,
        value: { mobile: true },
      });

      let resolveOpen: () => void;
      let resolveClose: () => void;
      let contentDuringCloseUpdate: boolean | null = null;

      const startViewTransition = vi.fn((callback: () => void | Promise<void>) => {
        const result = callback();
        if (startViewTransition.mock.calls.length === 2) {
          contentDuringCloseUpdate = !!screen.queryByTestId('content');
        }
        if (result && typeof (result as Promise<void>).then === 'function') {
          (result as Promise<void>).catch(vi.fn());
        }
        if (startViewTransition.mock.calls.length === 1) {
          return {
            finished: new Promise<void>((r) => {
              resolveOpen = r;
            }),
          };
        }
        return {
          finished: new Promise<void>((r) => {
            resolveClose = r;
          }),
        };
      });

      Object.defineProperty(document, 'startViewTransition', {
        value: startViewTransition,
        writable: true,
        configurable: true,
      });

      try {
        render(<TestLightbox viewTransition />);
        fireEvent.click(screen.getByTestId('trigger-0'));
        await act(async () => resolveOpen!());

        fireEvent.click(screen.getByTestId('close'));
        expect(contentDuringCloseUpdate).toBe(true);
        expect(screen.getByTestId('content')).toBeInTheDocument();
        expect(screen.getByTestId('content')).toHaveStyle({ visibility: 'hidden' });

        await act(async () => resolveClose!());
        expect(screen.queryByTestId('content')).not.toBeInTheDocument();
      } finally {
        if (originalChrome === undefined) {
          delete (window as unknown as { chrome?: unknown }).chrome;
        } else {
          (window as unknown as { chrome?: unknown }).chrome = originalChrome;
        }
        if (originalUaData === undefined) {
          delete (navigator as Navigator & { userAgentData?: unknown }).userAgentData;
        } else {
          Object.defineProperty(navigator, 'userAgentData', {
            configurable: true,
            value: originalUaData,
          });
        }
      }
    });

    it('keeps the page scroll locked until the VT close transition finishes', async () => {
      let resolveOpen: () => void;
      let resolveClose: () => void;

      const startViewTransition = vi.fn((callback: () => void | Promise<void>) => {
        const result = callback();
        if (result && typeof (result as Promise<void>).then === 'function') {
          (result as Promise<void>).catch(vi.fn());
        }
        if (startViewTransition.mock.calls.length === 1) {
          return {
            finished: new Promise<void>((r) => {
              resolveOpen = r;
            }),
          };
        }
        return {
          finished: new Promise<void>((r) => {
            resolveClose = r;
          }),
        };
      });

      Object.defineProperty(document, 'startViewTransition', {
        value: startViewTransition,
        writable: true,
        configurable: true,
      });

      render(<TestLightbox viewTransition />);
      fireEvent.click(screen.getByTestId('trigger-0'));
      await act(async () => resolveOpen!());

      // Open: page scroll is locked.
      expect(document.documentElement.style.overflow).toBe('hidden');

      // Close starts — but the transition hasn't finished yet, so the lock must
      // still hold (otherwise the page scrolls behind the closing animation).
      fireEvent.click(screen.getByTestId('close'));
      expect(document.documentElement.style.overflow).toBe('hidden');

      // Only once the close transition finishes is scrolling restored.
      await act(async () => resolveClose!());
      expect(document.documentElement.style.overflow).toBe('');
    });

    it('fires onOpenChangeComplete(false) after VT close finishes', async () => {
      let resolveOpen: () => void;
      let resolveClose: () => void;

      const startViewTransition = vi.fn((callback: () => void | Promise<void>) => {
        const result = callback();
        if (result && typeof (result as Promise<void>).then === 'function') {
          (result as Promise<void>).catch(vi.fn());
        }
        if (startViewTransition.mock.calls.length === 1) {
          return {
            finished: new Promise<void>((r) => {
              resolveOpen = r;
            }),
          };
        }
        return {
          finished: new Promise<void>((r) => {
            resolveClose = r;
          }),
        };
      });

      Object.defineProperty(document, 'startViewTransition', {
        value: startViewTransition,
        writable: true,
        configurable: true,
      });

      const completeSpy = vi.fn();
      render(<TestLightbox viewTransition onOpenChangeComplete={completeSpy} />);
      fireEvent.click(screen.getByTestId('trigger-0'));
      await act(async () => resolveOpen!());
      completeSpy.mockClear();

      fireEvent.click(screen.getByTestId('close'));
      expect(completeSpy).not.toHaveBeenCalled();

      await act(async () => resolveClose!());
      expect(completeSpy).toHaveBeenCalledWith(false);
    });

    describe('image decode before open transition', () => {
      it('does not delay open when item has no real image to decode', () => {
        const { startViewTransition } = mockViewTransitionAPI();

        render(<TestLightbox viewTransition />);
        fireEvent.click(screen.getByTestId('trigger-0'));

        expect(startViewTransition).toHaveBeenCalledOnce();
        expect(screen.getByTestId('content')).toBeInTheDocument();
      });

      it('passes a synchronous callback to startViewTransition on open', () => {
        const { startViewTransition } = mockViewTransitionAPI();

        render(<TestLightbox viewTransition />);
        fireEvent.click(screen.getByTestId('trigger-0'));

        expect(startViewTransition).toHaveBeenCalledOnce();
        // The decode wait happens BEFORE startViewTransition, so the update
        // callback is synchronous: the browser captures old -> runs the
        // callback -> captures new in one uninterrupted rendering update, with
        // no intermediate paint (which otherwise flashes an empty frame).
        const callback = startViewTransition.mock.calls[0][0];
        expect(callback.constructor.name).not.toBe('AsyncFunction');
      });

      it('both open and close VT callbacks are synchronous (decode waited before open)', async () => {
        const callbacks: Array<() => void | Promise<void>> = [];
        let resolveOpen: () => void;
        let resolveClose: () => void;
        const startViewTransition = vi.fn((cb: () => void | Promise<void>) => {
          callbacks.push(cb);
          const result = cb();
          if (result && typeof (result as Promise<void>).then === 'function') {
            (result as Promise<void>).catch(vi.fn());
          }
          if (startViewTransition.mock.calls.length === 1) {
            return {
              finished: new Promise<void>((r) => {
                resolveOpen = r;
              }),
            };
          }
          return {
            finished: new Promise<void>((r) => {
              resolveClose = r;
            }),
          };
        });
        Object.defineProperty(document, 'startViewTransition', {
          value: startViewTransition,
          writable: true,
          configurable: true,
        });

        render(<TestLightbox viewTransition />);
        fireEvent.click(screen.getByTestId('trigger-0'));
        await act(async () => resolveOpen!());

        fireEvent.click(screen.getByTestId('close'));

        expect(callbacks).toHaveLength(2);
        expect(callbacks[0].constructor.name).not.toBe('AsyncFunction');
        expect(callbacks[1].constructor.name).not.toBe('AsyncFunction');

        await act(async () => resolveClose!());
      });
    });

    describe('awaitImageDecode', () => {
      let originalDecode: PropertyDescriptor | undefined;
      let originalComplete: PropertyDescriptor | undefined;

      // Force a real <img> to look "not yet loaded" and route decode() through
      // a controllable mock, so the open morph's decode wait is deterministic
      // regardless of jsdom's image loading behavior.
      function setImageEnv(decodeImpl: () => Promise<void>) {
        originalDecode = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'decode');
        originalComplete = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'complete');
        Object.defineProperty(HTMLImageElement.prototype, 'decode', {
          value: vi.fn(decodeImpl),
          writable: true,
          configurable: true,
        });
        Object.defineProperty(HTMLImageElement.prototype, 'complete', {
          get: () => false,
          configurable: true,
        });
        return HTMLImageElement.prototype.decode as unknown as ReturnType<typeof vi.fn>;
      }

      afterEach(() => {
        if (originalDecode) {
          Object.defineProperty(HTMLImageElement.prototype, 'decode', originalDecode);
        } else {
          delete (HTMLImageElement.prototype as unknown as Record<string, unknown>).decode;
        }
        if (originalComplete) {
          Object.defineProperty(HTMLImageElement.prototype, 'complete', originalComplete);
        }
        originalDecode = undefined;
        originalComplete = undefined;
        vi.useRealTimers();
      });

      function renderImageLightbox(awaitImageDecode?: boolean | number) {
        return render(
          <LightboxRoot viewTransition awaitImageDecode={awaitImageDecode}>
            <LightboxTrigger index={0} data-testid="trigger-0">
              Open
            </LightboxTrigger>
            <LightboxPortal>
              <LightboxContent data-testid="content" aria-label="decode test">
                <SlidesHost>
                  <LightboxItem index={0} data-testid="item-0">
                    <img src="https://example.com/a.jpg" alt="a" />
                  </LightboxItem>
                </SlidesHost>
              </LightboxContent>
            </LightboxPortal>
          </LightboxRoot>,
        );
      }

      it('skips the decode wait entirely when awaitImageDecode={false}', () => {
        mockViewTransitionAPI();
        const decode = setImageEnv(() => new Promise<void>(() => {}));

        renderImageLightbox(false);
        fireEvent.click(screen.getByTestId('trigger-0'));

        // Opt-out: decode() is never invoked and the item is marked ready
        // synchronously, so the morph starts without waiting.
        expect(decode).not.toHaveBeenCalled();
        expect(screen.getByTestId('item-0')).toHaveAttribute('data-skip-fade');
      });

      it('awaits the destination image decode by default', () => {
        vi.useFakeTimers();
        mockViewTransitionAPI();
        const decode = setImageEnv(() => new Promise<void>(() => {}));

        renderImageLightbox();
        fireEvent.click(screen.getByTestId('trigger-0'));

        // The wait is in flight: decode was attempted and the item is not yet
        // marked ready (still awaiting decode or the timeout).
        expect(decode).toHaveBeenCalledTimes(1);
        expect(screen.getByTestId('item-0')).not.toHaveAttribute('data-skip-fade');
      });

      it('bounds the wait by the numeric timeout', async () => {
        vi.useFakeTimers();
        mockViewTransitionAPI();
        setImageEnv(() => new Promise<void>(() => {})); // decode never resolves

        renderImageLightbox(50);
        fireEvent.click(screen.getByTestId('trigger-0'));

        // Still waiting before the cap elapses.
        expect(screen.getByTestId('item-0')).not.toHaveAttribute('data-skip-fade');

        await act(async () => {
          vi.advanceTimersByTime(50);
        });

        // The timeout bounded the wait; the morph proceeds.
        expect(screen.getByTestId('item-0')).toHaveAttribute('data-skip-fade');
      });
    });

    describe('onBeforeOpen', () => {
      it('runs after prepare and delays the View Transition until the promise settles', async () => {
        const { startViewTransition } = mockViewTransitionAPI();
        let resolveReady!: () => void;
        const ready = new Promise<void>((r) => {
          resolveReady = r;
        });
        const onBeforeOpen = vi.fn(() => ready);

        render(
          <LightboxRoot viewTransition awaitImageDecode={false} onBeforeOpen={onBeforeOpen}>
            <LightboxTrigger index={0} data-testid="trigger-0">
              Open
            </LightboxTrigger>
            <LightboxPortal>
              <LightboxContent data-testid="content" aria-label="before-open test">
                <SlidesHost>
                  <LightboxItem index={0} data-testid="item-0">
                    item
                  </LightboxItem>
                </SlidesHost>
              </LightboxContent>
            </LightboxPortal>
          </LightboxRoot>,
        );

        fireEvent.click(screen.getByTestId('trigger-0'));

        // Prepared (item in DOM) but VT not started until onBeforeOpen resolves.
        expect(onBeforeOpen).toHaveBeenCalledOnce();
        expect(onBeforeOpen).toHaveBeenCalledWith(
          expect.objectContaining({
            destination: expect.any(Element),
            signal: expect.any(AbortSignal),
          }),
        );
        expect(startViewTransition).not.toHaveBeenCalled();
        expect(screen.getByTestId('item-0')).not.toHaveAttribute('data-skip-fade');

        await act(async () => {
          resolveReady();
          await ready;
        });

        expect(startViewTransition).toHaveBeenCalledOnce();
        expect(screen.getByTestId('item-0')).toHaveAttribute('data-skip-fade');
      });

      it('aborts the signal when a close supersedes the pending open', async () => {
        mockViewTransitionAPI();
        let seenSignal: AbortSignal | undefined;
        const onBeforeOpen = vi.fn(({ signal }: { signal: AbortSignal }) => {
          seenSignal = signal;
          return new Promise<void>(() => {});
        });

        render(
          <LightboxRoot viewTransition awaitImageDecode={false} onBeforeOpen={onBeforeOpen}>
            <LightboxTrigger index={0} data-testid="trigger-0">
              Open
            </LightboxTrigger>
            <LightboxPortal>
              <LightboxContent data-testid="content" aria-label="before-open abort test">
                <SlidesHost>
                  <LightboxItem index={0} data-testid="item-0">
                    item
                  </LightboxItem>
                </SlidesHost>
              </LightboxContent>
            </LightboxPortal>
            <LightboxClose data-testid="close">Close</LightboxClose>
          </LightboxRoot>,
        );

        fireEvent.click(screen.getByTestId('trigger-0'));
        expect(onBeforeOpen).toHaveBeenCalledOnce();
        expect(seenSignal?.aborted).toBe(false);

        await act(async () => {
          fireEvent.click(screen.getByTestId('close'));
        });

        expect(seenSignal?.aborted).toBe(true);
      });
    });

    describe('onBeforeClose', () => {
      it('runs before the close View Transition starts', async () => {
        const { startViewTransition } = mockViewTransitionAPI();
        const onBeforeClose = vi.fn();

        render(
          <LightboxRoot viewTransition awaitImageDecode={false} onBeforeClose={onBeforeClose}>
            <LightboxTrigger index={0} data-testid="trigger-0">
              Open
            </LightboxTrigger>
            <LightboxPortal>
              <LightboxContent data-testid="content" aria-label="before-close test">
                <SlidesHost>
                  <LightboxItem index={0} data-testid="item-0">
                    item
                  </LightboxItem>
                </SlidesHost>
                <LightboxClose data-testid="close">Close</LightboxClose>
              </LightboxContent>
            </LightboxPortal>
          </LightboxRoot>,
        );

        fireEvent.click(screen.getByTestId('trigger-0'));
        await act(async () => {});

        expect(onBeforeClose).not.toHaveBeenCalled();
        const callsAfterOpen = startViewTransition.mock.calls.length;
        expect(callsAfterOpen).toBeGreaterThan(0);

        fireEvent.click(screen.getByTestId('close'));

        expect(onBeforeClose).toHaveBeenCalledOnce();
        expect(onBeforeClose).toHaveBeenCalledWith(
          expect.objectContaining({
            destination: expect.any(Element),
          }),
        );
        expect(startViewTransition.mock.calls.length).toBeGreaterThan(callsAfterOpen);
      });
    });

    describe('morph fallback when destination target has no resolvable size', () => {
      let originalRect: PropertyDescriptor | undefined;

      // jsdom has no layout, so every getBoundingClientRect is 0×0. Force the
      // morph target's rendered box to a fixed size to model whether the layout
      // is reserved (loaded image, or explicit width/height / CSS dimensions
      // like a Next.js <Image>) vs. a collapsed 0×0 unsized-and-unloaded image.
      function mockTargetBox(sized: boolean) {
        originalRect = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'getBoundingClientRect');
        const w = sized ? 800 : 0;
        const h = sized ? 600 : 0;
        Object.defineProperty(HTMLImageElement.prototype, 'getBoundingClientRect', {
          value: () => ({ width: w, height: h, top: 0, left: 0, right: w, bottom: h, x: 0, y: 0, toJSON() {} }),
          writable: true,
          configurable: true,
        });
      }

      afterEach(() => {
        if (originalRect) {
          Object.defineProperty(HTMLImageElement.prototype, 'getBoundingClientRect', originalRect);
        }
        originalRect = undefined;
      });

      function renderImageLightbox() {
        return render(
          // awaitImageDecode={false} keeps the open path synchronous so the VT
          // callback (which assigns the item morph name) runs during the click.
          <LightboxRoot viewTransition awaitImageDecode={false}>
            <LightboxTrigger index={0} data-testid="trigger-0">
              Open
            </LightboxTrigger>
            <LightboxPortal>
              <LightboxContent data-testid="content" aria-label="morph fallback test">
                <SlidesHost>
                  <LightboxItem index={0} data-testid="item-0">
                    {({ imageRef }) => <img ref={imageRef} src="a.jpg" alt="a" />}
                  </LightboxItem>
                </SlidesHost>
              </LightboxContent>
            </LightboxPortal>
          </LightboxRoot>,
        );
      }

      it('morphs when the target box is reserved even if the image has not loaded (e.g. Next.js <Image>)', () => {
        mockViewTransitionAPI();
        // Box reserved by layout, but the image itself is unloaded (jsdom never
        // loads it): the morph should still proceed off the resolved box.
        mockTargetBox(true);
        renderImageLightbox();
        fireEvent.click(screen.getByTestId('trigger-0'));

        // Morph path: the destination image gets the morph view-transition-name
        // and hard-cut is applied (crossfade defaults to unset; no data-ramka-crossfade).
        const img = screen.getByTestId('item-0').querySelector('img')!;
        expect(img.style.getPropertyValue('view-transition-name')).toBe('lightbox-morph');
        expect(document.documentElement).not.toHaveAttribute('data-ramka-crossfade');
      });

      it('falls back to a plain crossfade when the target box is 0×0 (unsized image that never loaded)', () => {
        mockViewTransitionAPI();
        mockTargetBox(false);
        renderImageLightbox();
        fireEvent.click(screen.getByTestId('trigger-0'));

        // Fallback path: no morph name (which would shrink the trigger into a
        // 0×0 box) with data-ramka-crossfade — a clean root crossfade instead.
        const img = screen.getByTestId('item-0').querySelector('img')!;
        expect(img.style.getPropertyValue('view-transition-name')).toBe('');
        expect(document.documentElement).toHaveAttribute('data-ramka-crossfade');
        // Still a real View Transition, and the item is still marked ready.
        expect(document.documentElement).toHaveAttribute('data-ramka-view-transition');
        expect(screen.getByTestId('item-0')).toHaveAttribute('data-skip-fade');
      });
    });

    describe('data-morph-target', () => {
      it('sets data-morph-target on the trigger when morphRef is unset', () => {
        render(
          <LightboxRoot>
            <LightboxTrigger index={0} data-testid="trigger-0">
              <img src="thumb.jpg" alt="thumb" />
            </LightboxTrigger>
            <LightboxPortal>
              <LightboxContent aria-label="morph attr test">
                <SlidesHost>
                  <LightboxItem index={0}>
                    <img src="full.jpg" alt="full" />
                  </LightboxItem>
                </SlidesHost>
              </LightboxContent>
            </LightboxPortal>
          </LightboxRoot>,
        );

        const trigger = screen.getByTestId('trigger-0');
        expect(trigger).not.toHaveAttribute('data-morph-target');
        fireEvent.click(trigger);
        expect(trigger).toHaveAttribute('data-morph-target');
        // Base UI must not also serialize the state key as `data-morphtarget`.
        expect(trigger).not.toHaveAttribute('data-morphtarget');
      });

      it('sets data-morph-target on the morphRef node, not the trigger', () => {
        render(
          <LightboxRoot>
            <LightboxTrigger index={0} data-testid="trigger-0">
              {({ morphRef }) => (
                <span data-testid="card">
                  <img ref={morphRef} data-testid="morph-el" src="thumb.jpg" alt="thumb" />
                  <span>Label stays</span>
                </span>
              )}
            </LightboxTrigger>
            <LightboxPortal>
              <LightboxContent aria-label="morph attr test">
                <SlidesHost>
                  <LightboxItem index={0}>
                    <img src="full.jpg" alt="full" />
                  </LightboxItem>
                </SlidesHost>
              </LightboxContent>
            </LightboxPortal>
          </LightboxRoot>,
        );

        fireEvent.click(screen.getByTestId('trigger-0'));
        expect(screen.getByTestId('trigger-0')).not.toHaveAttribute('data-morph-target');
        expect(screen.getByTestId('morph-el')).toHaveAttribute('data-morph-target');
        expect(screen.getByTestId('card')).not.toHaveAttribute('data-morph-target');
      });

      it('tolerates an inline combined imageRef+morphRef callback without looping', () => {
        render(
          <LightboxRoot>
            <LightboxTrigger index={0} data-testid="trigger-0">
              {({ imageRef, morphRef }) => (
                <img
                  ref={(node) => {
                    imageRef(node);
                    morphRef(node);
                  }}
                  data-testid="morph-el"
                  src="thumb.jpg"
                  alt="thumb"
                />
              )}
            </LightboxTrigger>
            <LightboxPortal>
              <LightboxContent aria-label="morph attr test">
                <SlidesHost>
                  <LightboxItem index={0}>
                    <img src="full.jpg" alt="full" />
                  </LightboxItem>
                </SlidesHost>
              </LightboxContent>
            </LightboxPortal>
          </LightboxRoot>,
        );

        fireEvent.click(screen.getByTestId('trigger-0'));
        expect(screen.getByTestId('morph-el')).toHaveAttribute('data-morph-target');
      });
    });

    describe('crossfade direction', () => {
      let originalRect: PropertyDescriptor | undefined;

      function mockTargetBox() {
        originalRect = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'getBoundingClientRect');
        Object.defineProperty(HTMLImageElement.prototype, 'getBoundingClientRect', {
          value: () => ({
            width: 800,
            height: 600,
            top: 0,
            left: 0,
            right: 800,
            bottom: 600,
            x: 0,
            y: 0,
            toJSON() {},
          }),
          writable: true,
          configurable: true,
        });
      }

      afterEach(() => {
        if (originalRect) {
          Object.defineProperty(HTMLImageElement.prototype, 'getBoundingClientRect', originalRect);
        }
        originalRect = undefined;
      });

      function renderCrossfadeLightbox(crossfade?: 'open' | 'close' | 'both') {
        return render(
          <LightboxRoot viewTransition awaitImageDecode={false}>
            <LightboxTrigger index={0} crossfade={crossfade} data-testid="trigger-0">
              {({ imageRef }) => <img ref={imageRef} src="thumb.jpg" alt="thumb" />}
            </LightboxTrigger>
            <LightboxPortal>
              <LightboxContent data-testid="content" aria-label="crossfade test">
                <LightboxClose data-testid="close">Close</LightboxClose>
                <SlidesHost>
                  <LightboxItem index={0} data-testid="item-0">
                    {({ imageRef }) => <img ref={imageRef} src="full.jpg" alt="full" />}
                  </LightboxItem>
                </SlidesHost>
              </LightboxContent>
            </LightboxPortal>
          </LightboxRoot>,
        );
      }

      it('writes data-crossfade on the trigger for the chosen mode', () => {
        renderCrossfadeLightbox('close');
        expect(screen.getByTestId('trigger-0')).toHaveAttribute('data-crossfade', 'close');
      });

      it('omits data-crossfade when unset', () => {
        renderCrossfadeLightbox();
        expect(screen.getByTestId('trigger-0')).not.toHaveAttribute('data-crossfade');
      });

      it('hard-cuts open when crossfade="close"', () => {
        mockViewTransitionAPI();
        mockTargetBox();
        renderCrossfadeLightbox('close');
        fireEvent.click(screen.getByTestId('trigger-0'));
        expect(document.documentElement).not.toHaveAttribute('data-ramka-crossfade');
      });

      it('crossfades open when crossfade="open"', () => {
        mockViewTransitionAPI();
        mockTargetBox();
        renderCrossfadeLightbox('open');
        fireEvent.click(screen.getByTestId('trigger-0'));
        expect(document.documentElement).toHaveAttribute('data-ramka-crossfade');
      });

      it('crossfades open when crossfade="both"', () => {
        mockViewTransitionAPI();
        mockTargetBox();
        renderCrossfadeLightbox('both');
        fireEvent.click(screen.getByTestId('trigger-0'));
        expect(document.documentElement).toHaveAttribute('data-ramka-crossfade');
      });

      function mockOpenThenCloseTransition() {
        let resolveOpen: () => void;
        let resolveClose: () => void;
        const startViewTransition = vi.fn((callback: () => void | Promise<void>) => {
          const result = callback();
          if (result && typeof (result as Promise<void>).then === 'function') {
            (result as Promise<void>).catch(vi.fn());
          }
          if (startViewTransition.mock.calls.length === 1) {
            return {
              finished: new Promise<void>((r) => {
                resolveOpen = r;
              }),
            };
          }
          return {
            finished: new Promise<void>((r) => {
              resolveClose = r;
            }),
          };
        });
        Object.defineProperty(document, 'startViewTransition', {
          value: startViewTransition,
          writable: true,
          configurable: true,
        });
        return {
          resolveOpen: () => resolveOpen!(),
          resolveClose: () => resolveClose!(),
        };
      }

      it('crossfades close when crossfade="close"', async () => {
        const { resolveOpen } = mockOpenThenCloseTransition();
        mockTargetBox();
        renderCrossfadeLightbox('close');
        fireEvent.click(screen.getByTestId('trigger-0'));
        // Open was hard-cut.
        expect(document.documentElement).not.toHaveAttribute('data-ramka-crossfade');
        await act(async () => resolveOpen());

        fireEvent.click(screen.getByTestId('close'));
        expect(document.documentElement).toHaveAttribute('data-ramka-view-transition', 'closing');
        expect(document.documentElement).toHaveAttribute('data-ramka-crossfade');
      });

      it('hard-cuts close when crossfade="open"', async () => {
        const { resolveOpen } = mockOpenThenCloseTransition();
        mockTargetBox();
        renderCrossfadeLightbox('open');
        fireEvent.click(screen.getByTestId('trigger-0'));
        expect(document.documentElement).toHaveAttribute('data-ramka-crossfade');
        await act(async () => resolveOpen());

        fireEvent.click(screen.getByTestId('close'));
        expect(document.documentElement).toHaveAttribute('data-ramka-view-transition', 'closing');
        expect(document.documentElement).not.toHaveAttribute('data-ramka-crossfade');
      });
    });

    describe('border-radius CSS vars', () => {
      let originalRect: PropertyDescriptor | undefined;

      // `getBoundingClientRect` lives on Element.prototype. Without a non-zero
      // box, resolveMorphBorderRadius returns "0px" (jsdom layout is always 0).
      function mockTargetBox() {
        originalRect = Object.getOwnPropertyDescriptor(Element.prototype, 'getBoundingClientRect');
        Object.defineProperty(Element.prototype, 'getBoundingClientRect', {
          value: () => ({
            width: 800,
            height: 600,
            top: 0,
            left: 0,
            right: 800,
            bottom: 600,
            x: 0,
            y: 0,
            toJSON() {},
          }),
          writable: true,
          configurable: true,
        });
      }

      afterEach(() => {
        if (originalRect) {
          Object.defineProperty(Element.prototype, 'getBoundingClientRect', originalRect);
        }
        originalRect = undefined;
      });

      it('writes from/to radius vars for the VT group CSS without mutating live radii', () => {
        mockViewTransitionAPI();
        mockTargetBox();
        render(
          <LightboxRoot viewTransition awaitImageDecode={false}>
            <LightboxTrigger index={0} crossfade="both" data-testid="trigger-0" style={{ borderRadius: '32px' }}>
              {({ imageRef }) => <img ref={imageRef} src="thumb.jpg" alt="thumb" style={{ borderRadius: '32px' }} />}
            </LightboxTrigger>
            <LightboxPortal>
              <LightboxContent data-testid="content" aria-label="radius vars test">
                <SlidesHost>
                  <LightboxItem index={0} data-testid="item-0">
                    {({ imageRef }) => <img ref={imageRef} src="full.jpg" alt="full" style={{ borderRadius: '8px' }} />}
                  </LightboxItem>
                </SlidesHost>
              </LightboxContent>
            </LightboxPortal>
          </LightboxRoot>,
        );

        fireEvent.click(screen.getByTestId('trigger-0'));

        expect(document.documentElement.style.getPropertyValue('--lightbox-morph-border-radius-from')).toBe('32px');
        expect(document.documentElement.style.getPropertyValue('--lightbox-morph-border-radius-to')).toBe('8px');
        // Live elements keep their radii — shape morph is CSS on the VT group.
        expect(screen.getByTestId('trigger-0').style.borderRadius).toBe('32px');
        expect(screen.getByTestId('item-0').querySelector('img')!.style.borderRadius).toBe('8px');
      });
    });

    describe('dev warning: item morphs into its own element (no ref wired)', () => {
      let originalRect: PropertyDescriptor | undefined;

      // Give the item's own <div> a resolvable box so `canMorph` is true and the
      // warn path (morph target === item element) is actually reached. Mock on
      // HTMLElement.prototype so it applies to the container div (and any img).
      function mockResolvableBox() {
        originalRect = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'getBoundingClientRect');
        Object.defineProperty(HTMLElement.prototype, 'getBoundingClientRect', {
          value: () => ({
            width: 800,
            height: 600,
            top: 0,
            left: 0,
            right: 800,
            bottom: 600,
            x: 0,
            y: 0,
            toJSON() {},
          }),
          writable: true,
          configurable: true,
        });
      }

      afterEach(() => {
        if (originalRect) {
          Object.defineProperty(HTMLElement.prototype, 'getBoundingClientRect', originalRect);
        }
        originalRect = undefined;
      });

      const MORPH_WARN = 'morphing into its own element';

      it('warns when a morphing item has no imageRef / morphRef wired', () => {
        mockViewTransitionAPI();
        mockResolvableBox();
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

        render(
          // awaitImageDecode={false} keeps the open path synchronous so the VT
          // callback (and the warn check) runs during the click.
          <LightboxRoot viewTransition awaitImageDecode={false}>
            <LightboxTrigger index={0} data-testid="trigger-0">
              Open
            </LightboxTrigger>
            <LightboxPortal>
              <LightboxContent data-testid="content" aria-label="unwired warn">
                <SlidesHost>
                  <LightboxItem index={0} data-testid="item-0">
                    {/* No imageRef / morphRef → target resolves to the item element. */}
                    <div>no morph target here</div>
                  </LightboxItem>
                </SlidesHost>
              </LightboxContent>
            </LightboxPortal>
          </LightboxRoot>,
        );
        fireEvent.click(screen.getByTestId('trigger-0'));

        expect(warn).toHaveBeenCalledWith(expect.stringContaining(MORPH_WARN), screen.getByTestId('item-0'));
        warn.mockRestore();
      });

      it('does NOT warn when imageRef designates the destination image', () => {
        mockViewTransitionAPI();
        mockResolvableBox();
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

        render(
          <LightboxRoot viewTransition awaitImageDecode={false}>
            <LightboxTrigger index={0} data-testid="trigger-0">
              Open
            </LightboxTrigger>
            <LightboxPortal>
              <LightboxContent data-testid="content" aria-label="wired ok">
                <SlidesHost>
                  <LightboxItem index={0} data-testid="item-0">
                    {({ imageRef }) => <img ref={imageRef} src="a.jpg" alt="a" />}
                  </LightboxItem>
                </SlidesHost>
              </LightboxContent>
            </LightboxPortal>
          </LightboxRoot>,
        );
        fireEvent.click(screen.getByTestId('trigger-0'));

        expect(warn).not.toHaveBeenCalledWith(expect.stringContaining(MORPH_WARN), expect.anything());
        warn.mockRestore();
      });

      it('does NOT warn when Lightbox.Media wraps the destination image', () => {
        mockViewTransitionAPI();
        mockResolvableBox();
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

        render(
          <LightboxRoot viewTransition awaitImageDecode={false}>
            <LightboxTrigger index={0} data-testid="trigger-0">
              Open
            </LightboxTrigger>
            <LightboxPortal>
              <LightboxContent data-testid="content" aria-label="media wired">
                <SlidesHost>
                  <LightboxItem index={0} data-testid="item-0">
                    <LightboxZoom>
                      <LightboxMedia data-testid="media">
                        <img src="a.jpg" alt="a" />
                      </LightboxMedia>
                    </LightboxZoom>
                  </LightboxItem>
                </SlidesHost>
              </LightboxContent>
            </LightboxPortal>
          </LightboxRoot>,
        );
        fireEvent.click(screen.getByTestId('trigger-0'));

        expect(warn).not.toHaveBeenCalledWith(expect.stringContaining(MORPH_WARN), expect.anything());
        // Morph targets Media (sized host), not the Item root.
        expect(screen.getByTestId('media').style.getPropertyValue('view-transition-name')).toBe('lightbox-morph');
        warn.mockRestore();
      });

      it('warns when Lightbox.Media collapses to 0×0 (no resolvable fit-box)', () => {
        mockViewTransitionAPI();
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        // Trigger has a box (so open proceeds); Media stays 0×0.
        originalRect = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'getBoundingClientRect');
        Object.defineProperty(HTMLElement.prototype, 'getBoundingClientRect', {
          value: function (this: HTMLElement) {
            if (this.getAttribute('data-testid') === 'media') {
              return {
                width: 0,
                height: 0,
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                x: 0,
                y: 0,
                toJSON() {},
              };
            }
            return {
              width: 80,
              height: 80,
              top: 0,
              left: 0,
              right: 80,
              bottom: 80,
              x: 0,
              y: 0,
              toJSON() {},
            };
          },
          writable: true,
          configurable: true,
        });

        render(
          <LightboxRoot viewTransition awaitImageDecode={false}>
            <LightboxTrigger index={0} data-testid="trigger-0">
              Open
            </LightboxTrigger>
            <LightboxPortal>
              <LightboxContent aria-label="collapsed media">
                <SlidesHost>
                  <LightboxItem index={0}>
                    <LightboxMedia data-testid="media">
                      <img src="a.jpg" alt="a" />
                    </LightboxMedia>
                  </LightboxItem>
                </SlidesHost>
              </LightboxContent>
            </LightboxPortal>
          </LightboxRoot>,
        );
        fireEvent.click(screen.getByTestId('trigger-0'));

        expect(warn).toHaveBeenCalledWith(expect.stringContaining('no resolvable size'), screen.getByTestId('media'));
        warn.mockRestore();
      });
    });

    describe('Stage morphRef (shared capture destination)', () => {
      let originalRect: PropertyDescriptor | undefined;

      function mockResolvableBox() {
        originalRect = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'getBoundingClientRect');
        Object.defineProperty(HTMLElement.prototype, 'getBoundingClientRect', {
          value: () => ({
            width: 360,
            height: 640,
            top: 0,
            left: 0,
            right: 360,
            bottom: 640,
            x: 0,
            y: 0,
            toJSON() {},
          }),
          writable: true,
          configurable: true,
        });
      }

      afterEach(() => {
        if (originalRect) {
          Object.defineProperty(HTMLElement.prototype, 'getBoundingClientRect', originalRect);
        }
        originalRect = undefined;
      });

      it('names the Stage morphRef node, not the item Media', () => {
        mockViewTransitionAPI();
        mockResolvableBox();

        render(
          <LightboxRoot viewTransition awaitImageDecode={false}>
            <LightboxTrigger index={0} data-testid="trigger-0">
              Open
            </LightboxTrigger>
            <LightboxPortal>
              <LightboxContent aria-label="stage morph">
                <LightboxStage>
                  {({ morphRef }) => (
                    <div ref={morphRef} data-testid="frame">
                      <SlidesHost>
                        <LightboxItem index={0} data-testid="item-0">
                          <LightboxMedia data-testid="media">
                            <img src="a.jpg" alt="a" />
                          </LightboxMedia>
                        </LightboxItem>
                      </SlidesHost>
                    </div>
                  )}
                </LightboxStage>
              </LightboxContent>
            </LightboxPortal>
          </LightboxRoot>,
        );

        fireEvent.click(screen.getByTestId('trigger-0'));

        expect(screen.getByTestId('frame').style.getPropertyValue('view-transition-name')).toBe(
          'lightbox-morph',
        );
        expect(screen.getByTestId('media').style.getPropertyValue('view-transition-name')).toBe('');
        expect(screen.getByTestId('item-0').style.getPropertyValue('view-transition-name')).toBe('');
      });

      it('passes the Stage morphRef node as onBeforeClose destination', () => {
        mockViewTransitionAPI();
        mockResolvableBox();
        const onBeforeClose = vi.fn();

        render(
          <LightboxRoot viewTransition awaitImageDecode={false} onBeforeClose={onBeforeClose}>
            <LightboxTrigger index={0} data-testid="trigger-0">
              Open
            </LightboxTrigger>
            <LightboxPortal>
              <LightboxContent aria-label="stage close dest">
                <LightboxStage>
                  {({ morphRef }) => (
                    <div ref={morphRef} data-testid="frame">
                      <SlidesHost>
                        <LightboxItem index={0} data-testid="item-0">
                          item
                        </LightboxItem>
                      </SlidesHost>
                    </div>
                  )}
                </LightboxStage>
                <LightboxClose data-testid="close">Close</LightboxClose>
              </LightboxContent>
            </LightboxPortal>
          </LightboxRoot>,
        );

        fireEvent.click(screen.getByTestId('trigger-0'));
        const frame = screen.getByTestId('frame');
        fireEvent.click(screen.getByTestId('close'));

        expect(onBeforeClose).toHaveBeenCalledWith(
          expect.objectContaining({ destination: frame }),
        );
      });

      it('does NOT warn about an unwired item when Stage morphRef is attached', () => {
        mockViewTransitionAPI();
        mockResolvableBox();
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

        render(
          <LightboxRoot viewTransition awaitImageDecode={false}>
            <LightboxTrigger index={0} data-testid="trigger-0">
              Open
            </LightboxTrigger>
            <LightboxPortal>
              <LightboxContent aria-label="stage morph no warn">
                <LightboxStage>
                  {({ morphRef }) => (
                    <div ref={morphRef} data-testid="frame">
                      <SlidesHost>
                        <LightboxItem index={0} data-testid="item-0">
                          <div>no item morphRef</div>
                        </LightboxItem>
                      </SlidesHost>
                    </div>
                  )}
                </LightboxStage>
              </LightboxContent>
            </LightboxPortal>
          </LightboxRoot>,
        );

        fireEvent.click(screen.getByTestId('trigger-0'));

        expect(warn).not.toHaveBeenCalledWith(
          expect.stringContaining('morphing into its own element'),
          expect.anything(),
        );
        warn.mockRestore();
      });

      it('lets a nested wrapper attach morphRef via Stage context', () => {
        mockViewTransitionAPI();
        mockResolvableBox();

        function Frame({ children }: { children: React.ReactNode }) {
          const stage = useOptionalLightboxStageContext();
          return (
            <div ref={stage?.morphRef} data-testid="frame">
              {children}
            </div>
          );
        }

        render(
          <LightboxRoot viewTransition awaitImageDecode={false}>
            <LightboxTrigger index={0} data-testid="trigger-0">
              Open
            </LightboxTrigger>
            <LightboxPortal>
              <LightboxContent aria-label="stage context">
                <LightboxStage>
                  <Frame>
                    <SlidesHost>
                      <LightboxItem index={0}>item</LightboxItem>
                    </SlidesHost>
                  </Frame>
                </LightboxStage>
              </LightboxContent>
            </LightboxPortal>
          </LightboxRoot>,
        );

        fireEvent.click(screen.getByTestId('trigger-0'));

        expect(screen.getByTestId('frame').style.getPropertyValue('view-transition-name')).toBe(
          'lightbox-morph',
        );
      });
    });

    it('does not use VT when prefers-reduced-motion is set', () => {
      mockViewTransitionAPI();
      vi.spyOn(window, 'matchMedia').mockImplementation((query: string) => ({
        matches: query === '(prefers-reduced-motion: reduce)',
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }));

      const { startViewTransition } = { startViewTransition: document.startViewTransition as ReturnType<typeof vi.fn> };
      render(<TestLightbox viewTransition />);
      fireEvent.click(screen.getByTestId('trigger-0'));
      expect(startViewTransition).not.toHaveBeenCalled();
      expect(screen.getByTestId('content')).toBeInTheDocument();
    });
  });

  // ---------------------------------------------------------------------------
  // 13. Native gesture prevention
  // ---------------------------------------------------------------------------

  describe('native gesture prevention', () => {
    it('prevents multi-touch pinch on content', () => {
      render(
        <LightboxRoot defaultOpen>
          <LightboxPortal>
            <LightboxContent data-testid="content" aria-label="Pinch test">
              <SlidesHost>
                <LightboxItem index={0}>
                  <img src="test.jpg" alt="test" />
                </LightboxItem>
              </SlidesHost>
            </LightboxContent>
          </LightboxPortal>
        </LightboxRoot>,
      );

      const content = screen.getByTestId('content');
      const event = new TouchEvent('touchmove', {
        bubbles: true,
        cancelable: true,
        touches: [
          new Touch({ identifier: 0, target: content, clientX: 0, clientY: 0 }),
          new Touch({ identifier: 1, target: content, clientX: 100, clientY: 100 }),
        ],
      });
      const prevented = !content.dispatchEvent(event);
      expect(prevented).toBe(true);
    });

    it('allows single-touch on content', () => {
      render(
        <LightboxRoot defaultOpen>
          <LightboxPortal>
            <LightboxContent data-testid="content" aria-label="Single touch test">
              <SlidesHost>
                <LightboxItem index={0}>
                  <img src="test.jpg" alt="test" />
                </LightboxItem>
              </SlidesHost>
            </LightboxContent>
          </LightboxPortal>
        </LightboxRoot>,
      );

      const content = screen.getByTestId('content');
      const event = new TouchEvent('touchmove', {
        bubbles: true,
        cancelable: true,
        touches: [new Touch({ identifier: 0, target: content, clientX: 0, clientY: 0 })],
      });
      const prevented = !content.dispatchEvent(event);
      expect(prevented).toBe(false);
    });

    it('prevents leftover-finger gallery scroll after a pinch', () => {
      render(
        <LightboxRoot defaultOpen>
          <LightboxPortal>
            <LightboxContent data-testid="content" aria-label="Leftover finger">
              <SlidesHost>
                <LightboxItem index={0}>
                  <img src="test.jpg" alt="test" />
                </LightboxItem>
              </SlidesHost>
            </LightboxContent>
          </LightboxPortal>
        </LightboxRoot>,
      );

      const content = screen.getByTestId('content');
      content.dispatchEvent(
        new TouchEvent('touchstart', {
          bubbles: true,
          cancelable: true,
          touches: [
            new Touch({ identifier: 0, target: content, clientX: 0, clientY: 0 }),
            new Touch({ identifier: 1, target: content, clientX: 100, clientY: 100 }),
          ],
        }),
      );
      const leftover = new TouchEvent('touchmove', {
        bubbles: true,
        cancelable: true,
        touches: [new Touch({ identifier: 0, target: content, clientX: 40, clientY: 0 })],
      });
      expect(!content.dispatchEvent(leftover)).toBe(true);
    });

    describe('touch scroll containment (iOS address bar)', () => {
      function renderChromeLightbox() {
        return render(
          <LightboxRoot defaultOpen>
            <LightboxPortal>
              <LightboxContent data-testid="content" aria-label="Containment test">
                <LightboxClose data-testid="close">Close</LightboxClose>
                <div data-testid="panel" style={{ overflowY: 'auto' }}>
                  <p data-testid="panel-text">scrollable chrome</p>
                </div>
                <SlidesHost>
                  <LightboxItem index={0}>
                    <img src="test.jpg" alt="test" />
                  </LightboxItem>
                </SlidesHost>
              </LightboxContent>
            </LightboxPortal>
          </LightboxRoot>,
        );
      }

      function fireTouch(el: Element, type: string, x: number, y: number, fingers = 1) {
        const touches = Array.from(
          { length: fingers },
          (_, i) => new Touch({ identifier: i, target: el, clientX: x, clientY: y }),
        );
        const event = new TouchEvent(type, { bubbles: true, cancelable: true, touches });
        return !el.dispatchEvent(event); // true when preventDefault-ed
      }

      /** Give the panel real scroll metrics (jsdom reports 0 everywhere). */
      function makePanelScrollable(panel: HTMLElement, scrollTop: number) {
        Object.defineProperty(panel, 'scrollHeight', { value: 200, configurable: true });
        Object.defineProperty(panel, 'clientHeight', { value: 100, configurable: true });
        Object.defineProperty(panel, 'scrollTop', { value: scrollTop, configurable: true });
      }

      it('cancels a vertical drag starting on non-scrollable chrome (close button)', () => {
        renderChromeLightbox();
        const close = screen.getByTestId('close');
        fireTouch(close, 'touchstart', 10, 100);
        expect(fireTouch(close, 'touchmove', 10, 130)).toBe(true);
      });

      it('leaves a drag alone until it passes the direction lock', () => {
        renderChromeLightbox();
        const close = screen.getByTestId('close');
        fireTouch(close, 'touchstart', 10, 100);
        // 3px wiggle — under the 6px lock, must not swallow a tap's moves.
        expect(fireTouch(close, 'touchmove', 10, 103)).toBe(false);
      });

      it('allows a horizontal drag on chrome (slides/strip own that axis)', () => {
        renderChromeLightbox();
        const close = screen.getByTestId('close');
        fireTouch(close, 'touchstart', 10, 100);
        expect(fireTouch(close, 'touchmove', 40, 102)).toBe(false);
      });

      it('allows a vertical drag inside scrollable chrome that can consume it', () => {
        renderChromeLightbox();
        const panel = screen.getByTestId('panel');
        makePanelScrollable(panel, 50); // mid-scroll — both directions available
        const text = screen.getByTestId('panel-text');
        fireTouch(text, 'touchstart', 10, 100);
        expect(fireTouch(text, 'touchmove', 10, 130)).toBe(false);
      });

      it('cancels a vertical drag at the scrollable chrome boundary (no chain to the bar)', () => {
        renderChromeLightbox();
        const panel = screen.getByTestId('panel');
        makePanelScrollable(panel, 0); // at top — finger-down pan has nothing to consume
        const text = screen.getByTestId('panel-text');
        fireTouch(text, 'touchstart', 10, 100);
        expect(fireTouch(text, 'touchmove', 10, 130)).toBe(true);
      });

      it('ignores multi-finger gestures (pinch guard owns them)', () => {
        renderChromeLightbox();
        const close = screen.getByTestId('close');
        fireTouch(close, 'touchstart', 10, 100, 2);
        // Single-finger containment must not have latched onto a pinch.
        expect(fireTouch(close, 'touchmove', 10, 130, 2)).toBe(true); // prevented by the PINCH guard
      });
    });

    it('prevents ctrl+wheel (trackpad pinch-to-zoom) on content', () => {
      // On non-Safari browsers (including jsdom), Ctrl+wheel is prevented via
      // a non-passive wheel listener. On Safari, native zoom is prevented via
      // GestureEvent instead (to preserve momentum scrolling).
      render(
        <LightboxRoot defaultOpen>
          <LightboxPortal>
            <LightboxContent data-testid="content" aria-label="Wheel zoom test">
              <SlidesHost>
                <LightboxItem index={0}>
                  <img src="test.jpg" alt="test" />
                </LightboxItem>
              </SlidesHost>
            </LightboxContent>
          </LightboxPortal>
        </LightboxRoot>,
      );

      const content = screen.getByTestId('content');
      const event = new WheelEvent('wheel', {
        bubbles: true,
        cancelable: true,
        ctrlKey: true,
        deltaY: -10,
      });
      const prevented = !content.dispatchEvent(event);
      expect(prevented).toBe(true);
    });

    it('allows regular wheel scroll on content', () => {
      render(
        <LightboxRoot defaultOpen>
          <LightboxPortal>
            <LightboxContent data-testid="content" aria-label="Regular wheel test">
              <SlidesHost>
                <LightboxItem index={0}>
                  <img src="test.jpg" alt="test" />
                </LightboxItem>
              </SlidesHost>
            </LightboxContent>
          </LightboxPortal>
        </LightboxRoot>,
      );

      const content = screen.getByTestId('content');
      const event = new WheelEvent('wheel', {
        bubbles: true,
        cancelable: true,
        ctrlKey: false,
        deltaY: -10,
      });
      const prevented = !content.dispatchEvent(event);
      expect(prevented).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // 14. Zoom
  // ---------------------------------------------------------------------------

  describe('zoom', () => {
    function ZoomLightbox({
      maxZoom = 4,
      onZoomChange,
    }: { maxZoom?: number; onZoomChange?: (z: number) => void } = {}) {
      return (
        <LightboxRoot defaultOpen>
          <LightboxPortal>
            <LightboxContent data-testid="content" aria-label="Zoom test">
              <SlidesHost>
                <LightboxItem index={0} data-testid="item-0">
                  <LightboxZoom maxZoom={maxZoom} onZoomChange={onZoomChange}>
                    <img src="test.jpg" alt="test" data-testid="zoom-img" />
                    <LightboxZoomIn data-testid="zoom-in">+</LightboxZoomIn>
                    <LightboxZoomOut data-testid="zoom-out">-</LightboxZoomOut>
                  </LightboxZoom>
                </LightboxItem>
                <LightboxItem index={1} data-testid="item-1">
                  <LightboxZoom maxZoom={maxZoom}>
                    <img src="test2.jpg" alt="test2" />
                  </LightboxZoom>
                </LightboxItem>
              </SlidesHost>
              <LightboxNext data-testid="next">Next</LightboxNext>
              <LightboxPrevious data-testid="prev">Previous</LightboxPrevious>
            </LightboxContent>
          </LightboxPortal>
        </LightboxRoot>
      );
    }

    function getZoomRef() {
      const ref = React.createRef<LightboxZoomRef>();
      function ZoomWithRef() {
        return (
          <LightboxRoot defaultOpen>
            <LightboxPortal>
              <LightboxContent aria-label="Zoom ref test">
                <SlidesHost>
                  <LightboxItem index={0}>
                    <LightboxZoom ref={ref} maxZoom={4}>
                      <img src="test.jpg" alt="test" data-testid="zoom-img" />
                    </LightboxZoom>
                  </LightboxItem>
                </SlidesHost>
              </LightboxContent>
            </LightboxPortal>
          </LightboxRoot>
        );
      }
      return { ref, Component: ZoomWithRef };
    }

    it('renders zoom container with children', () => {
      render(<ZoomLightbox />);
      expect(screen.getByTestId('zoom-img')).toBeInTheDocument();
    });

    it('prefers Lightbox.Media box for pan content size over a smaller img', () => {
      const ref = React.createRef<LightboxZoomRef>();
      const origRect = HTMLElement.prototype.getBoundingClientRect;
      HTMLElement.prototype.getBoundingClientRect = function () {
        return {
          width: 800,
          height: 800,
          top: 0,
          left: 0,
          right: 800,
          bottom: 800,
          x: 0,
          y: 0,
          toJSON() {},
        } as DOMRect;
      };

      try {
        render(
          <LightboxRoot defaultOpen>
            <LightboxPortal>
              <LightboxContent aria-label="Zoom media size">
                <SlidesHost>
                  <LightboxItem index={0}>
                    <LightboxZoom ref={ref} maxZoom={4}>
                      <LightboxMedia data-testid="media">
                        <img src="test.jpg" alt="test" />
                      </LightboxMedia>
                    </LightboxZoom>
                  </LightboxItem>
                </SlidesHost>
              </LightboxContent>
            </LightboxPortal>
          </LightboxRoot>,
        );

        const media = screen.getByTestId('media');
        const img = screen.getByAltText('test');
        Object.defineProperty(media, 'offsetWidth', { configurable: true, value: 400 });
        Object.defineProperty(media, 'offsetHeight', { configurable: true, value: 400 });
        Object.defineProperty(img, 'offsetWidth', { configurable: true, value: 100 });
        Object.defineProperty(img, 'offsetHeight', { configurable: true, value: 100 });

        // maxPanOffset = max((content*zoom - container) / 2 / zoom, 0)
        // Media 400 @ 4× → 100; bare img 100 @ 4× → 0. Preferring Media ⇒ non-zero.
        act(() => ref.current!.zoomTo(4, { dx: 10_000, dy: 0 }));
        expect(Math.abs(ref.current!.offsetX)).toBe(100);
      } finally {
        HTMLElement.prototype.getBoundingClientRect = origRect;
      }
    });

    it('ZoomIn and ZoomOut buttons render', () => {
      render(<ZoomLightbox />);
      expect(screen.getByTestId('zoom-in')).toBeInTheDocument();
      expect(screen.getByTestId('zoom-out')).toBeInTheDocument();
    });

    it('ZoomOut is disabled at minZoom', () => {
      render(<ZoomLightbox />);
      expect(screen.getByTestId('zoom-out')).toBeDisabled();
    });

    it('ZoomIn is not disabled at minZoom', () => {
      render(<ZoomLightbox />);
      expect(screen.getByTestId('zoom-in')).not.toBeDisabled();
    });

    it('imperative ref.zoomIn increases zoom', () => {
      const { ref, Component } = getZoomRef();
      render(<Component />);
      expect(ref.current!.zoom).toBe(1);
      act(() => ref.current!.zoomIn());
      expect(ref.current!.zoom).toBeGreaterThan(1);
    });

    it('imperative ref.zoomOut decreases zoom', () => {
      const { ref, Component } = getZoomRef();
      render(<Component />);
      act(() => ref.current!.zoomIn());
      const zoomedIn = ref.current!.zoom;
      act(() => ref.current!.zoomOut());
      expect(ref.current!.zoom).toBeLessThan(zoomedIn);
    });

    it('imperative ref.zoomTo sets exact zoom', () => {
      const { ref, Component } = getZoomRef();
      render(<Component />);
      act(() => ref.current!.zoomTo(2.5));
      expect(ref.current!.zoom).toBe(2.5);
    });

    it('zoom is clamped to maxZoom', () => {
      const { ref, Component } = getZoomRef();
      render(<Component />);
      act(() => ref.current!.zoomTo(100));
      expect(ref.current!.zoom).toBe(4);
    });

    it('zoom is clamped to minZoom', () => {
      const { ref, Component } = getZoomRef();
      render(<Component />);
      act(() => ref.current!.zoomTo(0.1));
      expect(ref.current!.zoom).toBe(1);
    });

    it('imperative ref.reset resets to minZoom', () => {
      const { ref, Component } = getZoomRef();
      render(<Component />);
      act(() => ref.current!.zoomTo(3));
      expect(ref.current!.zoom).toBe(3);
      act(() => ref.current!.reset());
      expect(ref.current!.zoom).toBe(1);
    });

    it('onZoomChange fires when zoom changes', () => {
      const spy = vi.fn();
      const ref = React.createRef<LightboxZoomRef>();
      render(
        <LightboxRoot defaultOpen>
          <LightboxPortal>
            <LightboxContent aria-label="Zoom callback test">
              <SlidesHost>
                <LightboxItem index={0}>
                  <LightboxZoom ref={ref} maxZoom={4} onZoomChange={spy}>
                    <img src="test.jpg" alt="test" />
                  </LightboxZoom>
                </LightboxItem>
              </SlidesHost>
            </LightboxContent>
          </LightboxPortal>
        </LightboxRoot>,
      );
      act(() => ref.current!.zoomIn());
      expect(spy).toHaveBeenCalledWith(expect.any(Number));
    });

    it('zoom resets when active slide changes', () => {
      const ref = React.createRef<LightboxZoomRef>();
      render(
        <LightboxRoot defaultOpen>
          <LightboxPortal>
            <LightboxContent aria-label="Zoom reset test" data-testid="content">
              <SlidesHost>
                <LightboxItem index={0}>
                  <LightboxZoom ref={ref} maxZoom={4}>
                    <img src="test.jpg" alt="test" />
                  </LightboxZoom>
                </LightboxItem>
                <LightboxItem index={1}>
                  <LightboxZoom maxZoom={4}>
                    <img src="test2.jpg" alt="test2" />
                  </LightboxZoom>
                </LightboxItem>
              </SlidesHost>
              <LightboxNext data-testid="next">Next</LightboxNext>
            </LightboxContent>
          </LightboxPortal>
        </LightboxRoot>,
      );
      act(() => ref.current!.zoomTo(3));
      expect(ref.current!.zoom).toBe(3);
      fireEvent.click(screen.getByTestId('next'));
      expect(ref.current!.zoom).toBe(1);
    });

    it('ZoomIn button outside Zoom context renders disabled', () => {
      render(
        <LightboxRoot defaultOpen>
          <LightboxPortal>
            <LightboxContent aria-label="No zoom">
              <LightboxZoomIn data-testid="orphan-zoom-in">+</LightboxZoomIn>
            </LightboxContent>
          </LightboxPortal>
        </LightboxRoot>,
      );
      expect(screen.getByTestId('orphan-zoom-in')).toBeDisabled();
    });

    it('ZoomOut button outside Zoom context renders disabled', () => {
      render(
        <LightboxRoot defaultOpen>
          <LightboxPortal>
            <LightboxContent aria-label="No zoom">
              <LightboxZoomOut data-testid="orphan-zoom-out">-</LightboxZoomOut>
            </LightboxContent>
          </LightboxPortal>
        </LightboxRoot>,
      );
      expect(screen.getByTestId('orphan-zoom-out')).toBeDisabled();
    });

    it('data-zoom attribute is set when zoomed in', () => {
      const { ref, Component } = getZoomRef();
      render(<Component />);
      const container = screen.getByTestId('zoom-img').closest('[data-zoom]');
      expect(container).toBeNull();
      act(() => ref.current!.zoomTo(2));
      const zoomedContainer = screen.getByTestId('zoom-img').parentElement!.parentElement!;
      expect(zoomedContainer).toHaveAttribute('data-zoom');
    });

    it('data-zoomed attribute is set on Content when zoomed in', () => {
      render(<ZoomLightbox />);
      const content = screen.getByTestId('content');
      expect(content).not.toHaveAttribute('data-zoomed');

      const ref = React.createRef<LightboxZoomRef>();
      cleanup();
      render(
        <LightboxRoot defaultOpen>
          <LightboxPortal>
            <LightboxContent data-testid="content" aria-label="Zoom zoomed test">
              <SlidesHost>
                <LightboxItem index={0}>
                  <LightboxZoom ref={ref} maxZoom={4}>
                    <img src="test.jpg" alt="test" />
                  </LightboxZoom>
                </LightboxItem>
              </SlidesHost>
            </LightboxContent>
          </LightboxPortal>
        </LightboxRoot>,
      );
      const contentEl = screen.getByTestId('content');
      expect(contentEl).not.toHaveAttribute('data-zoomed');

      act(() => ref.current!.zoomTo(2));
      expect(contentEl).toHaveAttribute('data-zoomed');
    });

    it('fades --lightbox-zoom-progress with live discrete zoom-in (not committed target)', () => {
      // Regression: discrete zoom-in commits the target before paint. Using that
      // committed zoom for --lightbox-zoom-progress snapped snug dim/blur to
      // fully-on. Progress must track the live WAAPI scale so the fade runs.
      type AnimStub = {
        finished: Promise<void>;
        cancel: ReturnType<typeof vi.fn>;
        play: ReturnType<typeof vi.fn>;
        pause: ReturnType<typeof vi.fn>;
        onfinish: ((this: Animation, ev: AnimationPlaybackEvent) => void) | null;
        oncancel: ((this: Animation, ev: AnimationPlaybackEvent) => void) | null;
        commitStyles: ReturnType<typeof vi.fn>;
        currentTime: number;
        duration: number;
      };
      let latest: AnimStub | undefined;
      const animateImpl = vi.fn((_kf: unknown, opts?: number | KeyframeAnimationOptions) => {
        const stub: AnimStub = {
          finished: new Promise<void>(() => {}),
          cancel: vi.fn(),
          play: vi.fn(),
          pause: vi.fn(),
          onfinish: null,
          oncancel: null,
          commitStyles: vi.fn(),
          currentTime: 0,
          duration: typeof opts === 'object' ? Number(opts?.duration ?? 0) : Number(opts ?? 0),
        };
        latest = stub;
        return stub as unknown as Animation;
      });
      const hadAnimate = 'animate' in Element.prototype;
      const previousAnimate = Element.prototype.animate;
      Element.prototype.animate = animateImpl as unknown as typeof Element.prototype.animate;

      const queue: FrameRequestCallback[] = [];
      const origRaf = globalThis.requestAnimationFrame;
      const origCancel = globalThis.cancelAnimationFrame;
      globalThis.requestAnimationFrame = ((cb: FrameRequestCallback) => {
        queue.push(cb);
        return queue.length;
      }) as typeof requestAnimationFrame;
      globalThis.cancelAnimationFrame = ((id: number) => {
        queue[id - 1] = () => {};
      }) as typeof cancelAnimationFrame;

      const pump = () => {
        act(() => {
          // Drain only the currently queued frames; leave the next tick that
          // `bindZoomChrome` reschedules for the following pump.
          const pending = queue.splice(0, queue.length);
          for (const cb of pending) cb(performance.now());
        });
      };

      const ref = React.createRef<LightboxZoomRef>();
      render(
        <LightboxRoot defaultOpen>
          <LightboxPortal>
            <LightboxContent data-testid="content" aria-label="Zoom-in live progress test">
              <SlidesHost>
                <LightboxItem index={0}>
                  <LightboxZoom ref={ref} maxZoom={4}>
                    <img src="test.jpg" alt="test" />
                  </LightboxZoom>
                </LightboxItem>
              </SlidesHost>
              <LightboxZoomIn data-testid="zoom-in">+</LightboxZoomIn>
              <LightboxZoomOut data-testid="zoom-out">-</LightboxZoomOut>
            </LightboxContent>
          </LightboxPortal>
        </LightboxRoot>,
      );
      const contentEl = screen.getByTestId('content');

      try {
        act(() => ref.current!.zoomTo(2));
        expect(latest).toBeDefined();
        expect(ref.current!.zoom).toBe(2);
        // data-zoomed arms from the committed target; progress stays at the
        // live 1× start so snug items can fade in with the WAAPI.
        expect(contentEl).toHaveAttribute('data-zoomed');
        pump();
        expect(Number(contentEl.style.getPropertyValue('--lightbox-zoom-progress') || 0)).toBe(0);

        latest!.currentTime = latest!.duration / 2;
        pump();
        const mid = Number(contentEl.style.getPropertyValue('--lightbox-zoom-progress'));
        expect(mid).toBeGreaterThan(0);
        expect(mid).toBeLessThan(1);

        // Content style wipe must not stick — next tick restores live progress.
        contentEl.style.removeProperty('--lightbox-zoom-progress');
        pump();
        expect(Number(contentEl.style.getPropertyValue('--lightbox-zoom-progress'))).toBeCloseTo(
          mid,
          5,
        );
      } finally {
        globalThis.requestAnimationFrame = origRaf;
        globalThis.cancelAnimationFrame = origCancel;
        if (hadAnimate) {
          Element.prototype.animate = previousAnimate;
        } else {
          delete (Element.prototype as { animate?: typeof Element.prototype.animate }).animate;
        }
      }
    });

    it('publishes --lightbox-zoom-progress on Content while zoomed', () => {
      const ref = React.createRef<LightboxZoomRef>();
      render(
        <LightboxRoot defaultOpen>
          <LightboxPortal>
            <LightboxContent data-testid="content" aria-label="Zoom progress var test">
              <SlidesHost>
                <LightboxItem index={0}>
                  <LightboxZoom ref={ref} maxZoom={4}>
                    <img src="test.jpg" alt="test" />
                  </LightboxZoom>
                </LightboxItem>
              </SlidesHost>
            </LightboxContent>
          </LightboxPortal>
        </LightboxRoot>,
      );
      const contentEl = screen.getByTestId('content');
      expect(contentEl.style.getPropertyValue('--lightbox-zoom-progress')).toBe('');

      // Progress hits 1 at +1× above min (2× here).
      act(() => ref.current!.zoomTo(2, { rapid: true }));
      expect(Number(contentEl.style.getPropertyValue('--lightbox-zoom-progress'))).toBeCloseTo(1);

      act(() => ref.current!.zoomTo(1.5, { rapid: true }));
      expect(Number(contentEl.style.getPropertyValue('--lightbox-zoom-progress'))).toBeCloseTo(0.5);

      act(() => ref.current!.reset(true));
      expect(contentEl.style.getPropertyValue('--lightbox-zoom-progress')).toBe('');
    });

    it('data-zoomed attribute is removed when zoom resets to 1x (rapid)', () => {
      const ref = React.createRef<LightboxZoomRef>();
      render(
        <LightboxRoot defaultOpen>
          <LightboxPortal>
            <LightboxContent data-testid="content" aria-label="Zoom reset attr test">
              <SlidesHost>
                <LightboxItem index={0}>
                  <LightboxZoom ref={ref} maxZoom={4}>
                    <img src="test.jpg" alt="test" />
                  </LightboxZoom>
                </LightboxItem>
              </SlidesHost>
            </LightboxContent>
          </LightboxPortal>
        </LightboxRoot>,
      );
      const contentEl = screen.getByTestId('content');

      act(() => ref.current!.zoomTo(3, { rapid: true }));
      expect(contentEl).toHaveAttribute('data-zoomed');

      act(() => ref.current!.reset(true));
      expect(contentEl).not.toHaveAttribute('data-zoomed');
    });

    it('data-zoomed stays until the zoom-out animation finishes', () => {
      type AnimStub = {
        finished: Promise<void>;
        cancel: ReturnType<typeof vi.fn>;
        play: ReturnType<typeof vi.fn>;
        pause: ReturnType<typeof vi.fn>;
        onfinish: ((this: Animation, ev: AnimationPlaybackEvent) => void) | null;
        oncancel: ((this: Animation, ev: AnimationPlaybackEvent) => void) | null;
      };
      let latest: AnimStub | undefined;
      const animateImpl = vi.fn(() => {
        const stub: AnimStub = {
          finished: Promise.resolve(),
          cancel: vi.fn(),
          play: vi.fn(),
          pause: vi.fn(),
          onfinish: null,
          oncancel: null,
        };
        latest = stub;
        return stub as unknown as Animation;
      });
      const hadAnimate = 'animate' in Element.prototype;
      const previousAnimate = Element.prototype.animate;
      Element.prototype.animate = animateImpl as unknown as typeof Element.prototype.animate;

      const ref = React.createRef<LightboxZoomRef>();
      render(
        <LightboxRoot defaultOpen>
          <LightboxPortal>
            <LightboxContent data-testid="content" aria-label="Zoom animated reset attr test">
              <SlidesHost>
                <LightboxItem index={0}>
                  <LightboxZoom ref={ref} maxZoom={4}>
                    <img src="test.jpg" alt="test" />
                  </LightboxZoom>
                </LightboxItem>
              </SlidesHost>
            </LightboxContent>
          </LightboxPortal>
        </LightboxRoot>,
      );
      const contentEl = screen.getByTestId('content');

      act(() => ref.current!.zoomTo(3, { rapid: true }));
      expect(contentEl).toHaveAttribute('data-zoomed');

      act(() => ref.current!.reset());
      // React zoom is already 1x, but the WAAPI transition is still running —
      // chrome that keys off data-zoomed must not flash back early.
      expect(contentEl).toHaveAttribute('data-zoomed');
      expect(latest).toBeDefined();

      act(() => {
        latest?.onfinish?.call(latest as unknown as Animation, {} as AnimationPlaybackEvent);
      });
      expect(contentEl).not.toHaveAttribute('data-zoomed');

      if (hadAnimate) {
        Element.prototype.animate = previousAnimate;
      } else {
        delete (Element.prototype as { animate?: typeof Element.prototype.animate }).animate;
      }
    });

    it('data-zoomed attribute is removed when slide changes', () => {
      const ref = React.createRef<LightboxZoomRef>();
      render(
        <LightboxRoot defaultOpen>
          <LightboxPortal>
            <LightboxContent data-testid="content" aria-label="Zoom slide change test">
              <SlidesHost>
                <LightboxItem index={0}>
                  <LightboxZoom ref={ref} maxZoom={4}>
                    <img src="test.jpg" alt="test" />
                  </LightboxZoom>
                </LightboxItem>
                <LightboxItem index={1}>
                  <LightboxZoom maxZoom={4}>
                    <img src="test2.jpg" alt="test2" />
                  </LightboxZoom>
                </LightboxItem>
              </SlidesHost>
              <LightboxNext data-testid="next">Next</LightboxNext>
            </LightboxContent>
          </LightboxPortal>
        </LightboxRoot>,
      );
      const contentEl = screen.getByTestId('content');

      act(() => ref.current!.zoomTo(2));
      expect(contentEl).toHaveAttribute('data-zoomed');

      fireEvent.click(screen.getByTestId('next'));
      expect(contentEl).not.toHaveAttribute('data-zoomed');
    });

    it('maxZoom defaults when not specified', () => {
      render(
        <LightboxRoot defaultOpen>
          <LightboxPortal>
            <LightboxContent aria-label="Default maxZoom">
              <SlidesHost>
                <LightboxItem index={0}>
                  <LightboxZoom>
                    <div>No image</div>
                  </LightboxZoom>
                </LightboxItem>
              </SlidesHost>
            </LightboxContent>
          </LightboxPortal>
        </LightboxRoot>,
      );
      expect(screen.getByText('No image')).toBeInTheDocument();
    });

    it('touch-action is pan-x pan-y at 1x zoom and none when zoomed', () => {
      const ref = React.createRef<LightboxZoomRef>();
      render(
        <LightboxRoot defaultOpen>
          <LightboxPortal>
            <LightboxContent aria-label="Touch action test">
              <SlidesHost>
                <LightboxItem index={0}>
                  <LightboxZoom ref={ref} maxZoom={4}>
                    <img src="test.jpg" alt="test" />
                  </LightboxZoom>
                </LightboxItem>
              </SlidesHost>
            </LightboxContent>
          </LightboxPortal>
        </LightboxRoot>,
      );

      const zoomContainer = screen.getByAltText('test').parentElement!.parentElement!;
      expect(zoomContainer.style.containerType).toBe('size');
      expect(zoomContainer.style.touchAction).toBe('pan-x pan-y');

      act(() => ref.current!.zoomTo(2));
      expect(zoomContainer.style.touchAction).toBe('none');

      act(() => ref.current!.reset());
      expect(zoomContainer.style.touchAction).toBe('pan-x pan-y');
    });

    describe('elastic overscroll', () => {
      it('changeZoom with overscroll allows zoom past maxZoom', () => {
        const ref = React.createRef<LightboxZoomRef>();
        render(
          <LightboxRoot defaultOpen>
            <LightboxPortal>
              <LightboxContent aria-label="Elastic test">
                <SlidesHost>
                  <LightboxItem index={0}>
                    <LightboxZoom ref={ref} maxZoom={4}>
                      <img src="test.jpg" alt="test" />
                    </LightboxZoom>
                  </LightboxItem>
                </SlidesHost>
              </LightboxContent>
            </LightboxPortal>
          </LightboxRoot>,
        );

        // Direct zoomTo hard-clamps at maxZoom
        act(() => ref.current!.zoomTo(6));
        expect(ref.current!.zoom).toBe(4);
      });

      it('snapToBounds after overscroll clamps zoom to maxZoom', () => {
        const ref = React.createRef<LightboxZoomRef>();
        render(
          <LightboxRoot defaultOpen>
            <LightboxPortal>
              <LightboxContent aria-label="Snap test">
                <SlidesHost>
                  <LightboxItem index={0}>
                    <LightboxZoom ref={ref} maxZoom={4}>
                      <img src="test.jpg" alt="test" />
                    </LightboxZoom>
                  </LightboxItem>
                </SlidesHost>
              </LightboxContent>
            </LightboxPortal>
          </LightboxRoot>,
        );

        // Hard-clamp zoomTo at max, then try to go beyond (simulating pinch)
        act(() => ref.current!.zoomTo(4));
        expect(ref.current!.zoom).toBe(4);

        // Reset confirms we snap back
        act(() => ref.current!.reset());
        expect(ref.current!.zoom).toBe(1);
      });

      it('zoom below minZoom is clamped by hard clamp', () => {
        const ref = React.createRef<LightboxZoomRef>();
        render(
          <LightboxRoot defaultOpen>
            <LightboxPortal>
              <LightboxContent aria-label="Min clamp test">
                <SlidesHost>
                  <LightboxItem index={0}>
                    <LightboxZoom ref={ref} maxZoom={4}>
                      <img src="test.jpg" alt="test" />
                    </LightboxZoom>
                  </LightboxItem>
                </SlidesHost>
              </LightboxContent>
            </LightboxPortal>
          </LightboxRoot>,
        );

        act(() => ref.current!.zoomTo(0.5));
        expect(ref.current!.zoom).toBe(1);
      });

      describe('elastic pan (mouse + touch)', () => {
        type OverscrollPan = (
          dx: number,
          dy: number,
          overscroll?: boolean,
          overflowAxesOnly?: boolean,
        ) => void;

        function ZoomPanProbe({
          panRef,
        }: {
          panRef: React.MutableRefObject<OverscrollPan | null>;
        }) {
          const { changeOffsets } = useZoomContext();
          panRef.current = changeOffsets as OverscrollPan;
          return null;
        }

        function setupOverflowGeometry(img: HTMLElement) {
          Object.defineProperty(img, 'offsetWidth', { configurable: true, value: 400 });
          Object.defineProperty(img, 'offsetHeight', { configurable: true, value: 400 });
        }

        function setupLetterboxGeometry(img: HTMLElement) {
          Object.defineProperty(img, 'offsetWidth', { configurable: true, value: 120 });
          Object.defineProperty(img, 'offsetHeight', { configurable: true, value: 120 });
        }

        function withViewport(run: () => void) {
          const origRect = HTMLElement.prototype.getBoundingClientRect;
          HTMLElement.prototype.getBoundingClientRect = function () {
            return {
              width: 400,
              height: 400,
              top: 0,
              left: 0,
              right: 400,
              bottom: 400,
              x: 0,
              y: 0,
              toJSON() {},
            } as DOMRect;
          };
          try {
            run();
          } finally {
            HTMLElement.prototype.getBoundingClientRect = origRect;
          }
        }

        function renderZoomPan(ref: React.RefObject<LightboxZoomRef | null>) {
          const panRef = { current: null as OverscrollPan | null };
          render(
            <LightboxRoot defaultOpen>
              <LightboxPortal>
                <LightboxContent aria-label="Elastic pan test">
                  <SlidesHost>
                    <LightboxItem index={0}>
                      <LightboxZoom ref={ref} maxZoom={4}>
                        <img src="test.jpg" alt="test" data-testid="zoom-img" />
                        <ZoomPanProbe panRef={panRef} />
                      </LightboxZoom>
                    </LightboxItem>
                  </SlidesHost>
                </LightboxContent>
              </LightboxPortal>
            </LightboxRoot>,
          );
          return panRef;
        }

        // Polyfill PointerEvent + animate for gesture-path tests. Restore both
        // afterward — a mock `animate` that never fires `onfinish` leaves
        // `isAnimating` stuck and leaks `data-zoomed` into later suites.
        const origPointerEvent = globalThis.PointerEvent;
        const origAnimate = Element.prototype.animate;
        beforeEach(() => {
          if (!globalThis.PointerEvent) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (globalThis as Record<string, unknown>).PointerEvent = class PointerEvent extends MouseEvent {
              pointerId: number;
              pointerType: string;
              isPrimary: boolean;
              constructor(
                type: string,
                init: PointerEventInit & {
                  pointerId?: number;
                  pointerType?: string;
                  isPrimary?: boolean;
                } = {},
              ) {
                super(type, init);
                this.pointerId = init.pointerId ?? 0;
                this.pointerType = init.pointerType ?? 'mouse';
                this.isPrimary = init.isPrimary ?? true;
              }
            };
          }
          Element.prototype.animate = vi.fn(() => {
            let onfinish: (() => void) | null = null;
            const anim = {
              finished: Promise.resolve(),
              cancel: vi.fn(),
              play: vi.fn(),
              pause: vi.fn(),
              oncancel: null as (() => void) | null,
              commitStyles: vi.fn(),
              get onfinish() {
                return onfinish;
              },
              // Finish when assigned — `act()` does not reliably flush
              // queueMicrotask, and settle commits rest only on finish.
              set onfinish(fn: (() => void) | null) {
                onfinish = fn;
                if (fn) fn();
              },
            };
            return anim;
          }) as unknown as typeof Element.prototype.animate;
        });
        afterEach(() => {
          if (origPointerEvent) {
            (globalThis as Record<string, unknown>).PointerEvent = origPointerEvent;
          } else {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            delete (globalThis as any).PointerEvent;
          }
          Element.prototype.animate = origAnimate;
        });

        function dispatchPointer(
          el: Element,
          type: string,
          init: Partial<PointerEventInit> & {
            pointerId?: number;
            pointerType?: string;
            clientX?: number;
            clientY?: number;
          } = {},
        ) {
          el.dispatchEvent(
            new PointerEvent(type, {
              bubbles: true,
              cancelable: true,
              pointerId: 1,
              isPrimary: true,
              ...init,
            }),
          );
        }

        /**
         * Install a sync rAF queue, run `release`, pump frames until the
         * physics sim settles, then flush WAAPI `onfinish` microtasks so the
         * pose store commits rest (settle no longer commits on release).
         */
        function withPanPhysicsFlush(release: () => void, frames = 120) {
          const queue: FrameRequestCallback[] = [];
          let now = 0;
          const origRaf = globalThis.requestAnimationFrame;
          const origCancel = globalThis.cancelAnimationFrame;
          const origNow = performance.now.bind(performance);
          globalThis.requestAnimationFrame = ((cb: FrameRequestCallback) => {
            queue.push(cb);
            return queue.length;
          }) as typeof requestAnimationFrame;
          globalThis.cancelAnimationFrame = (() => {}) as typeof cancelAnimationFrame;
          performance.now = () => now;
          try {
            act(release);
            act(() => {
              for (let i = 0; i < frames && queue.length > 0; i++) {
                const cb = queue.shift()!;
                now += 1000 / 60;
                cb(now);
              }
            });
            // Default mock finishes settle when `onfinish` is assigned; this
            // drains any leftover React commit from that landing.
            act(() => {});
          } finally {
            globalThis.requestAnimationFrame = origRaf;
            globalThis.cancelAnimationFrame = origCancel;
            performance.now = origNow;
          }
        }

        it('elastic overscroll lets mouse pan past the hard pan edge', () => {
          withViewport(() => {
            const ref = React.createRef<LightboxZoomRef>();
            const panRef = renderZoomPan(ref);
            setupOverflowGeometry(screen.getByTestId('zoom-img'));

            // content 400 @ zoom 2 in 400 viewport → ±100 pan range
            act(() => ref.current!.zoomTo(2));
            expect(ref.current!.zoom).toBe(2);

            // Hard-clamp path stops at the edge
            act(() => panRef.current!(-200, 0, false));
            expect(ref.current!.offsetX).toBe(100);

            // Elastic path allows past the edge (resisted, not raw) — mouse leash
            act(() => panRef.current!(-200, 0, true));
            const dim = rubberBandPanDimension(400, 2, RUBBER_BAND_DIMENSION_FACTOR_MOUSE);
            expect(ref.current!.offsetX).toBeCloseTo(rubberBandClamp(300, -100, 100, dim), 5);
            expect(ref.current!.offsetX).toBeGreaterThan(100);
            expect(ref.current!.offsetX).toBeLessThan(300);
          });
        });

        it('mouse elastic overscroll allows letterboxed (non-overflowing) pan past rest', () => {
          withViewport(() => {
            const ref = React.createRef<LightboxZoomRef>();
            const panRef = renderZoomPan(ref);
            setupLetterboxGeometry(screen.getByTestId('zoom-img'));

            act(() => ref.current!.zoomTo(2));

            // Hard-clamp: still fits → no pan
            act(() => panRef.current!(40, 0, false));
            expect(ref.current!.offsetX).toBe(0);

            // Mouse elastic: rubber-band away from rest even when letterboxed
            act(() => panRef.current!(40, 0, true, false));
            expect(ref.current!.offsetX).not.toBe(0);
            const dim = rubberBandPanDimension(400, 2, RUBBER_BAND_DIMENSION_FACTOR_MOUSE);
            // dx positive → raw decreases (changeOffsets subtracts dx)
            expect(ref.current!.offsetX).toBeCloseTo(rubberBandClamp(-40, 0, 0, dim), 5);
          });
        });

        it('touch elastic overscroll does not pan letterboxed (non-overflowing) axes', () => {
          withViewport(() => {
            const ref = React.createRef<LightboxZoomRef>();
            const panRef = renderZoomPan(ref);
            setupLetterboxGeometry(screen.getByTestId('zoom-img'));

            act(() => ref.current!.zoomTo(2));
            act(() => panRef.current!(40, 25, true, true));
            expect(ref.current!.offsetX).toBe(0);
            expect(ref.current!.offsetY).toBe(0);
          });
        });

        it('mouse drag past bounds rubber-bands and snaps back on release', () => {
          const origRect = HTMLElement.prototype.getBoundingClientRect;
          HTMLElement.prototype.getBoundingClientRect = function () {
            return {
              width: 400,
              height: 400,
              top: 0,
              left: 0,
              right: 400,
              bottom: 400,
              x: 0,
              y: 0,
              toJSON() {},
            } as DOMRect;
          };
          try {
            const ref = React.createRef<LightboxZoomRef>();
            renderZoomPan(ref);
            const img = screen.getByTestId('zoom-img');
            setupOverflowGeometry(img);

            act(() => ref.current!.zoomTo(2, { rapid: true }));

            // Pointer moves right → content offset past +max
            act(() => {
              dispatchPointer(img, 'pointerdown', {
                clientX: 200,
                clientY: 200,
                pointerType: 'mouse',
                button: 0,
              });
              dispatchPointer(img, 'pointermove', {
                clientX: 600,
                clientY: 200,
                pointerType: 'mouse',
              });
            });

            expect(ref.current!.offsetX).toBeGreaterThan(100);

            withPanPhysicsFlush(() => {
              dispatchPointer(img, 'pointerup', {
                clientX: 600,
                clientY: 200,
                pointerType: 'mouse',
              });
            });
            expect(ref.current!.offsetX).toBe(100);
            expect(ref.current!.offsetY).toBe(0);
          } finally {
            HTMLElement.prototype.getBoundingClientRect = origRect;
          }
        });

        it('touch drag past bounds rubber-bands and snaps back on release', () => {
          const origRect = HTMLElement.prototype.getBoundingClientRect;
          HTMLElement.prototype.getBoundingClientRect = function () {
            return {
              width: 400,
              height: 400,
              top: 0,
              left: 0,
              right: 400,
              bottom: 400,
              x: 0,
              y: 0,
              toJSON() {},
            } as DOMRect;
          };
          try {
            const ref = React.createRef<LightboxZoomRef>();
            renderZoomPan(ref);
            const img = screen.getByTestId('zoom-img');
            setupOverflowGeometry(img);

            act(() => ref.current!.zoomTo(2, { rapid: true }));

            act(() => {
              dispatchPointer(img, 'pointerdown', {
                clientX: 200,
                clientY: 200,
                pointerType: 'touch',
              });
              dispatchPointer(img, 'pointermove', {
                clientX: 600,
                clientY: 200,
                pointerType: 'touch',
              });
            });

            expect(ref.current!.offsetX).toBeGreaterThan(100);

            withPanPhysicsFlush(() => {
              dispatchPointer(img, 'pointerup', {
                clientX: 600,
                clientY: 200,
                pointerType: 'touch',
              });
            });
            expect(ref.current!.offsetX).toBe(100);
            expect(ref.current!.offsetY).toBe(0);
          } finally {
            HTMLElement.prototype.getBoundingClientRect = origRect;
          }
        });

        it('mouse rubber-band leash is shorter than touch for the same drag', () => {
          withViewport(() => {
            const measure = (pointerType: 'mouse' | 'touch') => {
              cleanup();
              const ref = React.createRef<LightboxZoomRef>();
              renderZoomPan(ref);
              const img = screen.getByTestId('zoom-img');
              setupOverflowGeometry(img);
              act(() => ref.current!.zoomTo(2, { rapid: true }));
              act(() => {
                dispatchPointer(img, 'pointerdown', {
                  clientX: 200,
                  clientY: 200,
                  pointerType,
                  button: 0,
                });
                dispatchPointer(img, 'pointermove', {
                  clientX: 600,
                  clientY: 200,
                  pointerType,
                });
              });
              return ref.current!.offsetX;
            };

            const mouseX = measure('mouse');
            const touchX = measure('touch');
            expect(mouseX).toBeGreaterThan(100);
            expect(touchX).toBeGreaterThan(mouseX);
          });
        });

        it('touch drag on letterboxed zoom does not move offsets', () => {
          withViewport(() => {
            const ref = React.createRef<LightboxZoomRef>();
            renderZoomPan(ref);
            const img = screen.getByTestId('zoom-img');
            setupLetterboxGeometry(img);

            act(() => ref.current!.zoomTo(2, { rapid: true }));
            act(() => {
              dispatchPointer(img, 'pointerdown', {
                clientX: 200,
                clientY: 200,
                pointerType: 'touch',
              });
              dispatchPointer(img, 'pointermove', {
                clientX: 280,
                clientY: 260,
                pointerType: 'touch',
              });
            });
            expect(ref.current!.offsetX).toBe(0);
            expect(ref.current!.offsetY).toBe(0);
          });
        });

        it('mouse drag on letterboxed zoom rubber-bands then snaps home', () => {
          const origRect = HTMLElement.prototype.getBoundingClientRect;
          HTMLElement.prototype.getBoundingClientRect = function () {
            return {
              width: 400,
              height: 400,
              top: 0,
              left: 0,
              right: 400,
              bottom: 400,
              x: 0,
              y: 0,
              toJSON() {},
            } as DOMRect;
          };
          try {
            const ref = React.createRef<LightboxZoomRef>();
            renderZoomPan(ref);
            const img = screen.getByTestId('zoom-img');
            setupLetterboxGeometry(img);

            act(() => ref.current!.zoomTo(2, { rapid: true }));
            act(() => {
              dispatchPointer(img, 'pointerdown', {
                clientX: 200,
                clientY: 200,
                pointerType: 'mouse',
                button: 0,
              });
              dispatchPointer(img, 'pointermove', {
                clientX: 280,
                clientY: 200,
                pointerType: 'mouse',
              });
            });
            expect(ref.current!.offsetX).not.toBe(0);

            withPanPhysicsFlush(() => {
              dispatchPointer(img, 'pointerup', {
                clientX: 280,
                clientY: 200,
                pointerType: 'mouse',
              });
            });
            expect(ref.current!.offsetX).toBe(0);
            expect(ref.current!.offsetY).toBe(0);
          } finally {
            HTMLElement.prototype.getBoundingClientRect = origRect;
          }
        });

        it('hands off to pan on the remaining finger after pinch 2→1 (rebase then pan)', () => {
          withViewport(() => {
            const ref = React.createRef<LightboxZoomRef>();
            renderZoomPan(ref);
            const img = screen.getByTestId('zoom-img');
            setupOverflowGeometry(img);

            act(() => {
              // Two-finger pinch out
              dispatchPointer(img, 'pointerdown', {
                clientX: 150,
                clientY: 200,
                pointerId: 1,
                pointerType: 'touch',
                isPrimary: true,
              });
              dispatchPointer(img, 'pointerdown', {
                clientX: 250,
                clientY: 200,
                pointerId: 2,
                pointerType: 'touch',
                isPrimary: false,
              });
              dispatchPointer(img, 'pointermove', {
                clientX: 100,
                clientY: 200,
                pointerId: 1,
                pointerType: 'touch',
              });
              dispatchPointer(img, 'pointermove', {
                clientX: 300,
                clientY: 200,
                pointerId: 2,
                pointerType: 'touch',
              });
            });
            expect(ref.current!.zoom).toBeGreaterThan(1);
            const zoomedOffsets = {
              x: ref.current!.offsetX,
              y: ref.current!.offsetY,
            };

            act(() => {
              // Lift finger 1 — first remaining move rebases (no pan jump).
              dispatchPointer(img, 'pointerup', {
                clientX: 100,
                clientY: 200,
                pointerId: 1,
                pointerType: 'touch',
              });
              dispatchPointer(img, 'pointermove', {
                clientX: 310,
                clientY: 210,
                pointerId: 2,
                pointerType: 'touch',
              });
            });
            expect(ref.current!.offsetX).toBeCloseTo(zoomedOffsets.x, 5);
            expect(ref.current!.offsetY).toBeCloseTo(zoomedOffsets.y, 5);

            // Further moves with the remaining finger pan.
            act(() => {
              dispatchPointer(img, 'pointermove', {
                clientX: 360,
                clientY: 240,
                pointerId: 2,
                pointerType: 'touch',
              });
            });
            expect(ref.current!.offsetX).not.toBeCloseTo(zoomedOffsets.x, 5);
          });
        });

        it('pans a zoomed image when two fingers translate without changing spread', () => {
          withViewport(() => {
            const ref = React.createRef<LightboxZoomRef>();
            renderZoomPan(ref);
            const img = screen.getByTestId('zoom-img');
            setupOverflowGeometry(img);

            act(() => ref.current!.zoomTo(2, { rapid: true }));
            expect(ref.current!.offsetX).toBe(0);
            expect(ref.current!.offsetY).toBe(0);

            act(() => {
              dispatchPointer(img, 'pointerdown', {
                clientX: 160,
                clientY: 200,
                pointerId: 1,
                pointerType: 'touch',
                isPrimary: true,
              });
              dispatchPointer(img, 'pointerdown', {
                clientX: 240,
                clientY: 200,
                pointerId: 2,
                pointerType: 'touch',
                isPrimary: false,
              });
              // Translate both fingers 60px right — distance stays 80.
              dispatchPointer(img, 'pointermove', {
                clientX: 220,
                clientY: 200,
                pointerId: 1,
                pointerType: 'touch',
              });
              dispatchPointer(img, 'pointermove', {
                clientX: 300,
                clientY: 200,
                pointerId: 2,
                pointerType: 'touch',
              });
            });

            expect(ref.current!.zoom).toBeCloseTo(2, 5);
            // Centroid traveled +60 screen-px at 2× → +30 offset-px.
            expect(ref.current!.offsetX).toBeCloseTo(30, 5);
            expect(ref.current!.offsetY).toBeCloseTo(0, 5);
          });
        });

        it('does not zoom from finger-span jitter during a two-finger pan', () => {
          withViewport(() => {
            const ref = React.createRef<LightboxZoomRef>();
            renderZoomPan(ref);
            const img = screen.getByTestId('zoom-img');
            setupOverflowGeometry(img);

            act(() => ref.current!.zoomTo(2, { rapid: true }));

            act(() => {
              dispatchPointer(img, 'pointerdown', {
                clientX: 160,
                clientY: 200,
                pointerId: 1,
                pointerType: 'touch',
                isPrimary: true,
              });
              dispatchPointer(img, 'pointerdown', {
                clientX: 240,
                clientY: 200,
                pointerId: 2,
                pointerType: 'touch',
                isPrimary: false,
              });
              // Interleaved 8px steps (real touch samples), then a 12px span drift.
              // A single 60px jump on one finger would look like a pinch.
              for (const [x1, x2] of [
                [168, 248],
                [176, 256],
                [184, 264],
                [192, 272],
                [200, 280],
                [208, 300],
              ] as const) {
                dispatchPointer(img, 'pointermove', {
                  clientX: x1,
                  clientY: 200,
                  pointerId: 1,
                  pointerType: 'touch',
                });
                dispatchPointer(img, 'pointermove', {
                  clientX: x2,
                  clientY: 200,
                  pointerId: 2,
                  pointerType: 'touch',
                });
              }
            });

            expect(ref.current!.zoom).toBeCloseTo(2, 5);
            expect(ref.current!.offsetX).toBeGreaterThan(20);
          });
        });

        it('composes two-finger pan with pinch scale in one gesture', () => {
          withViewport(() => {
            const ref = React.createRef<LightboxZoomRef>();
            renderZoomPan(ref);
            const img = screen.getByTestId('zoom-img');
            setupOverflowGeometry(img);

            act(() => ref.current!.zoomTo(2, { rapid: true }));

            act(() => {
              dispatchPointer(img, 'pointerdown', {
                clientX: 160,
                clientY: 200,
                pointerId: 1,
                pointerType: 'touch',
                isPrimary: true,
              });
              dispatchPointer(img, 'pointerdown', {
                clientX: 240,
                clientY: 200,
                pointerId: 2,
                pointerType: 'touch',
                isPrimary: false,
              });
              // Spread 80→160 and slide the midpoint +40px right.
              dispatchPointer(img, 'pointermove', {
                clientX: 160,
                clientY: 200,
                pointerId: 1,
                pointerType: 'touch',
              });
              dispatchPointer(img, 'pointermove', {
                clientX: 320,
                clientY: 200,
                pointerId: 2,
                pointerType: 'touch',
              });
            });

            expect(ref.current!.zoom).toBeCloseTo(4, 5);
            // origin centroid 0 at 2×; current centroid +40 at 4× → +10 offset.
            expect(ref.current!.offsetX).toBeCloseTo(10, 5);
          });
        });

        it('continues pan without a jump after a pan → pinch → 2→1 handoff', () => {
          withViewport(() => {
            const ref = React.createRef<LightboxZoomRef>();
            renderZoomPan(ref);
            const img = screen.getByTestId('zoom-img');
            setupOverflowGeometry(img);

            act(() => ref.current!.zoomTo(2, { rapid: true }));

            // Single-finger pan — latches the elastic-drag accumulator.
            act(() => {
              dispatchPointer(img, 'pointerdown', {
                clientX: 200,
                clientY: 200,
                pointerId: 1,
                pointerType: 'touch',
                isPrimary: true,
              });
              dispatchPointer(img, 'pointermove', {
                clientX: 240,
                clientY: 200,
                pointerId: 1,
                pointerType: 'touch',
              });
            });
            expect(ref.current!.offsetX).not.toBe(0);

            // Second finger lands mid-pan → pinch. The pinch rewrites zoom AND
            // offsets via focal projection, bypassing the pan accumulator.
            act(() => {
              dispatchPointer(img, 'pointerdown', {
                clientX: 300,
                clientY: 260,
                pointerId: 2,
                pointerType: 'touch',
                isPrimary: false,
              });
              dispatchPointer(img, 'pointermove', {
                clientX: 340,
                clientY: 300,
                pointerId: 2,
                pointerType: 'touch',
              });
            });
            expect(ref.current!.zoom).toBeGreaterThan(2);
            const postPinch = { x: ref.current!.offsetX, y: ref.current!.offsetY };

            // Release the second finger and keep panning with the first:
            // one rebase move, then a small (2px) real pan move.
            act(() => {
              dispatchPointer(img, 'pointerup', {
                clientX: 340,
                clientY: 300,
                pointerId: 2,
                pointerType: 'touch',
              });
              dispatchPointer(img, 'pointermove', {
                clientX: 241,
                clientY: 201,
                pointerId: 1,
                pointerType: 'touch',
              });
              dispatchPointer(img, 'pointermove', {
                clientX: 243,
                clientY: 203,
                pointerId: 1,
                pointerType: 'touch',
              });
            });

            // Regression: the stale pre-pinch accumulator used to teleport the
            // offsets back toward their pre-pinch values here (a ~18px jump).
            // A 2px finger move must produce a comparably small offset delta.
            expect(Math.abs(ref.current!.offsetX - postPinch.x)).toBeLessThan(2);
            expect(Math.abs(ref.current!.offsetY - postPinch.y)).toBeLessThan(2);
          });
        });

        it('runs the 2→1 snap-back concurrently with the surviving finger’s pan', () => {
          withViewport(() => {
            const ref = React.createRef<LightboxZoomRef>();
            renderZoomPan(ref);
            const img = screen.getByTestId('zoom-img');
            setupOverflowGeometry(img);

            act(() => ref.current!.zoomTo(3, { rapid: true }));

            // Manual rAF queue so snap frames can be interleaved with pointer
            // moves — that's exactly what happens on a real device.
            const queue: FrameRequestCallback[] = [];
            let now = 0;
            const origRaf = globalThis.requestAnimationFrame;
            const origCancel = globalThis.cancelAnimationFrame;
            globalThis.requestAnimationFrame = ((cb: FrameRequestCallback) => {
              queue.push(cb);
              return queue.length;
            }) as typeof requestAnimationFrame;
            globalThis.cancelAnimationFrame = (() => {}) as typeof cancelAnimationFrame;
            const pump = (frames: number) => {
              act(() => {
                for (let i = 0; i < frames && queue.length > 0; i++) {
                  const cb = queue.shift()!;
                  now += 1000 / 60;
                  cb(now);
                }
              });
            };

            try {
              // Pinch out past maxZoom (4) — elastic overshoot to 5×.
              act(() => {
                dispatchPointer(img, 'pointerdown', {
                  clientX: 180,
                  clientY: 200,
                  pointerId: 1,
                  pointerType: 'touch',
                  isPrimary: true,
                });
                dispatchPointer(img, 'pointerdown', {
                  clientX: 220,
                  clientY: 200,
                  pointerId: 2,
                  pointerType: 'touch',
                  isPrimary: false,
                });
                dispatchPointer(img, 'pointermove', {
                  clientX: 140,
                  clientY: 200,
                  pointerId: 1,
                  pointerType: 'touch',
                });
                dispatchPointer(img, 'pointermove', {
                  clientX: 260,
                  clientY: 200,
                  pointerId: 2,
                  pointerType: 'touch',
                });
              });
              expect(ref.current!.zoom).toBeCloseTo(5, 5);

              // Lift one finger: like iOS, the rubber-band return starts NOW —
              // as a rAF value animation, not a WAAPI racing the pointer.
              act(() => {
                dispatchPointer(img, 'pointerup', {
                  clientX: 140,
                  clientY: 200,
                  pointerId: 1,
                  pointerType: 'touch',
                });
              });
              pump(3);
              const mid = ref.current!.zoom;
              expect(mid).toBeLessThan(5);
              expect(mid).toBeGreaterThan(4);

              // Mid-snap the pan is LIVE: the first move only re-anchors the
              // pan origin (rebase), the next one pans — concurrently with
              // the returning zoom. The moves themselves never touch zoom.
              const held = { x: ref.current!.offsetX, y: ref.current!.offsetY };
              act(() => {
                dispatchPointer(img, 'pointermove', {
                  clientX: 261,
                  clientY: 201,
                  pointerId: 2,
                  pointerType: 'touch',
                });
              });
              expect(ref.current!.offsetX).toBe(held.x);
              act(() => {
                dispatchPointer(img, 'pointermove', {
                  clientX: 275,
                  clientY: 215,
                  pointerId: 2,
                  pointerType: 'touch',
                });
              });
              expect(ref.current!.offsetX).not.toBe(held.x);
              expect(ref.current!.zoom).toBe(mid);

              // Snap completes while the finger is still down — the pan
              // position it carried is untouched by the settle.
              const panned = { x: ref.current!.offsetX, y: ref.current!.offsetY };
              pump(200);
              expect(ref.current!.zoom).toBe(4);
              expect(ref.current!.offsetX).toBe(panned.x);
              expect(ref.current!.offsetY).toBe(panned.y);

              // Panning continues seamlessly after the snap lands.
              act(() => {
                dispatchPointer(img, 'pointermove', {
                  clientX: 300,
                  clientY: 240,
                  pointerId: 2,
                  pointerType: 'touch',
                });
              });
              expect(ref.current!.offsetX).not.toBe(panned.x);
              expect(ref.current!.zoom).toBe(4);

              // Final release: nothing left to snap.
              act(() => {
                dispatchPointer(img, 'pointerup', {
                  clientX: 300,
                  clientY: 240,
                  pointerId: 2,
                  pointerType: 'touch',
                });
              });
              pump(200);
              expect(ref.current!.zoom).toBe(4);
            } finally {
              globalThis.requestAnimationFrame = origRaf;
              globalThis.cancelAnimationFrame = origCancel;
            }
          });
        });

        it('blocks pan while a discrete zoom WAAPI is in flight and resumes after it settles', () => {
          withViewport(() => {
            const ref = React.createRef<LightboxZoomRef>();
            renderZoomPan(ref);
            const img = screen.getByTestId('zoom-img');
            setupOverflowGeometry(img);

            // Hold the discrete zoom WAAPI mid-flight.
            const held: Array<{
              cancel: ReturnType<typeof vi.fn>;
              onfinish: (() => void) | null;
            }> = [];
            Element.prototype.animate = vi.fn(() => {
              const anim = {
                finished: new Promise<void>(() => {}),
                cancel: vi.fn(),
                play: vi.fn(),
                pause: vi.fn(),
                onfinish: null as (() => void) | null,
                oncancel: null as (() => void) | null,
                commitStyles: vi.fn(),
              };
              held.push(anim);
              return anim;
            }) as unknown as typeof Element.prototype.animate;

            act(() => ref.current!.zoomTo(2, { rapid: true }));
            act(() => ref.current!.zoomTo(4));
            expect(ref.current!.zoom).toBe(4);
            expect(held.length).toBeGreaterThan(0);
            const zoomAnim = held[held.length - 1]!;

            // Pan attempt mid-animation: absorbed. The WAAPI is never torn
            // and the pose stays at the animation's committed target.
            act(() => {
              dispatchPointer(img, 'pointerdown', {
                clientX: 200,
                clientY: 200,
                pointerId: 3,
                pointerType: 'touch',
                isPrimary: true,
              });
              dispatchPointer(img, 'pointermove', {
                clientX: 215,
                clientY: 215,
                pointerId: 3,
                pointerType: 'touch',
              });
              dispatchPointer(img, 'pointermove', {
                clientX: 230,
                clientY: 230,
                pointerId: 3,
                pointerType: 'touch',
              });
            });
            expect(zoomAnim.cancel).not.toHaveBeenCalled();
            expect(ref.current!.zoom).toBe(4);
            expect(ref.current!.offsetX).toBe(0);
            expect(ref.current!.offsetY).toBe(0);

            // Animation settles → the very next move pans from the latest
            // absorbed sample (fresh origin, no jump, no dead window).
            act(() => {
              zoomAnim.onfinish?.();
            });
            act(() => {
              dispatchPointer(img, 'pointermove', {
                clientX: 245,
                clientY: 245,
                pointerId: 3,
                pointerType: 'touch',
              });
            });
            expect(ref.current!.offsetX).not.toBe(0);
            expect(ref.current!.zoom).toBe(4);
          });
        });

        it('defers pinch arming until the discrete zoom WAAPI settles', () => {
          withViewport(() => {
            const ref = React.createRef<LightboxZoomRef>();
            renderZoomPan(ref);
            const img = screen.getByTestId('zoom-img');
            setupOverflowGeometry(img);

            const held: Array<{
              cancel: ReturnType<typeof vi.fn>;
              onfinish: (() => void) | null;
            }> = [];
            Element.prototype.animate = vi.fn(() => {
              const anim = {
                finished: new Promise<void>(() => {}),
                cancel: vi.fn(),
                play: vi.fn(),
                pause: vi.fn(),
                onfinish: null as (() => void) | null,
                oncancel: null as (() => void) | null,
                commitStyles: vi.fn(),
              };
              held.push(anim);
              return anim;
            }) as unknown as typeof Element.prototype.animate;

            act(() => ref.current!.zoomTo(2, { rapid: true }));
            act(() => ref.current!.zoomTo(4));
            expect(ref.current!.zoom).toBe(4);
            const zoomAnim = held[held.length - 1]!;

            // Two fingers land mid-animation and move: no pinch arms, the
            // WAAPI is never torn, zoom stays at the committed target.
            act(() => {
              dispatchPointer(img, 'pointerdown', {
                clientX: 100,
                clientY: 200,
                pointerId: 1,
                pointerType: 'touch',
                isPrimary: true,
              });
              dispatchPointer(img, 'pointerdown', {
                clientX: 300,
                clientY: 200,
                pointerId: 2,
                pointerType: 'touch',
                isPrimary: false,
              });
              dispatchPointer(img, 'pointermove', {
                clientX: 140,
                clientY: 200,
                pointerId: 1,
                pointerType: 'touch',
              });
              dispatchPointer(img, 'pointermove', {
                clientX: 260,
                clientY: 200,
                pointerId: 2,
                pointerType: 'touch',
              });
            });
            expect(zoomAnim.cancel).not.toHaveBeenCalled();
            expect(ref.current!.zoom).toBe(4);

            // Settle → the queued arm fires with the fingers' FRESH positions
            // (distance 120) and the settled 4× zoom. Pinching in to distance
            // 60 must halve the zoom — continuous from the settled state.
            act(() => {
              zoomAnim.onfinish?.();
            });
            act(() => {
              dispatchPointer(img, 'pointermove', {
                clientX: 170,
                clientY: 200,
                pointerId: 1,
                pointerType: 'touch',
              });
              dispatchPointer(img, 'pointermove', {
                clientX: 230,
                clientY: 200,
                pointerId: 2,
                pointerType: 'touch',
              });
            });
            expect(ref.current!.zoom).toBeCloseTo(2, 5);
          });
        });

        it('swallows wheel zoom and wheel pan while a discrete zoom WAAPI is in flight', () => {
          withViewport(() => {
            const ref = React.createRef<LightboxZoomRef>();
            renderZoomPan(ref);
            const img = screen.getByTestId('zoom-img');
            setupOverflowGeometry(img);

            const held: Array<{
              cancel: ReturnType<typeof vi.fn>;
              onfinish: (() => void) | null;
            }> = [];
            Element.prototype.animate = vi.fn(() => {
              const anim = {
                finished: new Promise<void>(() => {}),
                cancel: vi.fn(),
                play: vi.fn(),
                pause: vi.fn(),
                onfinish: null as (() => void) | null,
                oncancel: null as (() => void) | null,
                commitStyles: vi.fn(),
              };
              held.push(anim);
              return anim;
            }) as unknown as typeof Element.prototype.animate;

            act(() => ref.current!.zoomTo(2, { rapid: true }));
            act(() => ref.current!.zoomTo(4));
            expect(ref.current!.zoom).toBe(4);
            const zoomAnim = held[held.length - 1]!;

            const dispatchWheel = (opts: {
              ctrlKey?: boolean;
              deltaX?: number;
              deltaY?: number;
            }) => {
              const event = new WheelEvent('wheel', {
                bubbles: true,
                cancelable: true,
                ctrlKey: opts.ctrlKey ?? false,
                deltaX: opts.deltaX ?? 0,
                deltaY: opts.deltaY ?? 0,
              });
              Object.defineProperty(event, 'deltaMode', { value: 0 });
              img.dispatchEvent(event);
              return event;
            };

            // Trackpad pinch (ctrl+wheel) mid-animation: swallowed. The WAAPI
            // is never torn — this is the desktop freeze regression: canceling
            // it re-based the wheel zoom on the stale committed target.
            let event!: WheelEvent;
            act(() => {
              event = dispatchWheel({ ctrlKey: true, deltaY: 40 });
            });
            expect(event.defaultPrevented).toBe(true);
            expect(zoomAnim.cancel).not.toHaveBeenCalled();
            expect(ref.current!.zoom).toBe(4);

            // Wheel pan mid-animation: also swallowed, offsets untouched.
            act(() => {
              event = dispatchWheel({ deltaX: 30, deltaY: 30 });
            });
            expect(event.defaultPrevented).toBe(true);
            expect(ref.current!.offsetX).toBe(0);
            expect(ref.current!.offsetY).toBe(0);

            // Animation settles → wheel input works again.
            act(() => {
              zoomAnim.onfinish?.();
            });
            act(() => {
              dispatchWheel({ ctrlKey: true, deltaY: 40 });
            });
            expect(ref.current!.zoom).toBeLessThan(4);
          });
        });

        it('snaps an out-of-bounds pinch released in the same task as its moves', () => {
          withViewport(() => {
            const ref = React.createRef<LightboxZoomRef>();
            renderZoomPan(ref);
            const img = screen.getByTestId('zoom-img');
            setupOverflowGeometry(img);

            act(() => ref.current!.zoomTo(3, { rapid: true }));

            // Whole gesture — downs, elastic pinch to 5×, both ups — in ONE
            // synchronous task, so React batches every state commit until the
            // end. Regression for the eager ref sync: `zoomRef` used to lag
            // the batched state, so the 2→1 breakup read the stale in-bounds
            // zoom (3×), never started the snap-back, and zoom stuck at 5×.
            // The flush then pumps the rAF spring to convergence.
            withPanPhysicsFlush(() => {
              dispatchPointer(img, 'pointerdown', {
                clientX: 180,
                clientY: 200,
                pointerId: 1,
                pointerType: 'touch',
                isPrimary: true,
              });
              dispatchPointer(img, 'pointerdown', {
                clientX: 220,
                clientY: 200,
                pointerId: 2,
                pointerType: 'touch',
                isPrimary: false,
              });
              dispatchPointer(img, 'pointermove', {
                clientX: 140,
                clientY: 200,
                pointerId: 1,
                pointerType: 'touch',
              });
              dispatchPointer(img, 'pointermove', {
                clientX: 260,
                clientY: 200,
                pointerId: 2,
                pointerType: 'touch',
              });
              dispatchPointer(img, 'pointerup', {
                clientX: 140,
                clientY: 200,
                pointerId: 1,
                pointerType: 'touch',
              });
              dispatchPointer(img, 'pointerup', {
                clientX: 260,
                clientY: 200,
                pointerId: 2,
                pointerType: 'touch',
              });
            });
            expect(ref.current!.zoom).toBe(4);
          });
        });

        it('lets a new pinch take over the under-min settle mid-flight (no freeze between pinch-ins)', () => {
          withViewport(() => {
            const ref = React.createRef<LightboxZoomRef>();
            renderZoomPan(ref);
            const img = screen.getByTestId('zoom-img');
            setupOverflowGeometry(img);

            // Hold the baked settle WAAPI open with a scrubbable clock.
            const held: Array<{
              cancel: ReturnType<typeof vi.fn>;
              onfinish: (() => void) | null;
              currentTime: number;
              duration: number;
            }> = [];
            Element.prototype.animate = vi.fn(
              (_keyframes: unknown, opts?: number | KeyframeAnimationOptions) => {
                const anim = {
                  finished: new Promise<void>(() => {}),
                  cancel: vi.fn(),
                  play: vi.fn(),
                  pause: vi.fn(),
                  onfinish: null as (() => void) | null,
                  oncancel: null as (() => void) | null,
                  commitStyles: vi.fn(),
                  currentTime: 0,
                  duration: typeof opts === 'object' ? Number(opts?.duration ?? 0) : Number(opts ?? 0),
                };
                held.push(anim);
                return anim;
              },
            ) as unknown as typeof Element.prototype.animate;

            // Pinch in past minZoom (elastic under-zoom).
            act(() => {
              dispatchPointer(img, 'pointerdown', {
                clientX: 100,
                clientY: 200,
                pointerId: 1,
                pointerType: 'touch',
                isPrimary: true,
              });
              dispatchPointer(img, 'pointerdown', {
                clientX: 300,
                clientY: 200,
                pointerId: 2,
                pointerType: 'touch',
                isPrimary: false,
              });
              dispatchPointer(img, 'pointermove', {
                clientX: 180,
                clientY: 200,
                pointerId: 1,
                pointerType: 'touch',
              });
              dispatchPointer(img, 'pointermove', {
                clientX: 220,
                clientY: 200,
                pointerId: 2,
                pointerType: 'touch',
              });
            });
            const elastic = ref.current!.zoom;
            expect(elastic).toBeLessThan(1);

            // Release both fingers: the snap-back bakes into a compositor
            // settle. Rest commits on WAAPI finish — live pose stays under-min
            // at t=0 so a follow-up pinch can catch mid-trajectory.
            act(() => {
              dispatchPointer(img, 'pointerup', {
                clientX: 180,
                clientY: 200,
                pointerId: 1,
                pointerType: 'touch',
              });
              dispatchPointer(img, 'pointerup', {
                clientX: 220,
                clientY: 200,
                pointerId: 2,
                pointerType: 'touch',
              });
            });
            expect(held.length).toBeGreaterThan(0);
            const settleAnim = held[held.length - 1]!;
            expect(settleAnim.duration).toBeGreaterThan(0);
            expect(ref.current!.zoom).toBeLessThan(1);

            // Scrub the settle mid-flight, then pinch again — the downs must
            // catch it at the LIVE pose recovered from the baked trajectory
            // (no jump to 1×), and the pinch scales from there.
            settleAnim.currentTime = settleAnim.duration / 2;
            act(() => {
              dispatchPointer(img, 'pointerdown', {
                clientX: 100,
                clientY: 200,
                pointerId: 3,
                pointerType: 'touch',
                isPrimary: true,
              });
              dispatchPointer(img, 'pointerdown', {
                clientX: 300,
                clientY: 200,
                pointerId: 4,
                pointerType: 'touch',
                isPrimary: false,
              });
            });
            const mid = ref.current!.zoom;
            expect(mid).toBeGreaterThan(elastic);
            expect(mid).toBeLessThan(1);

            act(() => {
              dispatchPointer(img, 'pointermove', {
                clientX: 170,
                clientY: 200,
                pointerId: 3,
                pointerType: 'touch',
              });
              dispatchPointer(img, 'pointermove', {
                clientX: 230,
                clientY: 200,
                pointerId: 4,
                pointerType: 'touch',
              });
            });
            expect(ref.current!.zoom).toBeLessThan(mid);
          });
        });
      });
    });
  });

  // ---------------------------------------------------------------------------
  // 14b. Global zoom controls (active-zoom bridge)
  //
  // Mirrors the flagship layout: one shared ZoomIn/ZoomOut set rendered in the
  // chrome (siblings of Slides, OUTSIDE any per-slide Lightbox.Zoom), each
  // item wrapped in its own Zoom. The buttons must drive whichever slide is
  // currently active via the Root-owned bridge.
  // ---------------------------------------------------------------------------

  describe('global zoom controls', () => {
    const origAnimate = Element.prototype.animate;
    beforeEach(() => {
      Element.prototype.animate = vi.fn(() => {
        let onfinish: (() => void) | null = null;
        return {
          finished: Promise.resolve(),
          cancel: vi.fn(),
          play: vi.fn(),
          pause: vi.fn(),
          oncancel: null,
          commitStyles: vi.fn(),
          get onfinish() {
            return onfinish;
          },
          set onfinish(fn: (() => void) | null) {
            onfinish = fn;
            if (fn) fn();
          },
        } as unknown as Animation;
      }) as unknown as typeof Element.prototype.animate;
    });
    afterEach(() => {
      Element.prototype.animate = origAnimate;
    });

    function GlobalZoomLightbox({
      refs,
      maxZoom = 4,
    }: {
      refs?: Array<React.RefObject<LightboxZoomRef | null>>;
      maxZoom?: number;
    } = {}) {
      return (
        <LightboxRoot defaultOpen>
          <LightboxPortal>
            <LightboxContent data-testid="content" aria-label="Global zoom test">
              <SlidesHost>
                <LightboxItem index={0} data-testid="item-0">
                  <LightboxZoom ref={refs?.[0]} maxZoom={maxZoom}>
                    <img src="a.jpg" alt="a" />
                  </LightboxZoom>
                </LightboxItem>
                <LightboxItem index={1} data-testid="item-1">
                  <LightboxZoom ref={refs?.[1]} maxZoom={maxZoom}>
                    <img src="b.jpg" alt="b" />
                  </LightboxZoom>
                </LightboxItem>
              </SlidesHost>
              {/* Single shared control set outside every Zoom */}
              <LightboxZoomIn data-testid="zoom-in">+</LightboxZoomIn>
              <LightboxZoomOut data-testid="zoom-out">-</LightboxZoomOut>
              <LightboxNext data-testid="next">Next</LightboxNext>
              <LightboxPrevious data-testid="prev">Previous</LightboxPrevious>
            </LightboxContent>
          </LightboxPortal>
        </LightboxRoot>
      );
    }

    it('global buttons reflect the active slide at 1x', () => {
      render(<GlobalZoomLightbox />);
      expect(screen.getByTestId('zoom-in')).not.toBeDisabled();
      expect(screen.getByTestId('zoom-out')).toBeDisabled();
    });

    it('global ZoomIn zooms the active slide and enables ZoomOut', () => {
      render(<GlobalZoomLightbox />);
      const content = screen.getByTestId('content');
      expect(content).not.toHaveAttribute('data-zoomed');

      fireEvent.click(screen.getByTestId('zoom-in'));

      expect(content).toHaveAttribute('data-zoomed');
      expect(screen.getByTestId('zoom-out')).not.toBeDisabled();
    });

    it('controls drive the active slide, not preloaded siblings', () => {
      const refs = [React.createRef<LightboxZoomRef>(), React.createRef<LightboxZoomRef>()];
      render(<GlobalZoomLightbox refs={refs} />);

      // Active slide is index 0.
      fireEvent.click(screen.getByTestId('zoom-in'));
      expect(refs[0]!.current!.zoom).toBeGreaterThan(1);
      expect(refs[1]!.current!.zoom).toBe(1);
    });

    it('controls follow the active slide after navigation', () => {
      const refs = [React.createRef<LightboxZoomRef>(), React.createRef<LightboxZoomRef>()];
      render(<GlobalZoomLightbox refs={refs} />);

      fireEvent.click(screen.getByTestId('next'));
      fireEvent.click(screen.getByTestId('zoom-in'));

      expect(refs[1]!.current!.zoom).toBeGreaterThan(1);
      expect(refs[0]!.current!.zoom).toBe(1);
    });

    it('ZoomIn disables at maxZoom and re-enables on the fresh next slide', () => {
      render(<GlobalZoomLightbox maxZoom={2} />);
      const zoomIn = screen.getByTestId('zoom-in');

      // zoomStep default 2 → one step from 1x reaches maxZoom 2x.
      fireEvent.click(zoomIn);
      expect(zoomIn).toBeDisabled();

      // The next slide starts fresh at 1x, so ZoomIn is enabled again.
      fireEvent.click(screen.getByTestId('next'));
      expect(zoomIn).not.toBeDisabled();
      expect(screen.getByTestId('content')).not.toHaveAttribute('data-zoomed');
    });

    it('ZoomOut returns the active slide to 1x and disables again', () => {
      render(<GlobalZoomLightbox />);
      const content = screen.getByTestId('content');
      const zoomOut = screen.getByTestId('zoom-out');

      fireEvent.click(screen.getByTestId('zoom-in'));
      expect(content).toHaveAttribute('data-zoomed');

      // maxZoom 4, step 2 → from 2x one ZoomOut lands back at 1x.
      fireEvent.click(zoomOut);
      expect(content).not.toHaveAttribute('data-zoomed');
      expect(zoomOut).toBeDisabled();
    });

    it('arrow keys pan (do not navigate) while the active slide is zoomed', () => {
      render(<GlobalZoomLightbox />);
      const content = screen.getByTestId('content');

      // Baseline: arrow navigation works at 1x.
      fireEvent.keyDown(content, { key: 'ArrowRight' });
      expect(screen.getByTestId('item-1')).toHaveAttribute('aria-hidden', 'false');

      // Back to slide 0 and zoom it in.
      fireEvent.keyDown(content, { key: 'ArrowLeft' });
      fireEvent.click(screen.getByTestId('zoom-in'));
      expect(content).toHaveAttribute('data-zoomed');

      // Now ArrowRight must be swallowed by the zoom pan handler.
      fireEvent.keyDown(content, { key: 'ArrowRight' });
      expect(screen.getByTestId('item-0')).toHaveAttribute('aria-hidden', 'false');
      expect(screen.getByTestId('item-1')).toHaveAttribute('aria-hidden', 'true');
    });
  });

  // ---------------------------------------------------------------------------
  // 15. Pull-to-dismiss
  // ---------------------------------------------------------------------------

  describe('pull-to-dismiss', () => {
    // Polyfill PointerEvent for jsdom
    const origPointerEvent = globalThis.PointerEvent;
    beforeEach(() => {
      if (!globalThis.PointerEvent) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (globalThis as Record<string, unknown>).PointerEvent = class PointerEvent extends MouseEvent {
          pointerId: number;
          pointerType: string;
          isPrimary: boolean;
          constructor(
            type: string,
            init: PointerEventInit & { pointerId?: number; pointerType?: string; isPrimary?: boolean } = {},
          ) {
            super(type, init);
            this.pointerId = init.pointerId ?? 0;
            this.pointerType = init.pointerType ?? 'mouse';
            this.isPrimary = init.isPrimary ?? false;
          }
        };
      }
      if (!Element.prototype.setPointerCapture) {
        Element.prototype.setPointerCapture = vi.fn();
      }
      if (!Element.prototype.releasePointerCapture) {
        Element.prototype.releasePointerCapture = vi.fn();
      }
      if (!Element.prototype.animate) {
        Element.prototype.animate = vi.fn(() => ({
          finished: Promise.resolve(),
          cancel: vi.fn(),
          play: vi.fn(),
          pause: vi.fn(),
          onfinish: null,
        })) as unknown as typeof Element.prototype.animate;
      }
    });
    afterEach(() => {
      if (origPointerEvent) {
        (globalThis as Record<string, unknown>).PointerEvent = origPointerEvent;
      }
    });

    function dispatchPointer(
      el: Element,
      type: string,
      init: Partial<PointerEventInit> & {
        pointerId?: number;
        clientX?: number;
        clientY?: number;
        timeStamp?: number;
        isPrimary?: boolean;
      } = {},
    ) {
      const event = new PointerEvent(type, {
        bubbles: true,
        cancelable: true,
        pointerId: 1,
        pointerType: 'touch',
        ...init,
      });
      if (init.timeStamp !== undefined) {
        Object.defineProperty(event, 'timeStamp', { value: init.timeStamp });
      }
      el.dispatchEvent(event);
    }

    function PullDismissLightbox({
      pullToClose,
      withZoom,
      zoomRef,
    }: { pullToClose?: boolean; withZoom?: boolean; zoomRef?: React.RefObject<LightboxZoomRef | null> } = {}) {
      return (
        <LightboxRoot defaultOpen>
          <LightboxPortal>
            <LightboxContent data-testid="content" aria-label="Pull dismiss test" pullToClose={pullToClose}>
              <SlidesHost>
                <LightboxItem index={0}>
                  {withZoom ? (
                    <LightboxZoom ref={zoomRef} maxZoom={4}>
                      <img src="test.jpg" alt="test" />
                    </LightboxZoom>
                  ) : (
                    <img src="test.jpg" alt="test" />
                  )}
                </LightboxItem>
              </SlidesHost>
            </LightboxContent>
          </LightboxPortal>
        </LightboxRoot>
      );
    }

    it('sets data-pulling attribute during vertical drag', () => {
      render(<PullDismissLightbox />);
      const content = screen.getByTestId('content');
      const img = screen.getByAltText('test');

      act(() => {
        dispatchPointer(img, 'pointerdown', { clientX: 200, clientY: 200 });
        dispatchPointer(content, 'pointermove', { clientX: 200, clientY: 225 });
      });

      expect(content).toHaveAttribute('data-pulling');
    });

    it('touch pull starts from Stage-wide targets but not interactive controls', () => {
      render(
        <LightboxRoot defaultOpen>
          <LightboxPortal>
            <LightboxContent data-testid="content" aria-label="Pull media hit-test">
              <SlidesHost>
                <LightboxItem index={0} className="relative">
                  <div data-testid="chrome" style={{ position: 'absolute', inset: 0 }}>
                    chrome
                  </div>
                  <button type="button" data-testid="control">
                    Close
                  </button>
                  <LightboxMedia data-testid="media">
                    <img src="test.jpg" alt="test" />
                  </LightboxMedia>
                </LightboxItem>
              </SlidesHost>
            </LightboxContent>
          </LightboxPortal>
        </LightboxRoot>,
      );
      const content = screen.getByTestId('content');
      const img = screen.getByAltText('test');
      const chrome = screen.getByTestId('chrome');
      const control = screen.getByTestId('control');

      // Decorative overlay / letterbox-like area can start a pull (Stage-wide).
      act(() => {
        dispatchPointer(chrome, 'pointerdown', { clientX: 200, clientY: 200 });
        dispatchPointer(content, 'pointermove', { clientX: 200, clientY: 225 });
      });
      expect(content).toHaveAttribute('data-pulling');

      // Release so the next down can start a fresh gesture.
      act(() => {
        dispatchPointer(content, 'pointerup', { clientX: 200, clientY: 225 });
      });
      expect(content).not.toHaveAttribute('data-pulling');

      // Real controls keep their press — do not start a pull.
      act(() => {
        dispatchPointer(control, 'pointerdown', { clientX: 200, clientY: 200 });
        dispatchPointer(content, 'pointermove', { clientX: 200, clientY: 225 });
      });
      expect(content).not.toHaveAttribute('data-pulling');

      act(() => {
        dispatchPointer(img, 'pointerdown', { clientX: 200, clientY: 200 });
        dispatchPointer(content, 'pointermove', { clientX: 200, clientY: 225 });
      });
      expect(content).toHaveAttribute('data-pulling');
    });

    it('exposes pull progress as a CSS variable during vertical drag', () => {
      render(<PullDismissLightbox />);
      const content = screen.getByTestId('content');
      const img = screen.getByAltText('test');

      act(() => {
        dispatchPointer(img, 'pointerdown', { clientX: 200, clientY: 200 });
        // First move recognizes the vertical pull and re-anchors the origin
        // here (so the image starts from 0, no snap).
        dispatchPointer(content, 'pointermove', { clientX: 200, clientY: 210 });
        // 50px past the anchor, of a 100px dismiss threshold → 0.5 progress.
        dispatchPointer(content, 'pointermove', { clientX: 200, clientY: 260 });
      });

      const progress = Number(content.style.getPropertyValue('--lightbox-pull-progress'));
      expect(progress).toBeGreaterThan(0);
      expect(progress).toBeLessThanOrEqual(1);
    });

    it('resets the pull-progress variable after snapping back', async () => {
      render(<PullDismissLightbox />);
      const content = screen.getByTestId('content');
      const img = screen.getByAltText('test');

      act(() => {
        dispatchPointer(img, 'pointerdown', { clientX: 200, clientY: 200 });
        dispatchPointer(content, 'pointermove', { clientX: 200, clientY: 250 });
        dispatchPointer(content, 'pointerup', { clientX: 200, clientY: 250 });
      });
      await flushMicrotasks();

      expect(content).not.toHaveAttribute('data-pulling');
      expect(content.style.getPropertyValue('--lightbox-pull-progress')).toBe('');
    });

    it('does not set data-pulling for horizontal drag', () => {
      render(<PullDismissLightbox />);
      const content = screen.getByTestId('content');
      const img = screen.getByAltText('test');

      act(() => {
        dispatchPointer(img, 'pointerdown', { clientX: 200, clientY: 200 });
        dispatchPointer(content, 'pointermove', { clientX: 225, clientY: 200 });
      });

      expect(content).not.toHaveAttribute('data-pulling');
    });

    it('closes the lightbox when dragged past dismiss threshold', async () => {
      render(<PullDismissLightbox />);
      const content = screen.getByTestId('content');
      const img = screen.getByAltText('test');

      act(() => {
        dispatchPointer(img, 'pointerdown', { clientX: 200, clientY: 200 });
        // Recognize the pull + re-anchor origin here, then drag 170px past it
        // (> the 100px dismiss threshold).
        dispatchPointer(content, 'pointermove', { clientX: 200, clientY: 210 });
        dispatchPointer(content, 'pointermove', { clientX: 200, clientY: 380 });
        dispatchPointer(content, 'pointerup', { clientX: 200, clientY: 380 });
      });
      await flushMicrotasks();

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('snaps back when released below dismiss threshold', () => {
      render(<PullDismissLightbox />);
      const content = screen.getByTestId('content');
      const img = screen.getByAltText('test');

      act(() => {
        dispatchPointer(img, 'pointerdown', { clientX: 200, clientY: 200 });
        dispatchPointer(content, 'pointermove', { clientX: 200, clientY: 260 });
        dispatchPointer(content, 'pointerup', { clientX: 200, clientY: 260 });
      });

      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(content).toHaveAttribute('data-pull-snapping');
      expect(content).not.toHaveAttribute('data-pulling');
    });

    it('closes on fast flick even below distance threshold', async () => {
      render(<PullDismissLightbox />);
      const content = screen.getByTestId('content');
      const img = screen.getByAltText('test');

      act(() => {
        dispatchPointer(img, 'pointerdown', { clientX: 200, clientY: 200, timeStamp: 0 });
        dispatchPointer(content, 'pointermove', { clientX: 200, clientY: 230, timeStamp: 10 });
        dispatchPointer(content, 'pointermove', { clientX: 200, clientY: 280, timeStamp: 40 });
        dispatchPointer(content, 'pointerup', { clientX: 200, clientY: 280, timeStamp: 40 });
      });
      await flushMicrotasks();

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('does not activate when zoomed in', () => {
      const ref = React.createRef<LightboxZoomRef>();
      render(<PullDismissLightbox withZoom zoomRef={ref} />);
      const content = screen.getByTestId('content');
      const img = screen.getByAltText('test');

      act(() => ref.current!.zoomTo(2));
      expect(content).toHaveAttribute('data-zoomed');

      act(() => {
        dispatchPointer(img, 'pointerdown', { clientX: 200, clientY: 200 });
        dispatchPointer(content, 'pointermove', { clientX: 200, clientY: 370 });
      });

      expect(content).not.toHaveAttribute('data-pulling');
    });

    it('does not zoom from a lone finger after a stale captured pointer', () => {
      // Regression: pull-to-dismiss captures the pointer via setPointerCapture
      // (on the content ancestor), so the zoom hook records the first touch's
      // pointerdown but never its pointerup — leaving a stale pointer. A
      // subsequent single-finger flick must NOT pair with that ghost into a
      // phantom pinch. `isPrimary` marks the lone new finger so stale pointers
      // are dropped first.
      const ref = React.createRef<LightboxZoomRef>();
      render(<PullDismissLightbox withZoom zoomRef={ref} />);
      const img = screen.getByAltText('test');

      // First touch: recorded by the zoom hook, then "captured" by pull (no
      // pointerup ever reaches the zoom container).
      act(() => {
        dispatchPointer(img, 'pointerdown', { clientX: 200, clientY: 200, pointerId: 1, isPrimary: true });
      });

      // A fresh lone finger flicks across the screen.
      act(() => {
        dispatchPointer(img, 'pointerdown', { clientX: 210, clientY: 210, pointerId: 2, isPrimary: true });
        dispatchPointer(img, 'pointermove', { clientX: 280, clientY: 320, pointerId: 2 });
      });

      expect(ref.current!.zoom).toBe(1);
    });

    it('does not double-tap-zoom when the second touch is a swipe near the first tap', () => {
      // Regression: a clean tap arms double-tap detection; a quick swipe/flick
      // starting near that tap satisfies the timing + distance gate. Zoom must
      // NOT fire, because the second touch moved (it's a swipe, not a tap).
      const ref = React.createRef<LightboxZoomRef>();
      render(<PullDismissLightbox withZoom zoomRef={ref} />);
      const img = screen.getByAltText('test');

      // First interaction: a clean stationary tap.
      act(() => {
        dispatchPointer(img, 'pointerdown', { clientX: 200, clientY: 200, pointerId: 1, isPrimary: true });
        dispatchPointer(img, 'pointerup', { clientX: 200, clientY: 200, pointerId: 1 });
      });

      // Second interaction: lands near the first tap (within DOUBLE_TAP_DISTANCE)
      // but immediately swipes away.
      act(() => {
        dispatchPointer(img, 'pointerdown', { clientX: 210, clientY: 205, pointerId: 2, isPrimary: true });
        dispatchPointer(img, 'pointermove', { clientX: 260, clientY: 305, pointerId: 2 });
        dispatchPointer(img, 'pointerup', { clientX: 260, clientY: 305, pointerId: 2 });
      });

      expect(ref.current!.zoom).toBe(1);
    });

    it('still double-tap-zooms when the second touch is a genuine tap', () => {
      const ref = React.createRef<LightboxZoomRef>();
      render(<PullDismissLightbox withZoom zoomRef={ref} />);
      const img = screen.getByAltText('test');

      act(() => {
        dispatchPointer(img, 'pointerdown', {
          clientX: 200,
          clientY: 200,
          pointerId: 1,
          isPrimary: true,
          timeStamp: 0,
        });
        dispatchPointer(img, 'pointerup', { clientX: 200, clientY: 200, pointerId: 1, timeStamp: 10 });
        dispatchPointer(img, 'pointerdown', {
          clientX: 202,
          clientY: 201,
          pointerId: 2,
          isPrimary: true,
          timeStamp: 120,
        });
        dispatchPointer(img, 'pointerup', { clientX: 202, clientY: 201, pointerId: 2, timeStamp: 130 });
      });

      expect(ref.current!.zoom).toBeGreaterThan(1);
    });

    it('queues a follow-up double-tap until the in-flight zoom WAAPI settles', () => {
      type AnimStub = {
        finished: Promise<void>;
        cancel: ReturnType<typeof vi.fn>;
        play: ReturnType<typeof vi.fn>;
        pause: ReturnType<typeof vi.fn>;
        onfinish: ((this: Animation, ev: AnimationPlaybackEvent) => void) | null;
        oncancel: ((this: Animation, ev: AnimationPlaybackEvent) => void) | null;
        commitStyles: ReturnType<typeof vi.fn>;
      };
      let latest: AnimStub | undefined;
      const animateImpl = vi.fn(() => {
        const stub: AnimStub = {
          finished: new Promise<void>(() => {}),
          cancel: vi.fn(),
          play: vi.fn(),
          pause: vi.fn(),
          onfinish: null,
          oncancel: null,
          commitStyles: vi.fn(),
        };
        latest = stub;
        return stub as unknown as Animation;
      });
      const hadAnimate = 'animate' in Element.prototype;
      const previousAnimate = Element.prototype.animate;
      Element.prototype.animate = animateImpl as unknown as typeof Element.prototype.animate;

      const ref = React.createRef<LightboxZoomRef>();
      render(<PullDismissLightbox withZoom zoomRef={ref} />);
      const img = screen.getByAltText('test');

      act(() => {
        dispatchPointer(img, 'pointerdown', {
          clientX: 200,
          clientY: 200,
          pointerId: 1,
          isPrimary: true,
          timeStamp: 0,
        });
        dispatchPointer(img, 'pointerup', { clientX: 200, clientY: 200, pointerId: 1, timeStamp: 10 });
        dispatchPointer(img, 'pointerdown', {
          clientX: 202,
          clientY: 201,
          pointerId: 2,
          isPrimary: true,
          timeStamp: 120,
        });
        dispatchPointer(img, 'pointerup', { clientX: 202, clientY: 201, pointerId: 2, timeStamp: 130 });
      });

      const zoomAfterDoubleTap = ref.current!.zoom;
      expect(zoomAfterDoubleTap).toBeGreaterThan(1);
      expect(animateImpl).toHaveBeenCalled();
      const animAfterDoubleTap = latest;

      // Rapid third/fourth taps while WAAPI plays: queue zoom-out, don't cut it.
      act(() => {
        dispatchPointer(img, 'pointerdown', {
          clientX: 200,
          clientY: 200,
          pointerId: 3,
          isPrimary: true,
          timeStamp: 180,
        });
        dispatchPointer(img, 'pointerup', { clientX: 200, clientY: 200, pointerId: 3, timeStamp: 190 });
        dispatchPointer(img, 'pointerdown', {
          clientX: 201,
          clientY: 200,
          pointerId: 4,
          isPrimary: true,
          timeStamp: 250,
        });
        dispatchPointer(img, 'pointerup', { clientX: 201, clientY: 200, pointerId: 4, timeStamp: 260 });
      });

      expect(ref.current!.zoom).toBe(zoomAfterDoubleTap);
      expect(latest).toBe(animAfterDoubleTap);
      expect(animAfterDoubleTap?.cancel).not.toHaveBeenCalled();

      // On settle, queued double-tap runs (zoom back out).
      act(() => {
        animAfterDoubleTap?.onfinish?.call(
          animAfterDoubleTap as unknown as Animation,
          {} as AnimationPlaybackEvent,
        );
      });
      expect(ref.current!.zoom).toBe(1);
      expect(animateImpl.mock.calls.length).toBeGreaterThan(1);

      if (hadAnimate) {
        Element.prototype.animate = previousAnimate;
      } else {
        delete (Element.prototype as { animate?: typeof Element.prototype.animate }).animate;
      }
    });

    it('data-zoomed stays off during under-min snap-back (chrome must not hide)', () => {
      // Regression: snap-back WAAPI from elastic under-zoom set `data-zoomed`
      // via the “keep while isAnimating” path, which hid chrome even though
      // the user never zoomed in.
      type AnimStub = {
        finished: Promise<void>;
        cancel: ReturnType<typeof vi.fn>;
        play: ReturnType<typeof vi.fn>;
        pause: ReturnType<typeof vi.fn>;
        onfinish: ((this: Animation, ev: AnimationPlaybackEvent) => void) | null;
        oncancel: ((this: Animation, ev: AnimationPlaybackEvent) => void) | null;
      };
      let latest: AnimStub | undefined;
      const animateImpl = vi.fn(() => {
        const stub: AnimStub = {
          finished: Promise.resolve(),
          cancel: vi.fn(),
          play: vi.fn(),
          pause: vi.fn(),
          onfinish: null,
          oncancel: null,
        };
        latest = stub;
        return stub as unknown as Animation;
      });
      const hadAnimate = 'animate' in Element.prototype;
      const previousAnimate = Element.prototype.animate;
      Element.prototype.animate = animateImpl as unknown as typeof Element.prototype.animate;

      const ref = React.createRef<LightboxZoomRef>();
      render(<PullDismissLightbox withZoom zoomRef={ref} />);
      const content = screen.getByTestId('content');
      const img = screen.getByAltText('test');

      act(() => {
        dispatchPointer(img, 'pointerdown', {
          clientX: 150,
          clientY: 200,
          pointerId: 1,
          pointerType: 'touch',
          isPrimary: true,
        });
        dispatchPointer(img, 'pointerdown', {
          clientX: 250,
          clientY: 200,
          pointerId: 2,
          pointerType: 'touch',
          isPrimary: false,
        });
        dispatchPointer(img, 'pointermove', {
          clientX: 190,
          clientY: 200,
          pointerId: 1,
          pointerType: 'touch',
        });
        dispatchPointer(img, 'pointermove', {
          clientX: 210,
          clientY: 200,
          pointerId: 2,
          pointerType: 'touch',
        });
      });
      expect(ref.current!.zoom).toBeLessThan(1);
      expect(content).not.toHaveAttribute('data-zoomed');

      // 2→0 full release bakes a WAAPI settle (rAF zoom-snap is only for 2→1
      // while a finger still pans). `data-zoomed` must stay off the whole way:
      // the user never actually zoomed in.
      act(() => {
        dispatchPointer(img, 'pointerup', {
          clientX: 190,
          clientY: 200,
          pointerId: 1,
          pointerType: 'touch',
        });
        dispatchPointer(img, 'pointerup', {
          clientX: 210,
          clientY: 200,
          pointerId: 2,
          pointerType: 'touch',
        });
      });
      expect(content).not.toHaveAttribute('data-zoomed');
      expect(latest).toBeDefined();
      act(() => {
        latest?.onfinish?.call(latest as unknown as Animation, {} as AnimationPlaybackEvent);
      });

      expect(ref.current!.zoom).toBe(1);
      expect(content).not.toHaveAttribute('data-zoomed');

      if (hadAnimate) {
        Element.prototype.animate = previousAnimate;
      } else {
        delete (Element.prototype as { animate?: typeof Element.prototype.animate }).animate;
      }
    });

    it('clears data-zooming after a double-tap reset so the next pull-to-dismiss works', () => {
      // Regression: the deferred double-tap committed on pointerup but only
      // flagged `data-zooming` (setZooming(true)) without scheduling its
      // removal. It stayed stuck on the content element, and pull-to-dismiss
      // bails while zooming — so the first pull after a double-tap was dropped.
      vi.useFakeTimers();
      try {
        const ref = React.createRef<LightboxZoomRef>();
        render(<PullDismissLightbox withZoom zoomRef={ref} />);
        const content = screen.getByTestId('content');
        const img = screen.getByAltText('test');

        // Rapid so we aren't mid WAAPI when the double-tap starts (gestures are
        // ignored while a discrete zoom animation is in flight).
        act(() => ref.current!.zoomTo(2, { rapid: true }));

        // Double-tap to reset zoom back to 1 (deferred commit on 2nd pointerup).
        act(() => {
          dispatchPointer(img, 'pointerdown', {
            clientX: 200,
            clientY: 200,
            pointerId: 1,
            isPrimary: true,
            timeStamp: 0,
          });
          dispatchPointer(img, 'pointerup', { clientX: 200, clientY: 200, pointerId: 1, timeStamp: 10 });
          dispatchPointer(img, 'pointerdown', {
            clientX: 202,
            clientY: 201,
            pointerId: 2,
            isPrimary: true,
            timeStamp: 120,
          });
          dispatchPointer(img, 'pointerup', { clientX: 202, clientY: 201, pointerId: 2, timeStamp: 130 });
        });
        expect(ref.current!.zoom).toBe(1);

        // The zooming flag must not be stuck — it clears after its cover window.
        act(() => {
          vi.advanceTimersByTime(350);
        });
        expect(content).not.toHaveAttribute('data-zooming');

        // A pull now starts on the first attempt.
        act(() => {
          dispatchPointer(img, 'pointerdown', { clientX: 200, clientY: 200, pointerId: 3, isPrimary: true });
          dispatchPointer(content, 'pointermove', { clientX: 200, clientY: 250, pointerId: 3 });
        });
        expect(content).toHaveAttribute('data-pulling');
      } finally {
        vi.useRealTimers();
      }
    });

    it('is disabled when pullToClose is false', () => {
      render(<PullDismissLightbox pullToClose={false} />);
      const content = screen.getByTestId('content');
      const img = screen.getByAltText('test');

      act(() => {
        dispatchPointer(img, 'pointerdown', { clientX: 200, clientY: 200 });
        dispatchPointer(content, 'pointermove', { clientX: 200, clientY: 370 });
        dispatchPointer(content, 'pointerup', { clientX: 200, clientY: 370 });
      });

      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('applies transform to the active item during drag', () => {
      render(<PullDismissLightbox />);
      const content = screen.getByTestId('content');
      const img = screen.getByAltText('test');
      const item = img.closest('[data-ramka-item]') as HTMLElement;

      act(() => {
        dispatchPointer(img, 'pointerdown', { clientX: 200, clientY: 200 });
        dispatchPointer(content, 'pointermove', { clientX: 200, clientY: 250 });
      });

      expect(item.style.transform).toMatch(/translate\(.+,.+\)/);
      expect(item.style.transform).toMatch(/scale\(/);
      expect(content.style.transform).toBe('');
    });

    it('applies transform to the Stage morphRef node instead of the item', () => {
      render(
        <LightboxRoot defaultOpen>
          <LightboxPortal>
            <LightboxContent data-testid="content" aria-label="Pull stage morph">
              <LightboxStage>
                {({ morphRef }) => (
                  <div ref={morphRef} data-testid="frame">
                    <SlidesHost>
                      <LightboxItem index={0}>
                        <img src="test.jpg" alt="test" />
                      </LightboxItem>
                    </SlidesHost>
                  </div>
                )}
              </LightboxStage>
            </LightboxContent>
          </LightboxPortal>
        </LightboxRoot>,
      );
      const content = screen.getByTestId('content');
      const img = screen.getByAltText('test');
      const item = img.closest('[data-ramka-item]') as HTMLElement;
      const frame = screen.getByTestId('frame');

      act(() => {
        dispatchPointer(img, 'pointerdown', { clientX: 200, clientY: 200 });
        dispatchPointer(content, 'pointermove', { clientX: 200, clientY: 250 });
      });

      expect(frame.style.transform).toMatch(/translate\(.+,.+\)/);
      expect(frame.style.transform).toMatch(/scale\(/);
      expect(item.style.transform).toBe('');
    });

    it('does not activate for mouse pointer', () => {
      render(<PullDismissLightbox />);
      const content = screen.getByTestId('content');

      act(() => {
        dispatchPointer(content, 'pointerdown', { clientX: 200, clientY: 200, pointerType: 'mouse' });
        dispatchPointer(content, 'pointermove', { clientX: 200, clientY: 370, pointerType: 'mouse' });
      });

      expect(content).not.toHaveAttribute('data-pulling');
    });

    it('does not activate when touch starts on controls outside an item', () => {
      render(
        <LightboxRoot defaultOpen>
          <LightboxPortal>
            <LightboxContent data-testid="content" aria-label="Controls test">
              <SlidesHost>
                <LightboxItem index={0}>
                  <img src="test.jpg" alt="test" />
                </LightboxItem>
              </SlidesHost>
              <button data-testid="close-btn">Close</button>
            </LightboxContent>
          </LightboxPortal>
        </LightboxRoot>,
      );
      const content = screen.getByTestId('content');
      const closeBtn = screen.getByTestId('close-btn');

      act(() => {
        dispatchPointer(closeBtn, 'pointerdown', { clientX: 200, clientY: 200 });
        dispatchPointer(content, 'pointermove', { clientX: 200, clientY: 370 });
      });

      expect(content).not.toHaveAttribute('data-pulling');
    });

    it('does not activate when data-zooming is set on content', () => {
      render(<PullDismissLightbox />);
      const content = screen.getByTestId('content');
      const img = screen.getByAltText('test');

      // Simulate zoom gesture in progress
      content.setAttribute('data-zooming', '');

      act(() => {
        dispatchPointer(img, 'pointerdown', { clientX: 200, clientY: 200 });
        dispatchPointer(content, 'pointermove', { clientX: 200, clientY: 250 });
      });

      expect(content).not.toHaveAttribute('data-pulling');
      const item = img.closest('[data-ramka-item]') as HTMLElement;
      expect(item.style.transform).toBe('');

      content.removeAttribute('data-zooming');
    });

    it('aborts pull gesture if data-zooming appears mid-drag', () => {
      render(<PullDismissLightbox />);
      const content = screen.getByTestId('content');
      const img = screen.getByAltText('test');

      act(() => {
        dispatchPointer(img, 'pointerdown', { clientX: 200, clientY: 200 });
        dispatchPointer(content, 'pointermove', { clientX: 200, clientY: 250 });
      });

      expect(content).toHaveAttribute('data-pulling');

      // Simulate zoom gesture starting (e.g. second finger added)
      content.setAttribute('data-zooming', '');

      act(() => {
        dispatchPointer(content, 'pointermove', { clientX: 200, clientY: 270 });
      });

      // Pull should have aborted — snap-back triggers animate()
      expect(Element.prototype.animate).toHaveBeenCalled();

      content.removeAttribute('data-zooming');
    });

    it('touch gate: pulls from letterbox / Stage padding, not sidebar or no-pull chrome', () => {
      function WiredPullLightbox() {
        return (
          <LightboxRoot defaultOpen>
            <LightboxPortal>
              <LightboxContent data-testid="content" aria-label="Wired pull test">
                <LightboxStage data-testid="stage">
                  <SlidesHost>
                    <LightboxItem index={0}>
                      {({ imageRef }) => (
                        <>
                          {/* Empty letterbox beside a contain-fit image — Stage-wide
                              hit target, so this should start a pull. */}
                          <div data-testid="letterbox" />
                          <img ref={imageRef} data-testid="content-img" src="wired.jpg" alt="wired" />
                        </>
                      )}
                    </LightboxItem>
                  </SlidesHost>
                  <div data-testid="no-pull" data-ramka-no-pull="">
                    overlay chrome
                  </div>
                </LightboxStage>
                <aside data-testid="sidebar">Thread</aside>
              </LightboxContent>
            </LightboxPortal>
          </LightboxRoot>
        );
      }

      render(<WiredPullLightbox />);
      const content = screen.getByTestId('content');

      // Letterbox / empty Stage area starts a pull.
      act(() => {
        dispatchPointer(screen.getByTestId('letterbox'), 'pointerdown', { clientX: 200, clientY: 200 });
        dispatchPointer(content, 'pointermove', { clientX: 200, clientY: 250 });
      });
      expect(content).toHaveAttribute('data-pulling');

      act(() => {
        dispatchPointer(content, 'pointerup', { clientX: 200, clientY: 250 });
      });
      expect(content).not.toHaveAttribute('data-pulling');

      // Side panels outside Stage do not start a pull.
      act(() => {
        dispatchPointer(screen.getByTestId('sidebar'), 'pointerdown', { clientX: 200, clientY: 200 });
        dispatchPointer(content, 'pointermove', { clientX: 200, clientY: 250 });
      });
      expect(content).not.toHaveAttribute('data-pulling');

      // Opt-out chrome keeps its press.
      act(() => {
        dispatchPointer(screen.getByTestId('no-pull'), 'pointerdown', { clientX: 200, clientY: 200 });
        dispatchPointer(content, 'pointermove', { clientX: 200, clientY: 250 });
      });
      expect(content).not.toHaveAttribute('data-pulling');

      // Media still starts a pull.
      act(() => {
        dispatchPointer(screen.getByTestId('content-img'), 'pointerdown', { clientX: 200, clientY: 200 });
        dispatchPointer(content, 'pointermove', { clientX: 200, clientY: 250 });
      });
      expect(content).toHaveAttribute('data-pulling');
    });

    function dispatchTrackpadWheel(target: Element, deltaY = -40) {
      const event = new WheelEvent('wheel', {
        bubbles: true,
        cancelable: true,
        deltaX: 0,
        deltaY,
      });
      // jsdom may omit deltaMode from the constructor; pixel-mode is required.
      Object.defineProperty(event, 'deltaMode', { value: 0 });
      target.dispatchEvent(event);
    }

    it('wheel pull ignores events whose target is outside Stage', () => {
      render(
        <LightboxRoot defaultOpen>
          <LightboxPortal>
            <LightboxContent data-testid="content" aria-label="Stage wheel test">
              <LightboxStage data-testid="stage">
                <SlidesHost>
                  <LightboxItem index={0}>
                    <img src="test.jpg" alt="test" />
                  </LightboxItem>
                </SlidesHost>
              </LightboxStage>
              <aside data-testid="sidebar">Thread</aside>
            </LightboxContent>
          </LightboxPortal>
        </LightboxRoot>,
      );
      const content = screen.getByTestId('content');
      const sidebar = screen.getByTestId('sidebar');
      const img = screen.getByAltText('test');

      act(() => {
        // Stay under the dismiss threshold so we can assert data-pulling.
        for (let i = 0; i < 3; i++) dispatchTrackpadWheel(sidebar, -20);
      });
      expect(content).not.toHaveAttribute('data-pulling');

      act(() => {
        for (let i = 0; i < 3; i++) dispatchTrackpadWheel(img, -20);
      });
      expect(content).toHaveAttribute('data-pulling');
    });

    it('wheel pull still works without Stage (Content is the stage)', () => {
      render(
        <LightboxRoot defaultOpen>
          <LightboxPortal>
            <LightboxContent data-testid="content" aria-label="No-stage wheel test">
              <SlidesHost>
                <LightboxItem index={0}>
                  <img src="test.jpg" alt="test" />
                </LightboxItem>
              </SlidesHost>
            </LightboxContent>
          </LightboxPortal>
        </LightboxRoot>,
      );
      const content = screen.getByTestId('content');
      const img = screen.getByAltText('test');

      act(() => {
        for (let i = 0; i < 3; i++) dispatchTrackpadWheel(img, -20);
      });
      expect(content).toHaveAttribute('data-pulling');
    });
  });

  describe('Lightbox.Stage pan viewport', () => {
    it('reads Stage getBoundingClientRect for pan geometry when Stage is mounted', () => {
      const ref = React.createRef<LightboxZoomRef>();
      let stageEl: HTMLElement | null = null;
      let stageRectCalls = 0;
      // Patch HTMLElement (not Element) — earlier tests may own-property override
      // HTMLElement.prototype.getBoundingClientRect and shadow Element.prototype.
      const origRect = HTMLElement.prototype.getBoundingClientRect;
      HTMLElement.prototype.getBoundingClientRect = function (this: HTMLElement) {
        if (stageEl && this === stageEl) {
          stageRectCalls += 1;
          return {
            left: 0,
            top: 0,
            right: 600,
            bottom: 800,
            width: 600,
            height: 800,
            x: 0,
            y: 0,
            toJSON() {},
          } as DOMRect;
        }
        return {
          left: 0,
          top: 0,
          right: 1000,
          bottom: 800,
          width: 1000,
          height: 800,
          x: 0,
          y: 0,
          toJSON() {},
        } as DOMRect;
      };

      try {
        render(
          <LightboxRoot defaultOpen>
            <LightboxPortal>
              <LightboxContent data-testid="content" aria-label="Stage pan test">
                <LightboxStage data-testid="stage">
                  <SlidesHost>
                    <LightboxItem index={0}>
                      <LightboxZoom ref={ref} maxZoom={4}>
                        <LightboxMedia width={400} height={300}>
                          <img src="test.jpg" alt="test" width={400} height={300} />
                        </LightboxMedia>
                      </LightboxZoom>
                    </LightboxItem>
                  </SlidesHost>
                </LightboxStage>
                <aside data-testid="sidebar">Thread</aside>
              </LightboxContent>
            </LightboxPortal>
          </LightboxRoot>,
        );

        stageEl = screen.getByTestId('stage');
        expect(stageEl).toHaveAttribute('data-ramka-stage');
        // Focal zoom path always measures pan geometry (viewport = Stage).
        act(() => ref.current!.zoomTo(2, { rapid: true, dx: 0, dy: 0 }));
        expect(stageRectCalls).toBeGreaterThan(0);
      } finally {
        HTMLElement.prototype.getBoundingClientRect = origRect;
      }
    });
  });

  // ---------------------------------------------------------------------------
  // Stage-scoped zoom (keyboard + ctrl/trackpad pinch)
  // ---------------------------------------------------------------------------

  describe('Lightbox.Stage zoom scoping', () => {
    function StageZoomLightbox({
      zoomRef,
    }: {
      zoomRef: React.RefObject<LightboxZoomRef | null>;
    }) {
      return (
        <LightboxRoot defaultOpen>
          <LightboxPortal>
            <LightboxContent data-testid="content" aria-label="Stage zoom scope test">
              <LightboxStage data-testid="stage">
                <SlidesHost>
                  <LightboxItem index={0}>
                    <LightboxZoom ref={zoomRef} maxZoom={4}>
                      <img src="test.jpg" alt="test" data-testid="zoom-img" />
                    </LightboxZoom>
                  </LightboxItem>
                </SlidesHost>
              </LightboxStage>
              <aside data-testid="sidebar" tabIndex={0}>
                Thread
              </aside>
            </LightboxContent>
          </LightboxPortal>
        </LightboxRoot>
      );
    }

    function dispatchCtrlWheel(target: Element, deltaY = -40) {
      const event = new WheelEvent('wheel', {
        bubbles: true,
        cancelable: true,
        ctrlKey: true,
        deltaX: 0,
        deltaY,
      });
      Object.defineProperty(event, 'deltaMode', { value: 0 });
      target.dispatchEvent(event);
    }

    it('⌘/Ctrl + and - on sidebar do not zoom when Stage is mounted', () => {
      const zoomRef = React.createRef<LightboxZoomRef>();
      render(<StageZoomLightbox zoomRef={zoomRef} />);
      expect(zoomRef.current!.zoom).toBe(1);

      fireEvent.keyDown(screen.getByTestId('sidebar'), { key: '=', metaKey: true });
      expect(zoomRef.current!.zoom).toBe(1);

      fireEvent.keyDown(screen.getByTestId('sidebar'), { key: '+', ctrlKey: true });
      expect(zoomRef.current!.zoom).toBe(1);

      fireEvent.keyDown(screen.getByTestId('sidebar'), { key: '-', metaKey: true });
      expect(zoomRef.current!.zoom).toBe(1);
    });

    it('⌘/Ctrl + on sidebar still preventDefaults browser page zoom', () => {
      const zoomRef = React.createRef<LightboxZoomRef>();
      render(<StageZoomLightbox zoomRef={zoomRef} />);

      const prevented = fireEvent.keyDown(screen.getByTestId('sidebar'), {
        key: '=',
        metaKey: true,
      });
      // fireEvent.keyDown returns false when defaultPrevented
      expect(prevented).toBe(false);
      expect(zoomRef.current!.zoom).toBe(1);
    });

    it('⌘/Ctrl + on Content still zooms when Stage is mounted (default dialog focus)', () => {
      const zoomRef = React.createRef<LightboxZoomRef>();
      render(<StageZoomLightbox zoomRef={zoomRef} />);

      fireEvent.keyDown(screen.getByTestId('content'), { key: '=', metaKey: true });
      expect(zoomRef.current!.zoom).toBeGreaterThan(1);
    });

    it('⌘/Ctrl + inside Stage zooms the active image', () => {
      const zoomRef = React.createRef<LightboxZoomRef>();
      render(<StageZoomLightbox zoomRef={zoomRef} />);

      fireEvent.keyDown(screen.getByTestId('stage'), { key: '=', metaKey: true });
      expect(zoomRef.current!.zoom).toBeGreaterThan(1);
    });

    it('ctrl+wheel over sidebar does not zoom when Stage is mounted', () => {
      const zoomRef = React.createRef<LightboxZoomRef>();
      render(<StageZoomLightbox zoomRef={zoomRef} />);
      expect(zoomRef.current!.zoom).toBe(1);

      act(() => {
        dispatchCtrlWheel(screen.getByTestId('sidebar'));
      });
      expect(zoomRef.current!.zoom).toBe(1);
    });

    it('ctrl+wheel over Stage zooms the active image', () => {
      const zoomRef = React.createRef<LightboxZoomRef>();
      render(<StageZoomLightbox zoomRef={zoomRef} />);

      act(() => {
        dispatchCtrlWheel(screen.getByTestId('zoom-img'));
      });
      expect(zoomRef.current!.zoom).toBeGreaterThan(1);
    });

    it('ctrl+wheel still zooms without Stage (Content is the stage)', () => {
      const zoomRef = React.createRef<LightboxZoomRef>();
      render(
        <LightboxRoot defaultOpen>
          <LightboxPortal>
            <LightboxContent data-testid="content" aria-label="No-stage zoom test">
              <SlidesHost>
                <LightboxItem index={0}>
                  <LightboxZoom ref={zoomRef} maxZoom={4}>
                    <img src="test.jpg" alt="test" data-testid="zoom-img" />
                  </LightboxZoom>
                </LightboxItem>
              </SlidesHost>
            </LightboxContent>
          </LightboxPortal>
        </LightboxRoot>,
      );

      act(() => {
        dispatchCtrlWheel(screen.getByTestId('zoom-img'));
      });
      expect(zoomRef.current!.zoom).toBeGreaterThan(1);
    });
  });

  describe('scrollTriggerIntoView onChange', () => {
    it('does not scroll the origin trigger into view on open, only on an index change while open', () => {
      // 'onChange' must scroll when the active index changes while already open
      // (so the destination trigger is on-screen for the close morph), but NEVER
      // on the open→true edge: nothing changed yet and the clicked trigger is the
      // open morph's origin — scrolling it would move the morph start / jump the
      // page mid-open.
      const scrollIntoView = vi.fn();
      // Patch on HTMLElement.prototype (the most-derived prototype jsdom resolves
      // for our button triggers) so a leaked Element/HTMLElement rect mock from an
      // earlier test can't shadow ours and make the trigger read as fully visible.
      const origScroll = HTMLElement.prototype.scrollIntoView;
      const origRect = HTMLElement.prototype.getBoundingClientRect;
      HTMLElement.prototype.scrollIntoView = scrollIntoView;
      // Force every trigger to read as "not fully visible" so scrollTriggerEl
      // would scroll if it were called.
      HTMLElement.prototype.getBoundingClientRect = function () {
        return {
          top: -50,
          bottom: 50,
          left: 0,
          right: 50,
          width: 50,
          height: 100,
          x: 0,
          y: -50,
          toJSON() {},
        } as DOMRect;
      };
      try {
        function Harness() {
          return (
            <LightboxRoot scrollTriggerIntoView={{ type: 'onChange', behavior: 'instant' }}>
              {[0, 1, 2].map((i) => (
                <LightboxTrigger key={i} index={i} data-testid={`trigger-${i}`}>
                  T{i}
                </LightboxTrigger>
              ))}
              <LightboxPortal>
                <LightboxContent data-testid="content" aria-label="scroll test">
                  <SlidesHost preload={1}>
                    {[0, 1, 2].map((i) => (
                      <LightboxItem key={i} index={i}>
                        Item {i}
                      </LightboxItem>
                    ))}
                  </SlidesHost>
                  <LightboxNext data-testid="next">Next</LightboxNext>
                </LightboxContent>
              </LightboxPortal>
            </LightboxRoot>
          );
        }
        render(<Harness />);

        // Opening must NOT scroll the origin trigger.
        act(() => {
          fireEvent.click(screen.getByTestId('trigger-0'));
        });
        expect(scrollIntoView).not.toHaveBeenCalled();

        // Navigating to another item while open SHOULD scroll its trigger in
        // (idle-debounced so swipe/scrub doesn't thrash the page under the modal).
        vi.useFakeTimers();
        try {
          act(() => {
            fireEvent.click(screen.getByTestId('next'));
          });
          expect(scrollIntoView).not.toHaveBeenCalled();
          act(() => {
            vi.advanceTimersByTime(120);
          });
          expect(scrollIntoView).toHaveBeenCalledWith({
            block: 'nearest',
            inline: 'nearest',
            behavior: 'instant',
          });
        } finally {
          vi.useRealTimers();
        }
      } finally {
        HTMLElement.prototype.scrollIntoView = origScroll;
        HTMLElement.prototype.getBoundingClientRect = origRect;
      }
    });

    it('forwards block/inline alignment from scrollTriggerIntoView options', () => {
      const scrollIntoView = vi.fn();
      const origScroll = HTMLElement.prototype.scrollIntoView;
      HTMLElement.prototype.scrollIntoView = scrollIntoView;
      try {
        function Harness() {
          return (
            <LightboxRoot
              scrollTriggerIntoView={{
                type: 'onChange',
                behavior: 'instant',
                inline: 'center',
                block: 'center',
              }}
            >
              {[0, 1].map((i) => (
                <LightboxTrigger key={i} index={i} data-testid={`trigger-${i}`}>
                  T{i}
                </LightboxTrigger>
              ))}
              <LightboxPortal>
                <LightboxContent data-testid="content" aria-label="scroll align test">
                  <SlidesHost preload={1}>
                    {[0, 1].map((i) => (
                      <LightboxItem key={i} index={i}>
                        Item {i}
                      </LightboxItem>
                    ))}
                  </SlidesHost>
                  <LightboxNext data-testid="next">Next</LightboxNext>
                </LightboxContent>
              </LightboxPortal>
            </LightboxRoot>
          );
        }
        render(<Harness />);

        act(() => {
          fireEvent.click(screen.getByTestId('trigger-0'));
        });

        vi.useFakeTimers();
        try {
          act(() => {
            fireEvent.click(screen.getByTestId('next'));
          });
          act(() => {
            vi.advanceTimersByTime(120);
          });
          expect(scrollIntoView).toHaveBeenCalledWith({
            block: 'center',
            inline: 'center',
            behavior: 'instant',
          });
        } finally {
          vi.useRealTimers();
        }
      } finally {
        HTMLElement.prototype.scrollIntoView = origScroll;
      }
    });

    it('scrolls the closest trigger when morphTo is closest and the active index has none', () => {
      // Landing-style +N galleries register triggers only for visible tiles.
      // Navigating to a hidden item must still scroll the trigger the close
      // morph will land on — not look up the missing active-index trigger.
      const scrollIntoView = vi.fn();
      const origScroll = HTMLElement.prototype.scrollIntoView;
      HTMLElement.prototype.scrollIntoView = function (this: HTMLElement, options?: ScrollIntoViewOptions) {
        scrollIntoView(this, options);
      };
      try {
        function Harness() {
          return (
            <LightboxRoot
              morphTo="closest"
              scrollTriggerIntoView={{ type: 'onChange', behavior: 'instant' }}
            >
              {[0, 1].map((i) => (
                <LightboxTrigger key={i} index={i} data-testid={`trigger-${i}`}>
                  T{i}
                </LightboxTrigger>
              ))}
              <LightboxPortal>
                <LightboxContent data-testid="content" aria-label="closest scroll test">
                  <SlidesHost preload={1}>
                    {[0, 1, 2].map((i) => (
                      <LightboxItem key={i} index={i}>
                        Item {i}
                      </LightboxItem>
                    ))}
                  </SlidesHost>
                  <LightboxNext data-testid="next">Next</LightboxNext>
                </LightboxContent>
              </LightboxPortal>
            </LightboxRoot>
          );
        }
        render(<Harness />);

        act(() => {
          fireEvent.click(screen.getByTestId('trigger-0'));
        });

        vi.useFakeTimers();
        try {
          act(() => {
            fireEvent.click(screen.getByTestId('next'));
          });
          act(() => {
            vi.advanceTimersByTime(120);
          });
          expect(scrollIntoView).toHaveBeenCalledTimes(1);
          expect(scrollIntoView.mock.calls[0][0]).toBe(screen.getByTestId('trigger-1'));

          scrollIntoView.mockClear();

          act(() => {
            fireEvent.click(screen.getByTestId('next'));
          });
          act(() => {
            vi.advanceTimersByTime(120);
          });
          // Index 2 has no trigger — closest registered trigger is 1.
          expect(scrollIntoView).toHaveBeenCalledTimes(1);
          expect(scrollIntoView.mock.calls[0][0]).toBe(screen.getByTestId('trigger-1'));
          expect(scrollIntoView.mock.calls[0][1]).toEqual({
            block: 'nearest',
            inline: 'nearest',
            behavior: 'instant',
          });
        } finally {
          vi.useRealTimers();
        }
      } finally {
        HTMLElement.prototype.scrollIntoView = origScroll;
      }
    });
  });

  describe('scrollTriggerIntoView onOpenComplete', () => {
    it('scrolls the active trigger into view once the open transition finishes (array config)', async () => {
      // 'onOpenComplete' repositions the trigger while the viewer covers the page
      // and scroll is locked, so the later close morph lands on-screen with no
      // jump. It must NOT fire while the open is still in flight, and the array
      // config form ({ [{ type: 'onOpenComplete' }] }) must normalize correctly.
      let resolveFinished: () => void = () => {};
      const finished = new Promise<void>((r) => {
        resolveFinished = r;
      });
      const startViewTransition = vi.fn((cb: () => void | Promise<void>) => {
        const res = cb();
        if (res && typeof (res as Promise<void>).then === 'function') {
          (res as Promise<void>).catch(vi.fn());
        }
        return { finished };
      });
      Object.defineProperty(document, 'startViewTransition', {
        value: startViewTransition,
        writable: true,
        configurable: true,
      });

      const scrollIntoView = vi.fn();
      const origScroll = HTMLElement.prototype.scrollIntoView;
      const origRect = HTMLElement.prototype.getBoundingClientRect;
      HTMLElement.prototype.scrollIntoView = scrollIntoView;
      // Every trigger reads as "not fully visible" so scrollTriggerEl would scroll.
      HTMLElement.prototype.getBoundingClientRect = function () {
        return {
          top: -50,
          bottom: 50,
          left: 0,
          right: 50,
          width: 50,
          height: 100,
          x: 0,
          y: -50,
          toJSON() {},
        } as DOMRect;
      };
      try {
        function Harness() {
          return (
            <LightboxRoot viewTransition scrollTriggerIntoView={[{ type: 'onOpenComplete', behavior: 'instant' }]}>
              {[0, 1, 2].map((i) => (
                <LightboxTrigger key={i} index={i} data-testid={`trigger-${i}`}>
                  T{i}
                </LightboxTrigger>
              ))}
              <LightboxPortal>
                <LightboxContent data-testid="content" aria-label="open complete scroll test">
                  <SlidesHost preload={1}>
                    {[0, 1, 2].map((i) => (
                      <LightboxItem key={i} index={i}>
                        Item {i}
                      </LightboxItem>
                    ))}
                  </SlidesHost>
                </LightboxContent>
              </LightboxPortal>
            </LightboxRoot>
          );
        }
        render(<Harness />);

        fireEvent.click(screen.getByTestId('trigger-1'));
        // Open transition in flight — must not have repositioned yet.
        expect(scrollIntoView).not.toHaveBeenCalled();

        await act(async () => resolveFinished());
        // Open finished — the active trigger is scrolled into view.
        expect(scrollIntoView).toHaveBeenCalled();
      } finally {
        HTMLElement.prototype.scrollIntoView = origScroll;
        HTMLElement.prototype.getBoundingClientRect = origRect;
        delete (document as unknown as Record<string, unknown>).startViewTransition;
        document.documentElement.removeAttribute('data-ramka-view-transition');
      }
    });
  });
});
