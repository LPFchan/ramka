'use client';

import { mergeProps } from '@base-ui/react/merge-props';
import { useRender } from '@base-ui/react/use-render';
import * as React from 'react';

import { LightboxStageDataAttributes } from './lightbox-data-attributes';
import { useLightboxContext } from './lightbox-context';

interface LightboxStageState extends Record<string, unknown> {}

/**
 * Values handed to Stage's render-function children. Attaching `morphRef` is
 * how a consumer designates a **shared** View Transition destination (the
 * 9:16 frame, the slides track, a custom bezel) instead of the active item.
 */
interface LightboxStageRenderState {
  /**
   * Attach to the element that should morph on open/close. When attached,
   * this node is the capture destination for every item — Item `morphRef` /
   * Media still own decode and the placeholder. Unattached, Stage is only
   * the interaction surface (default).
   */
  morphRef: (node: HTMLElement | null) => void;
}

/**
 * Context published by `Lightbox.Stage` so a nested wrapper can attach
 * `morphRef` without threading the render function. Mirrors the render
 * function's arguments.
 */
const LightboxStageContext = React.createContext<LightboxStageRenderState | null>(null);

/**
 * Optional context from the enclosing Stage. Returns `{ morphRef }`, or
 * `null` outside a Stage.
 */
function useOptionalLightboxStageContext(): LightboxStageRenderState | null {
  return React.useContext(LightboxStageContext);
}

interface LightboxStageProps
  extends Omit<useRender.ComponentProps<'div', LightboxStageState>, 'children'> {
  /**
   * Static children, or a render function that receives `morphRef`. Attach
   * `morphRef` to morph the Stage surface (or a descendant) instead of the
   * active item.
   */
  children?: React.ReactNode | ((state: LightboxStageRenderState) => React.ReactNode);
}

/**
 * Optional media interaction surface inside `Lightbox.Content`.
 *
 * When present, Stage is the host for:
 *   - touch and trackpad wheel pull-to-dismiss (events whose target is outside
 *     Stage are ignored; interactive controls inside Stage still keep their press)
 *   - Zoom pan cover / viewport geometry (instead of the full Content dialog)
 *   - Arrow / Home / End gallery keyboard navigation (only while focus is inside Stage)
 *   - Zoom shortcuts (⌘/+/-/0) and pinch / ctrl+wheel zoom (pointer/focus in Stage)
 *
 * Content remains the dialog shell (focus trap, Escape, zoom shortcuts `+/-`).
 * Side panels, threads, and other app chrome should sit as siblings of Stage
 * under Content so they keep native scroll and their own keyboard behavior.
 *
 * When omitted, Content itself is the stage (backward compatible).
 *
 * Prefer the render-function form of `children` to attach `morphRef` when the
 * open/close morph should capture this surface (or a descendant) instead of
 * the active item — e.g. a 9:16 stories frame.
 *
 * ```tsx
 * <Lightbox.Content aria-label="Post">
 *   <Lightbox.Stage className="media-pane">
 *     <Lightbox.Close />
 *     <Lightbox.Slides>{…}</Lightbox.Slides>
 *     <Lightbox.Previous />
 *     <Lightbox.Next />
 *   </Lightbox.Stage>
 *   <aside>…thread…</aside>
 * </Lightbox.Content>
 * ```
 */
const LightboxStage = React.forwardRef<HTMLDivElement, LightboxStageProps>(
  function LightboxStage(props, forwardedRef) {
    const { render, children, ...elementProps } = props;
    const { stageElementRef, destinationMorphElementRef } = useLightboxContext();

    const morphNodeRef = React.useRef<HTMLElement | null>(null);

    const registerDestination = React.useCallback(
      (node: HTMLElement | null) => {
        const prev = morphNodeRef.current;
        morphNodeRef.current = node;
        if (node) {
          destinationMorphElementRef.current = node;
          return;
        }
        if (destinationMorphElementRef.current === prev) {
          destinationMorphElementRef.current = null;
        }
      },
      [destinationMorphElementRef],
    );

    const morphRef = React.useCallback(
      (node: HTMLElement | null) => {
        registerDestination(node);
      },
      [registerDestination],
    );

    React.useLayoutEffect(() => {
      return () => {
        const prev = morphNodeRef.current;
        if (destinationMorphElementRef.current === prev) {
          destinationMorphElementRef.current = null;
        }
        morphNodeRef.current = null;
      };
    }, [destinationMorphElementRef]);

    const mergedRefCallback = React.useCallback(
      (node: HTMLDivElement | null) => {
        stageElementRef.current = node;
        if (typeof forwardedRef === 'function') {
          forwardedRef(node);
        } else if (forwardedRef) {
          forwardedRef.current = node;
        }
      },
      [forwardedRef, stageElementRef],
    );

    const renderState = React.useMemo<LightboxStageRenderState>(() => ({ morphRef }), [morphRef]);
    const resolvedChildren = typeof children === 'function' ? children(renderState) : children;
    const state = React.useMemo<LightboxStageState>(() => ({}), []);

    return (
      <LightboxStageContext.Provider value={renderState}>
        {useRender({
          render,
          ref: mergedRefCallback,
          state,
          props: mergeProps<'div'>(
            {
              [LightboxStageDataAttributes.stage]: '',
            } as React.ComponentPropsWithRef<'div'>,
            elementProps as React.ComponentPropsWithRef<'div'>,
            { children: resolvedChildren } as React.ComponentPropsWithRef<'div'>,
          ),
          defaultTagName: 'div',
        })}
      </LightboxStageContext.Provider>
    );
  },
);

LightboxStage.displayName = 'LightboxStage';

export { LightboxStage, LightboxStageContext, useOptionalLightboxStageContext };
export type { LightboxStageProps, LightboxStageState, LightboxStageRenderState };
