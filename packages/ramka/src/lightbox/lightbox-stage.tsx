'use client';

import { mergeProps, useRender } from '@base-ui/react';
import * as React from 'react';

import { LightboxStageDataAttributes } from './lightbox-data-attributes';
import { useLightboxContext } from './lightbox-context';

interface LightboxStageState extends Record<string, unknown> {}

interface LightboxStageProps extends useRender.ComponentProps<'div', LightboxStageState> {}

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
 * ```tsx
 * <Lightbox.Content aria-label="Post">
 *   <Lightbox.Stage className="media-pane">
 *     <Lightbox.Close />
 *     <Lightbox.ItemGroup>{…}</Lightbox.ItemGroup>
 *     <Lightbox.Previous />
 *     <Lightbox.Next />
 *   </Lightbox.Stage>
 *   <aside>…thread…</aside>
 * </Lightbox.Content>
 * ```
 */
const LightboxStage = React.forwardRef<HTMLDivElement, LightboxStageProps>(
  function LightboxStage(props, forwardedRef) {
    const { render, ...elementProps } = props;
    const { stageElementRef } = useLightboxContext();

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

    const state = React.useMemo<LightboxStageState>(() => ({}), []);

    return useRender({
      render,
      ref: mergedRefCallback,
      state,
      props: mergeProps<'div'>(
        {
          [LightboxStageDataAttributes.stage]: '',
        } as React.ComponentPropsWithRef<'div'>,
        elementProps as React.ComponentPropsWithRef<'div'>,
      ),
      defaultTagName: 'div',
    });
  },
);

LightboxStage.displayName = 'LightboxStage';

export { LightboxStage };
export type { LightboxStageProps, LightboxStageState };
