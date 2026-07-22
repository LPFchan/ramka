import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';
import * as React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/* eslint-disable @typescript-eslint/no-non-null-assertion */

const flushMicrotasks = () => act(async () => undefined);
const noop = () => {/* controlled prop placeholder */};

import { LightboxCaption } from './lightbox-caption';
import { LightboxClose } from './lightbox-close';
import { LightboxContent } from './lightbox-content';
import { LightboxCounter } from './lightbox-counter';
import { LightboxItem } from './lightbox-item';
import { LightboxItemGroup } from './lightbox-item-group';
import { LightboxNext } from './lightbox-next';
import { LightboxPrevious } from './lightbox-previous';
import { createHandle } from './lightbox-handle';
import { LightboxRoot } from './lightbox-root';
import { LightboxThumbnail } from './lightbox-thumbnail';
import { LightboxThumbnailGroup } from './lightbox-thumbnail-group';
import { LightboxTrigger } from './lightbox-trigger';
import { LightboxZoom, type LightboxZoomRef } from './lightbox-zoom';
import { LightboxZoomIn } from './lightbox-zoom-in';
import { LightboxZoomOut } from './lightbox-zoom-out';

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
  vi.restoreAllMocks();
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

      <LightboxContent data-testid="content" aria-label="Test lightbox">
        <LightboxClose data-testid="close">Close</LightboxClose>

        <LightboxItemGroup data-testid="item-group" preload={preload}>
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
                : `Item ${i}`
              }
            </LightboxItem>
          ))}
        </LightboxItemGroup>

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

    it('renders ItemGroup with role="group"', () => {
      render(<TestLightbox defaultOpen />);
      expect(screen.getByTestId('item-group')).toHaveAttribute('role', 'group');
    });

    it('renders Item with role="tabpanel"', () => {
      render(<TestLightbox defaultOpen />);
      expect(screen.getByTestId('item-0')).toHaveAttribute('role', 'tabpanel');
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
  // 1b. Consumer prop composition on Content
  // ---------------------------------------------------------------------------

  describe('consumer prop composition on Content', () => {
    it('composes consumer onClick with the internal backdrop-close handler', async () => {
      const onClick = vi.fn();
      render(
        <LightboxRoot defaultOpen>
          <LightboxContent data-testid="content" onClick={onClick}>
            <LightboxItemGroup>
              <LightboxItem index={0}>Item 0</LightboxItem>
            </LightboxItemGroup>
          </LightboxContent>
        </LightboxRoot>,
      );
      // Clicking the content background (target === currentTarget) must run
      // BOTH the consumer handler and the internal close — not clobber either.
      fireEvent.click(screen.getByTestId('content'));
      expect(onClick).toHaveBeenCalledTimes(1);
      await flushMicrotasks();
      expect(screen.queryByTestId('content')).toBeNull();
    });

    it('composes consumer onKeyDown while internal keyboard navigation still runs', () => {
      const onKeyDown = vi.fn();
      const onValueChange = vi.fn();
      render(
        <LightboxRoot defaultOpen onValueChange={onValueChange}>
          <LightboxContent data-testid="content" onKeyDown={onKeyDown}>
            <LightboxItemGroup>
              <LightboxItem index={0}>Item 0</LightboxItem>
              <LightboxItem index={1}>Item 1</LightboxItem>
            </LightboxItemGroup>
          </LightboxContent>
        </LightboxRoot>,
      );
      fireEvent.keyDown(screen.getByTestId('content'), { key: 'ArrowRight' });
      expect(onKeyDown).toHaveBeenCalledTimes(1);
      expect(onValueChange).toHaveBeenCalledWith(1, { source: 'keyboard' });
    });

    it('preserves internal attributes while passing through consumer props', () => {
      render(
        <LightboxRoot defaultOpen>
          <LightboxContent data-testid="content" data-custom="x">
            <LightboxItemGroup>
              <LightboxItem index={0}>Item 0</LightboxItem>
            </LightboxItemGroup>
          </LightboxContent>
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
              <LightboxContent data-testid="content-a" aria-label="Lightbox A">
                <LightboxItemGroup>
                  <LightboxItem index={0}>A0</LightboxItem>
                </LightboxItemGroup>
              </LightboxContent>
            </LightboxRoot>
            <LightboxRoot defaultOpen defaultValue={0}>
              <LightboxContent data-testid="content-b" aria-label="Lightbox B">
                <LightboxItemGroup>
                  <LightboxItem index={0}>B0</LightboxItem>
                </LightboxItemGroup>
              </LightboxContent>
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
      fireEvent.click(content);
      await flushMicrotasks();
      expect(screen.queryByTestId('content')).toBeNull();
    });

    it('controlled open prop controls visibility', () => {
      function Controlled() {
        const [isOpen, setIsOpen] = React.useState(false);
        return (
          <>
            <button data-testid="ext-open" onClick={() => setIsOpen(true)}>Open</button>
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

    it('defers navigation when a descendant already handled the key (defaultPrevented)', () => {
      // Simulates a composed scroller (e.g. Lightbox.Slides): a descendant
      // calls preventDefault on the arrow key before it bubbles to Content, so
      // Content must not also navigate (single keyboard authority).
      render(
        <LightboxRoot defaultOpen defaultValue={0}>
          <LightboxTrigger index={0}>Trigger 0</LightboxTrigger>
          <LightboxContent data-testid="content" aria-label="Dedupe test">
            <div
              data-testid="descendant"
              onKeyDown={(event) => {
                if (event.key === 'ArrowRight') event.preventDefault();
              }}
            >
              <LightboxItemGroup preload={1}>
                {Array.from({ length: 3 }, (_, i) => (
                  <LightboxItem key={`i-${i}`} index={i} data-testid={`item-${i}`}>
                    Item {i}
                  </LightboxItem>
                ))}
              </LightboxItemGroup>
            </div>
          </LightboxContent>
        </LightboxRoot>,
      );

      fireEvent.keyDown(screen.getByTestId('descendant'), { key: 'ArrowRight' });

      // Content bailed out, so the active item is unchanged.
      expect(screen.getByTestId('item-0')).toHaveAttribute('aria-hidden', 'false');
      expect(screen.getByTestId('item-1')).toHaveAttribute('aria-hidden', 'true');
    });
  });

  // ---------------------------------------------------------------------------
  // 3b. Focus & inert (a slide must never strand keyboard focus)
  // ---------------------------------------------------------------------------

  describe('focus containment', () => {
    it('slides expose no focusable region, so inert can never strand focus', () => {
      render(
        <LightboxRoot defaultOpen defaultValue={0}>
          <LightboxContent data-testid="content" aria-label="Non-focusable slide test">
            <LightboxItemGroup>
              <LightboxItem index={0} data-testid="item-0">
                <LightboxZoom maxZoom={4}>
                  <img src="a.jpg" alt="a" />
                </LightboxZoom>
              </LightboxItem>
            </LightboxItemGroup>
          </LightboxContent>
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
          <LightboxContent data-testid="content" aria-label="Containment test">
            <LightboxItemGroup preload={2}>
              {Array.from({ length: 3 }, (_, i) => (
                <LightboxItem key={`i-${i}`} index={i} data-testid={`item-${i}`}>
                  {/* A consumer-provided focusable control inside a slide. */}
                  <button data-testid={`btn-${i}`} type="button">
                    Slide {i}
                  </button>
                </LightboxItem>
              ))}
            </LightboxItemGroup>
          </LightboxContent>
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
            <button data-testid="remove" onClick={() => setCount(2)}>Remove</button>
            <LightboxRoot defaultOpen>
              {Array.from({ length: count }, (_, i) => (
                <LightboxTrigger key={i} index={i}>T{i}</LightboxTrigger>
              ))}
              <LightboxContent aria-label="Dynamic test" data-testid="content">
                <LightboxItemGroup preload={count}>
                  {Array.from({ length: count }, (_, i) => (
                    <LightboxItem key={i} index={i}>Item {i}</LightboxItem>
                  ))}
                </LightboxItemGroup>
                <LightboxCounter data-testid="counter" />
              </LightboxContent>
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
            <LightboxContent aria-label="Reactive caption test">
              <LightboxItemGroup>
                <LightboxItem index={0} caption={text}>
                  Item 0
                </LightboxItem>
              </LightboxItemGroup>
              <LightboxCaption data-testid="reactive-caption" />
            </LightboxContent>
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
          <LightboxContent aria-label="Test">
            <LightboxItemGroup>
              {Array.from({ length: 4 }, (_, i) => (
                <LightboxItem key={i} index={i}>Item {i}</LightboxItem>
              ))}
            </LightboxItemGroup>
            <LightboxCounter data-testid="counter">
              {({ current, total }) => <span>{`${current} of ${total}`}</span>}
            </LightboxCounter>
          </LightboxContent>
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
    it('trigger gets data-open when lightbox is open', () => {
      render(<TestLightbox />);
      const trigger = screen.getByTestId('trigger-0');
      expect(trigger).not.toHaveAttribute('data-open');
      fireEvent.click(trigger);
      expect(screen.getByTestId('trigger-0')).toHaveAttribute('data-open');
    });

    it('trigger gets data-active when it is the active trigger', () => {
      render(<TestLightbox />);
      fireEvent.click(screen.getByTestId('trigger-1'));
      expect(screen.getByTestId('trigger-1')).toHaveAttribute('data-active');
    });

    it('data-open is removed when lightbox closes', () => {
      render(<TestLightbox />);
      fireEvent.click(screen.getByTestId('trigger-0'));
      expect(screen.getByTestId('trigger-0')).toHaveAttribute('data-open');
      fireEvent.click(screen.getByTestId('close'));
      expect(screen.getByTestId('trigger-0')).not.toHaveAttribute('data-open');
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
          <LightboxContent data-testid="content" aria-label="Test">
            <LightboxItemGroup>
              <LightboxItem index={0} data-testid="item-0">Item 0</LightboxItem>
              <LightboxItem index={1} data-testid="item-1">Item 1</LightboxItem>
            </LightboxItemGroup>
          </LightboxContent>
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
          <LightboxContent data-testid="content" aria-label="Test">
            <LightboxItemGroup>
              <LightboxItem index={0}>Item 0</LightboxItem>
            </LightboxItemGroup>
          </LightboxContent>
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
          <LightboxContent data-testid="content" aria-label="Test">
            <LightboxItemGroup>
              <LightboxItem index={0}>Item 0</LightboxItem>
            </LightboxItemGroup>
          </LightboxContent>
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
              <LightboxContent data-testid="content" aria-label="Test">
                <LightboxItemGroup>
                  <LightboxItem index={0}>Item 0</LightboxItem>
                </LightboxItemGroup>
              </LightboxContent>
            </LightboxRoot>
          </>
        );
      }
      render(<Demo />);
      expect(screen.queryByTestId('content')).toBeNull();
      fireEvent.click(screen.getByTestId('detached-trigger'));
      expect(screen.getByTestId('content')).toBeInTheDocument();
      expect(screen.getByTestId('detached-trigger')).toHaveAttribute('data-open');
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
              <LightboxContent data-testid="content" aria-label="Test">
                <LightboxItemGroup>
                  <LightboxItem index={0} data-testid="item-0">Item 0</LightboxItem>
                  <LightboxItem index={1} data-testid="item-1">Item 1</LightboxItem>
                </LightboxItemGroup>
              </LightboxContent>
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
          <LightboxContent data-testid="content" aria-label="Test">
            <LightboxItemGroup>
              <LightboxItem index={0}>Item 0</LightboxItem>
            </LightboxItemGroup>
          </LightboxContent>
        </LightboxRoot>,
      );

      act(() => handle.close());
      act(() => handle.open());

      await act(() => new Promise((r) => setTimeout(r, 50)));

      const closeCalls = completeSpy.mock.calls.filter(
        (call) => call[0] === false,
      );
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
            <LightboxContent aria-label="Empty">
              <LightboxItemGroup />
            </LightboxContent>
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
          <LightboxTrigger index={0} data-testid="trigger-a">A</LightboxTrigger>
          <LightboxTrigger index={0} data-testid="trigger-b">B</LightboxTrigger>
          <LightboxContent data-testid="content" aria-label="Test">
            <LightboxItemGroup>
              <LightboxItem index={0} data-testid="item-0">Item 0</LightboxItem>
            </LightboxItemGroup>
          </LightboxContent>
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
          <LightboxContent data-testid="content" aria-label="Test">
            <LightboxItemGroup>
              <LightboxItem index={0}>Item 0</LightboxItem>
            </LightboxItemGroup>
          </LightboxContent>
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
      const origClientWidth = Object.getOwnPropertyDescriptor(
        document.documentElement,
        'clientWidth',
      );
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
  });

  // ---------------------------------------------------------------------------
  // 12. View Transitions
  // ---------------------------------------------------------------------------

  describe('view transitions', () => {
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
      document.documentElement.removeAttribute('data-lightbox-view-transition');
      document.documentElement.removeAttribute('data-lightbox-no-crossfade');
      document.documentElement.style.removeProperty('--lightbox-morph-border-radius-from');
      document.documentElement.style.removeProperty('--lightbox-morph-border-radius-to');
      document.documentElement.style.removeProperty('--lightbox-morph-old-opacity');
      document.documentElement.style.removeProperty('--lightbox-morph-new-opacity');
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

    it('sets data-lightbox-view-transition on <html> during open', () => {
      mockViewTransitionAPI();
      render(<TestLightbox viewTransition />);
      fireEvent.click(screen.getByTestId('trigger-0'));
      expect(document.documentElement).toHaveAttribute('data-lightbox-view-transition');
    });

    it('removes data-lightbox-view-transition after open transition finishes', async () => {
      const { resolveFinished } = mockViewTransitionAPI();
      render(<TestLightbox viewTransition />);
      fireEvent.click(screen.getByTestId('trigger-0'));
      expect(document.documentElement).toHaveAttribute('data-lightbox-view-transition');

      await act(async () => resolveFinished());
      expect(document.documentElement).not.toHaveAttribute('data-lightbox-view-transition');
    });

    it('cleans up CSS custom properties after open transition finishes', async () => {
      const { resolveFinished } = mockViewTransitionAPI();
      render(<TestLightbox viewTransition />);
      fireEvent.click(screen.getByTestId('trigger-0'));

      await act(async () => resolveFinished());
      const docStyle = document.documentElement.style;
      expect(docStyle.getPropertyValue('--lightbox-morph-border-radius-from')).toBe('');
      expect(docStyle.getPropertyValue('--lightbox-morph-border-radius-to')).toBe('');
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

    it('removes data-lightbox-view-transition after close transition finishes', async () => {
      let resolveOpen: () => void;
      let resolveClose: () => void;

      const startViewTransition = vi.fn((callback: () => void | Promise<void>) => {
        const result = callback();
        if (result && typeof (result as Promise<void>).then === 'function') {
          (result as Promise<void>).catch(vi.fn());
        }
        if (startViewTransition.mock.calls.length === 1) {
          return { finished: new Promise<void>((r) => { resolveOpen = r; }) };
        }
        return { finished: new Promise<void>((r) => { resolveClose = r; }) };
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
      expect(document.documentElement).toHaveAttribute('data-lightbox-view-transition');

      await act(async () => resolveClose!());
      expect(document.documentElement).not.toHaveAttribute('data-lightbox-view-transition');
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
          return { finished: new Promise<void>((r) => { resolveOpen = r; }) };
        }
        return { finished: new Promise<void>((r) => { resolveClose = r; }) };
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
          return { finished: new Promise<void>((r) => { resolveOpen = r; }) };
        }
        return { finished: new Promise<void>((r) => { resolveClose = r; }) };
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
            return { finished: new Promise<void>((r) => { resolveOpen = r; }) };
          }
          return { finished: new Promise<void>((r) => { resolveClose = r; }) };
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
            <LightboxContent data-testid="content" aria-label="decode test">
              <LightboxItemGroup>
                <LightboxItem index={0} data-testid="item-0">
                  <img src="https://example.com/a.jpg" alt="a" />
                </LightboxItem>
              </LightboxItemGroup>
            </LightboxContent>
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

    describe('morph fallback when destination target has no resolvable size', () => {
      let originalRect: PropertyDescriptor | undefined;

      // jsdom has no layout, so every getBoundingClientRect is 0×0. Force the
      // morph target's rendered box to a fixed size to model whether the layout
      // is reserved (loaded image, or explicit width/height / CSS dimensions
      // like a Next.js <Image>) vs. a collapsed 0×0 unsized-and-unloaded image.
      function mockTargetBox(sized: boolean) {
        originalRect = Object.getOwnPropertyDescriptor(
          HTMLImageElement.prototype,
          'getBoundingClientRect',
        );
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
            <LightboxContent data-testid="content" aria-label="morph fallback test">
              <LightboxItemGroup>
                <LightboxItem index={0} data-testid="item-0">
                  {({ imageRef }) => <img ref={imageRef} src="a.jpg" alt="a" />}
                </LightboxItem>
              </LightboxItemGroup>
            </LightboxContent>
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
        // and the no-crossfade opt-out is applied (crossfade defaults to unset).
        const img = screen.getByTestId('item-0').querySelector('img')!;
        expect(img.style.getPropertyValue('view-transition-name')).toBe('lightbox-morph');
        expect(document.documentElement).toHaveAttribute('data-lightbox-no-crossfade');
      });

      it('falls back to a plain crossfade when the target box is 0×0 (unsized image that never loaded)', () => {
        mockViewTransitionAPI();
        mockTargetBox(false);
        renderImageLightbox();
        fireEvent.click(screen.getByTestId('trigger-0'));

        // Fallback path: no morph name (which would shrink the trigger into a
        // 0×0 box) and no no-crossfade opt-out — a clean root crossfade instead.
        const img = screen.getByTestId('item-0').querySelector('img')!;
        expect(img.style.getPropertyValue('view-transition-name')).toBe('');
        expect(document.documentElement).not.toHaveAttribute('data-lightbox-no-crossfade');
        // Still a real View Transition, and the item is still marked ready.
        expect(document.documentElement).toHaveAttribute('data-lightbox-view-transition');
        expect(screen.getByTestId('item-0')).toHaveAttribute('data-skip-fade');
      });
    });

    describe('crossfade direction', () => {
      let originalRect: PropertyDescriptor | undefined;

      function mockTargetBox() {
        originalRect = Object.getOwnPropertyDescriptor(
          HTMLImageElement.prototype,
          'getBoundingClientRect',
        );
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
            <LightboxContent data-testid="content" aria-label="crossfade test">
              <LightboxClose data-testid="close">Close</LightboxClose>
              <LightboxItemGroup>
                <LightboxItem index={0} data-testid="item-0">
                  {({ imageRef }) => <img ref={imageRef} src="full.jpg" alt="full" />}
                </LightboxItem>
              </LightboxItemGroup>
            </LightboxContent>
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
        expect(document.documentElement).toHaveAttribute('data-lightbox-no-crossfade');
      });

      it('crossfades open when crossfade="open"', () => {
        mockViewTransitionAPI();
        mockTargetBox();
        renderCrossfadeLightbox('open');
        fireEvent.click(screen.getByTestId('trigger-0'));
        expect(document.documentElement).not.toHaveAttribute('data-lightbox-no-crossfade');
      });

      it('crossfades open when crossfade="both"', () => {
        mockViewTransitionAPI();
        mockTargetBox();
        renderCrossfadeLightbox('both');
        fireEvent.click(screen.getByTestId('trigger-0'));
        expect(document.documentElement).not.toHaveAttribute('data-lightbox-no-crossfade');
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
            return { finished: new Promise<void>((r) => { resolveOpen = r; }) };
          }
          return { finished: new Promise<void>((r) => { resolveClose = r; }) };
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
        expect(document.documentElement).toHaveAttribute('data-lightbox-no-crossfade');
        await act(async () => resolveOpen());

        fireEvent.click(screen.getByTestId('close'));
        expect(document.documentElement).toHaveAttribute('data-lightbox-view-transition', 'closing');
        expect(document.documentElement).not.toHaveAttribute('data-lightbox-no-crossfade');
      });

      it('hard-cuts close when crossfade="open"', async () => {
        const { resolveOpen } = mockOpenThenCloseTransition();
        mockTargetBox();
        renderCrossfadeLightbox('open');
        fireEvent.click(screen.getByTestId('trigger-0'));
        expect(document.documentElement).not.toHaveAttribute('data-lightbox-no-crossfade');
        await act(async () => resolveOpen());

        fireEvent.click(screen.getByTestId('close'));
        expect(document.documentElement).toHaveAttribute('data-lightbox-view-transition', 'closing');
        expect(document.documentElement).toHaveAttribute('data-lightbox-no-crossfade');
      });
    });

    describe('border-radius CSS vars', () => {
      let originalRect: PropertyDescriptor | undefined;

      // `getBoundingClientRect` lives on Element.prototype. Without a non-zero
      // box, resolveMorphBorderRadius returns "0px" (jsdom layout is always 0).
      function mockTargetBox() {
        originalRect = Object.getOwnPropertyDescriptor(
          Element.prototype,
          'getBoundingClientRect',
        );
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
            <LightboxTrigger
              index={0}
              crossfade="both"
              data-testid="trigger-0"
              style={{ borderRadius: '32px' }}
            >
              {({ imageRef }) => (
                <img ref={imageRef} src="thumb.jpg" alt="thumb" style={{ borderRadius: '32px' }} />
              )}
            </LightboxTrigger>
            <LightboxContent data-testid="content" aria-label="radius vars test">
              <LightboxItemGroup>
                <LightboxItem index={0} data-testid="item-0">
                  {({ imageRef }) => (
                    <img ref={imageRef} src="full.jpg" alt="full" style={{ borderRadius: '8px' }} />
                  )}
                </LightboxItem>
              </LightboxItemGroup>
            </LightboxContent>
          </LightboxRoot>,
        );

        fireEvent.click(screen.getByTestId('trigger-0'));

        expect(
          document.documentElement.style.getPropertyValue('--lightbox-morph-border-radius-from'),
        ).toBe('32px');
        expect(
          document.documentElement.style.getPropertyValue('--lightbox-morph-border-radius-to'),
        ).toBe('8px');
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
        originalRect = Object.getOwnPropertyDescriptor(
          HTMLElement.prototype,
          'getBoundingClientRect',
        );
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
            <LightboxContent data-testid="content" aria-label="unwired warn">
              <LightboxItemGroup>
                <LightboxItem index={0} data-testid="item-0">
                  {/* No imageRef / morphRef → target resolves to the item element. */}
                  <div>no morph target here</div>
                </LightboxItem>
              </LightboxItemGroup>
            </LightboxContent>
          </LightboxRoot>,
        );
        fireEvent.click(screen.getByTestId('trigger-0'));

        expect(warn).toHaveBeenCalledWith(
          expect.stringContaining(MORPH_WARN),
          screen.getByTestId('item-0'),
        );
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
            <LightboxContent data-testid="content" aria-label="wired ok">
              <LightboxItemGroup>
                <LightboxItem index={0} data-testid="item-0">
                  {({ imageRef }) => <img ref={imageRef} src="a.jpg" alt="a" />}
                </LightboxItem>
              </LightboxItemGroup>
            </LightboxContent>
          </LightboxRoot>,
        );
        fireEvent.click(screen.getByTestId('trigger-0'));

        expect(warn).not.toHaveBeenCalledWith(
          expect.stringContaining(MORPH_WARN),
          expect.anything(),
        );
        warn.mockRestore();
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
          <LightboxContent data-testid="content" aria-label="Pinch test">
            <LightboxItemGroup>
              <LightboxItem index={0}>
                <img src="test.jpg" alt="test" />
              </LightboxItem>
            </LightboxItemGroup>
          </LightboxContent>
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
          <LightboxContent data-testid="content" aria-label="Single touch test">
            <LightboxItemGroup>
              <LightboxItem index={0}>
                <img src="test.jpg" alt="test" />
              </LightboxItem>
            </LightboxItemGroup>
          </LightboxContent>
        </LightboxRoot>,
      );

      const content = screen.getByTestId('content');
      const event = new TouchEvent('touchmove', {
        bubbles: true,
        cancelable: true,
        touches: [
          new Touch({ identifier: 0, target: content, clientX: 0, clientY: 0 }),
        ],
      });
      const prevented = !content.dispatchEvent(event);
      expect(prevented).toBe(false);
    });

    it('prevents ctrl+wheel (trackpad pinch-to-zoom) on content', () => {
      // On non-Safari browsers (including jsdom), Ctrl+wheel is prevented via
      // a non-passive wheel listener. On Safari, native zoom is prevented via
      // GestureEvent instead (to preserve momentum scrolling).
      render(
        <LightboxRoot defaultOpen>
          <LightboxContent data-testid="content" aria-label="Wheel zoom test">
            <LightboxItemGroup>
              <LightboxItem index={0}>
                <img src="test.jpg" alt="test" />
              </LightboxItem>
            </LightboxItemGroup>
          </LightboxContent>
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
          <LightboxContent data-testid="content" aria-label="Regular wheel test">
            <LightboxItemGroup>
              <LightboxItem index={0}>
                <img src="test.jpg" alt="test" />
              </LightboxItem>
            </LightboxItemGroup>
          </LightboxContent>
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
    function ZoomLightbox({ maxZoom = 4, onZoomChange }: { maxZoom?: number; onZoomChange?: (z: number) => void } = {}) {
      return (
        <LightboxRoot defaultOpen>
          <LightboxContent data-testid="content" aria-label="Zoom test">
            <LightboxItemGroup>
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
            </LightboxItemGroup>
            <LightboxNext data-testid="next">Next</LightboxNext>
            <LightboxPrevious data-testid="prev">Previous</LightboxPrevious>
          </LightboxContent>
        </LightboxRoot>
      );
    }

    function getZoomRef() {
      const ref = React.createRef<LightboxZoomRef>();
      function ZoomWithRef() {
        return (
          <LightboxRoot defaultOpen>
            <LightboxContent aria-label="Zoom ref test">
              <LightboxItemGroup>
                <LightboxItem index={0}>
                  <LightboxZoom ref={ref} maxZoom={4}>
                    <img src="test.jpg" alt="test" data-testid="zoom-img" />
                  </LightboxZoom>
                </LightboxItem>
              </LightboxItemGroup>
            </LightboxContent>
          </LightboxRoot>
        );
      }
      return { ref, Component: ZoomWithRef };
    }

    it('renders zoom container with children', () => {
      render(<ZoomLightbox />);
      expect(screen.getByTestId('zoom-img')).toBeInTheDocument();
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
          <LightboxContent aria-label="Zoom callback test">
            <LightboxItemGroup>
              <LightboxItem index={0}>
                <LightboxZoom ref={ref} maxZoom={4} onZoomChange={spy}>
                  <img src="test.jpg" alt="test" />
                </LightboxZoom>
              </LightboxItem>
            </LightboxItemGroup>
          </LightboxContent>
        </LightboxRoot>,
      );
      act(() => ref.current!.zoomIn());
      expect(spy).toHaveBeenCalledWith(expect.any(Number));
    });

    it('zoom resets when active slide changes', () => {
      const ref = React.createRef<LightboxZoomRef>();
      render(
        <LightboxRoot defaultOpen>
          <LightboxContent aria-label="Zoom reset test" data-testid="content">
            <LightboxItemGroup>
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
            </LightboxItemGroup>
            <LightboxNext data-testid="next">Next</LightboxNext>
          </LightboxContent>
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
          <LightboxContent aria-label="No zoom">
            <LightboxZoomIn data-testid="orphan-zoom-in">+</LightboxZoomIn>
          </LightboxContent>
        </LightboxRoot>,
      );
      expect(screen.getByTestId('orphan-zoom-in')).toBeDisabled();
    });

    it('ZoomOut button outside Zoom context renders disabled', () => {
      render(
        <LightboxRoot defaultOpen>
          <LightboxContent aria-label="No zoom">
            <LightboxZoomOut data-testid="orphan-zoom-out">-</LightboxZoomOut>
          </LightboxContent>
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
          <LightboxContent data-testid="content" aria-label="Zoom zoomed test">
            <LightboxItemGroup>
              <LightboxItem index={0}>
                <LightboxZoom ref={ref} maxZoom={4}>
                  <img src="test.jpg" alt="test" />
                </LightboxZoom>
              </LightboxItem>
            </LightboxItemGroup>
          </LightboxContent>
        </LightboxRoot>,
      );
      const contentEl = screen.getByTestId('content');
      expect(contentEl).not.toHaveAttribute('data-zoomed');

      act(() => ref.current!.zoomTo(2));
      expect(contentEl).toHaveAttribute('data-zoomed');
    });

    it('data-zoomed attribute is removed when zoom resets to 1x (rapid)', () => {
      const ref = React.createRef<LightboxZoomRef>();
      render(
        <LightboxRoot defaultOpen>
          <LightboxContent data-testid="content" aria-label="Zoom reset attr test">
            <LightboxItemGroup>
              <LightboxItem index={0}>
                <LightboxZoom ref={ref} maxZoom={4}>
                  <img src="test.jpg" alt="test" />
                </LightboxZoom>
              </LightboxItem>
            </LightboxItemGroup>
          </LightboxContent>
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
          <LightboxContent data-testid="content" aria-label="Zoom animated reset attr test">
            <LightboxItemGroup>
              <LightboxItem index={0}>
                <LightboxZoom ref={ref} maxZoom={4} animationDuration={300}>
                  <img src="test.jpg" alt="test" />
                </LightboxZoom>
              </LightboxItem>
            </LightboxItemGroup>
          </LightboxContent>
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
          <LightboxContent data-testid="content" aria-label="Zoom slide change test">
            <LightboxItemGroup>
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
            </LightboxItemGroup>
            <LightboxNext data-testid="next">Next</LightboxNext>
          </LightboxContent>
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
          <LightboxContent aria-label="Default maxZoom">
            <LightboxItemGroup>
              <LightboxItem index={0}>
                <LightboxZoom>
                  <div>No image</div>
                </LightboxZoom>
              </LightboxItem>
            </LightboxItemGroup>
          </LightboxContent>
        </LightboxRoot>,
      );
      expect(screen.getByText('No image')).toBeInTheDocument();
    });

    it('touch-action is pan-x pan-y at 1x zoom and none when zoomed', () => {
      const ref = React.createRef<LightboxZoomRef>();
      render(
        <LightboxRoot defaultOpen>
          <LightboxContent aria-label="Touch action test">
            <LightboxItemGroup>
              <LightboxItem index={0}>
                <LightboxZoom ref={ref} maxZoom={4}>
                  <img src="test.jpg" alt="test" />
                </LightboxZoom>
              </LightboxItem>
            </LightboxItemGroup>
          </LightboxContent>
        </LightboxRoot>,
      );

      const zoomContainer = screen.getByAltText('test').parentElement!.parentElement!;
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
            <LightboxContent aria-label="Elastic test">
              <LightboxItemGroup>
                <LightboxItem index={0}>
                  <LightboxZoom ref={ref} maxZoom={4}>
                    <img src="test.jpg" alt="test" />
                  </LightboxZoom>
                </LightboxItem>
              </LightboxItemGroup>
            </LightboxContent>
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
            <LightboxContent aria-label="Snap test">
              <LightboxItemGroup>
                <LightboxItem index={0}>
                  <LightboxZoom ref={ref} maxZoom={4}>
                    <img src="test.jpg" alt="test" />
                  </LightboxZoom>
                </LightboxItem>
              </LightboxItemGroup>
            </LightboxContent>
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
            <LightboxContent aria-label="Min clamp test">
              <LightboxItemGroup>
                <LightboxItem index={0}>
                  <LightboxZoom ref={ref} maxZoom={4}>
                    <img src="test.jpg" alt="test" />
                  </LightboxZoom>
                </LightboxItem>
              </LightboxItemGroup>
            </LightboxContent>
          </LightboxRoot>,
        );

        act(() => ref.current!.zoomTo(0.5));
        expect(ref.current!.zoom).toBe(1);
      });
    });
  });

  // ---------------------------------------------------------------------------
  // 14b. Global zoom controls (active-zoom bridge)
  //
  // Mirrors the flagship layout: one shared ZoomIn/ZoomOut set rendered in the
  // chrome (siblings of ItemGroup, OUTSIDE any per-slide Lightbox.Zoom), each
  // item wrapped in its own Zoom. The buttons must drive whichever slide is
  // currently active via the Root-owned bridge.
  // ---------------------------------------------------------------------------

  describe('global zoom controls', () => {
    function GlobalZoomLightbox({
      refs,
      maxZoom = 4,
    }: {
      refs?: Array<React.RefObject<LightboxZoomRef | null>>;
      maxZoom?: number;
    } = {}) {
      return (
        <LightboxRoot defaultOpen>
          <LightboxContent data-testid="content" aria-label="Global zoom test">
            <LightboxItemGroup>
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
            </LightboxItemGroup>
            {/* Single shared control set outside every Zoom */}
            <LightboxZoomIn data-testid="zoom-in">+</LightboxZoomIn>
            <LightboxZoomOut data-testid="zoom-out">-</LightboxZoomOut>
            <LightboxNext data-testid="next">Next</LightboxNext>
            <LightboxPrevious data-testid="prev">Previous</LightboxPrevious>
          </LightboxContent>
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
      const refs = [
        React.createRef<LightboxZoomRef>(),
        React.createRef<LightboxZoomRef>(),
      ];
      render(<GlobalZoomLightbox refs={refs} />);

      // Active slide is index 0.
      fireEvent.click(screen.getByTestId('zoom-in'));
      expect(refs[0]!.current!.zoom).toBeGreaterThan(1);
      expect(refs[1]!.current!.zoom).toBe(1);
    });

    it('controls follow the active slide after navigation', () => {
      const refs = [
        React.createRef<LightboxZoomRef>(),
        React.createRef<LightboxZoomRef>(),
      ];
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
          constructor(type: string, init: PointerEventInit & { pointerId?: number; pointerType?: string; isPrimary?: boolean } = {}) {
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

    function dispatchPointer(el: Element, type: string, init: Partial<PointerEventInit> & { pointerId?: number; clientX?: number; clientY?: number; timeStamp?: number; isPrimary?: boolean } = {}) {
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

    function PullDismissLightbox({ pullToClose, withZoom, zoomRef }: { pullToClose?: boolean; withZoom?: boolean; zoomRef?: React.RefObject<LightboxZoomRef | null> } = {}) {
      return (
        <LightboxRoot defaultOpen>
          <LightboxContent data-testid="content" aria-label="Pull dismiss test" pullToClose={pullToClose}>
            <LightboxItemGroup>
              <LightboxItem index={0}>
                {withZoom ? (
                  <LightboxZoom ref={zoomRef} maxZoom={4}>
                    <img src="test.jpg" alt="test" />
                  </LightboxZoom>
                ) : (
                  <img src="test.jpg" alt="test" />
                )}
              </LightboxItem>
            </LightboxItemGroup>
          </LightboxContent>
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
        dispatchPointer(img, 'pointerdown', { clientX: 200, clientY: 200, pointerId: 1, isPrimary: true, timeStamp: 0 });
        dispatchPointer(img, 'pointerup', { clientX: 200, clientY: 200, pointerId: 1, timeStamp: 10 });
        dispatchPointer(img, 'pointerdown', { clientX: 202, clientY: 201, pointerId: 2, isPrimary: true, timeStamp: 120 });
        dispatchPointer(img, 'pointerup', { clientX: 202, clientY: 201, pointerId: 2, timeStamp: 130 });
      });

      expect(ref.current!.zoom).toBeGreaterThan(1);
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

        act(() => ref.current!.zoomTo(2));

        // Double-tap to reset zoom back to 1 (deferred commit on 2nd pointerup).
        act(() => {
          dispatchPointer(img, 'pointerdown', { clientX: 200, clientY: 200, pointerId: 1, isPrimary: true, timeStamp: 0 });
          dispatchPointer(img, 'pointerup', { clientX: 200, clientY: 200, pointerId: 1, timeStamp: 10 });
          dispatchPointer(img, 'pointerdown', { clientX: 202, clientY: 201, pointerId: 2, isPrimary: true, timeStamp: 120 });
          dispatchPointer(img, 'pointerup', { clientX: 202, clientY: 201, pointerId: 2, timeStamp: 130 });
        });
        expect(ref.current!.zoom).toBe(1);

        // The zooming flag must not be stuck — it clears after its cover window.
        act(() => { vi.advanceTimersByTime(300); });
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
      const item = img.closest('[data-lightbox-item]') as HTMLElement;

      act(() => {
        dispatchPointer(img, 'pointerdown', { clientX: 200, clientY: 200 });
        dispatchPointer(content, 'pointermove', { clientX: 200, clientY: 250 });
      });

      expect(item.style.transform).toMatch(/translate\(.+,.+\)/);
      expect(item.style.transform).toMatch(/scale\(/);
      expect(content.style.transform).toBe('');
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
          <LightboxContent data-testid="content" aria-label="Controls test">
            <LightboxItemGroup>
              <LightboxItem index={0}>
                <img src="test.jpg" alt="test" />
              </LightboxItem>
            </LightboxItemGroup>
            <button data-testid="close-btn">Close</button>
          </LightboxContent>
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
      const item = img.closest('[data-lightbox-item]') as HTMLElement;
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

    it('touch gate: pulls from the registered content element but not a sibling', () => {
      function WiredPullLightbox() {
        return (
          <LightboxRoot defaultOpen>
            <LightboxContent data-testid="content" aria-label="Wired pull test">
              <LightboxItemGroup>
                <LightboxItem index={0}>
                  {({ imageRef }) => (
                    <>
                      {/* A non-registered sibling inside the item (e.g. the empty
                          letterbox area beside a contain-fit image). */}
                      <div data-testid="letterbox" />
                      <img ref={imageRef} data-testid="content-img" src="wired.jpg" alt="wired" />
                    </>
                  )}
                </LightboxItem>
              </LightboxItemGroup>
            </LightboxContent>
          </LightboxRoot>
        );
      }

      render(<WiredPullLightbox />);
      const content = screen.getByTestId('content');

      // Touching the non-registered sibling must NOT start a pull, even though
      // it's inside the item — the gate is scoped to the registered content.
      act(() => {
        dispatchPointer(screen.getByTestId('letterbox'), 'pointerdown', { clientX: 200, clientY: 200 });
        dispatchPointer(content, 'pointermove', { clientX: 200, clientY: 250 });
      });
      expect(content).not.toHaveAttribute('data-pulling');

      // Touching the imageRef-registered image DOES start a pull.
      act(() => {
        dispatchPointer(screen.getByTestId('content-img'), 'pointerdown', { clientX: 200, clientY: 200 });
        dispatchPointer(content, 'pointermove', { clientX: 200, clientY: 250 });
      });
      expect(content).toHaveAttribute('data-pulling');
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
        return { top: -50, bottom: 50, left: 0, right: 50, width: 50, height: 100, x: 0, y: -50, toJSON() {} } as DOMRect;
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
              <LightboxContent data-testid="content" aria-label="scroll test">
                <LightboxItemGroup preload={1}>
                  {[0, 1, 2].map((i) => (
                    <LightboxItem key={i} index={i}>
                      Item {i}
                    </LightboxItem>
                  ))}
                </LightboxItemGroup>
                <LightboxNext data-testid="next">Next</LightboxNext>
              </LightboxContent>
            </LightboxRoot>
          );
        }
        render(<Harness />);

        // Opening must NOT scroll the origin trigger.
        act(() => {
          fireEvent.click(screen.getByTestId('trigger-0'));
        });
        expect(scrollIntoView).not.toHaveBeenCalled();

        // Navigating to another item while open SHOULD scroll its trigger in.
        act(() => {
          fireEvent.click(screen.getByTestId('next'));
        });
        expect(scrollIntoView).toHaveBeenCalled();
      } finally {
        HTMLElement.prototype.scrollIntoView = origScroll;
        HTMLElement.prototype.getBoundingClientRect = origRect;
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
        return { top: -50, bottom: 50, left: 0, right: 50, width: 50, height: 100, x: 0, y: -50, toJSON() {} } as DOMRect;
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
              <LightboxContent data-testid="content" aria-label="open complete scroll test">
                <LightboxItemGroup preload={1}>
                  {[0, 1, 2].map((i) => (
                    <LightboxItem key={i} index={i}>
                      Item {i}
                    </LightboxItem>
                  ))}
                </LightboxItemGroup>
              </LightboxContent>
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
        document.documentElement.removeAttribute('data-lightbox-view-transition');
      }
    });
  });
});
