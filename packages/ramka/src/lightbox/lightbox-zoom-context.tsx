'use client';

import * as React from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ZoomState {
  /** Current zoom level (1 = no zoom). */
  zoom: number;
  /** Maximum zoom level for the current content. */
  maxZoom: number;
  /** Horizontal pan offset in content-space pixels. */
  offsetX: number;
  /** Vertical pan offset in content-space pixels. */
  offsetY: number;
  /** Whether zoom-in is available. */
  canZoomIn: boolean;
  /** Whether zoom-out is available. */
  canZoomOut: boolean;
}

interface ZoomActions {
  zoomIn: () => void;
  zoomOut: () => void;
  /** Zoom to an exact level, optionally anchored at (dx, dy) from center. */
  zoomTo: (target: number, options?: { rapid?: boolean; dx?: number; dy?: number }) => void;
  /** Reset zoom to minZoom (default 1). */
  reset: (rapid?: boolean) => void;
  /** Pan by the given deltas (content-space px, positive = move content left/up). */
  changeOffsets: (dx: number, dy: number) => void;
}

type ZoomContextValue = ZoomState & ZoomActions;

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const ZoomContext = React.createContext<ZoomContextValue | null>(null);

function useZoomContext(): ZoomContextValue {
  const ctx = React.useContext(ZoomContext);
  if (!ctx) {
    throw new Error('Lightbox zoom components must be used within a Lightbox.Zoom');
  }
  return ctx;
}

function useOptionalZoomContext(): ZoomContextValue | null {
  return React.useContext(ZoomContext);
}

// ---------------------------------------------------------------------------
// Active-zoom bridge
//
// `ZoomContext` is scoped to a single `Lightbox.Zoom` (one per slide). Global
// controls (e.g. a single ZoomIn/ZoomOut in the chrome) and `Lightbox.Content`
// render above every `Zoom`, so they cannot read that per-slide context.
//
// The bridge lets the *active* slide's `Lightbox.Zoom` publish a minimal
// controls object up to `Lightbox.Root`, which re-exposes it so global
// controls drive whichever slide is currently active.
//
// It is split into two contexts on purpose:
//   - Publish context (stable identity): consumed by every mounted `Zoom`
//     (to publish) and by `Content` (to read the live value via a ref). It
//     never changes identity, so preloaded zooms don't re-render on zoom ticks.
//   - Active context (reactive): the current `ActiveZoomControls | null`,
//     consumed only by the small ZoomIn/ZoomOut buttons that must reflect the
//     enabled/disabled state.
// ---------------------------------------------------------------------------

/**
 * The minimal, always-fresh slice of the active slide's zoom state exposed to
 * global controls and to `Lightbox.Content`. `getZoom()` returns the live zoom
 * level (reads a ref), so consumers never see a stale snapshot.
 */
interface ActiveZoomControls {
  canZoomIn: boolean;
  canZoomOut: boolean;
  zoomIn: () => void;
  zoomOut: () => void;
  /** Live zoom level of the active slide (1 = not zoomed). */
  getZoom: () => number;
}

type PublishActiveZoom = (
  next: ActiveZoomControls | null | ((prev: ActiveZoomControls | null) => ActiveZoomControls | null),
) => void;

interface LightboxZoomPublishContextValue {
  /** Publish (or clear) the active slide's controls. Accepts a functional updater. */
  publish: PublishActiveZoom;
  /** Always-current controls for imperative reads (pull-to-dismiss, keyboard). */
  activeZoomRef: React.RefObject<ActiveZoomControls | null>;
}

const LightboxZoomPublishContext = React.createContext<LightboxZoomPublishContextValue | null>(null);

function useLightboxZoomPublish(): LightboxZoomPublishContextValue {
  const ctx = React.useContext(LightboxZoomPublishContext);
  if (!ctx) {
    throw new Error('Lightbox zoom bridge must be used within a Lightbox.Root');
  }
  return ctx;
}

const LightboxActiveZoomContext = React.createContext<ActiveZoomControls | null>(null);

function useOptionalActiveZoom(): ActiveZoomControls | null {
  return React.useContext(LightboxActiveZoomContext);
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export {
  ZoomContext,
  useZoomContext,
  useOptionalZoomContext,
  LightboxZoomPublishContext,
  useLightboxZoomPublish,
  LightboxActiveZoomContext,
  useOptionalActiveZoom,
};
export type { ZoomState, ZoomActions, ZoomContextValue, ActiveZoomControls, PublishActiveZoom, LightboxZoomPublishContextValue };
