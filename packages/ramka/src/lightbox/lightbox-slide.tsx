'use client';

import * as React from 'react';

import { LightboxSlideDataAttributes } from './lightbox-data-attributes';
import { mergeProps } from '../render/merge-props';
import { useRender } from '../render/use-render';

/**
 * `Lightbox.Slide` — one snap box inside `Lightbox.Slides`.
 *
 * It is the scroll child that the native snap engine positions, so it carries
 * the snap contract (`scroll-snap-align: center`, `scroll-snap-stop: always`,
 * `overflow: visible`) and the `data-ramka-slide` marker that `Lightbox.Slides`
 * measures for its offset-based geometry. Slide **width** (full-bleed,
 * aspect-sized snug cards, …) is consumer CSS — set `flex` / `width` / `min-width`
 * on this element or via `className` / `style`.
 *
 * Put a `Lightbox.Item` *inside* the slide (not the slide itself): pull-to-dismiss
 * transforms the item, and keeping that transform off the snap box means the
 * scroll layout never shifts mid-gesture. Prefer resting chrome / safe-area
 * insets as padding on this element (not on Zoom) so Item/Zoom fill the content
 * box and zoomed media can paint into the pad under chrome.
 *
 * ```tsx
 * <Lightbox.Slides>
 *   {images.map((img, i) => (
 *     <Lightbox.Slide key={i}>
 *       <Lightbox.Item index={i} caption={img.caption}>
 *         <Lightbox.Zoom>
 *           <img src={img.src} alt={img.alt} />
 *         </Lightbox.Zoom>
 *       </Lightbox.Item>
 *     </Lightbox.Slide>
 *   ))}
 * </Lightbox.Slides>
 * ```
 */

type LightboxSlideProps = useRender.ComponentProps<'div'>;

const LightboxSlide = React.forwardRef<HTMLDivElement, LightboxSlideProps>(
  function LightboxSlide(props, forwardedRef) {
    const { render, style, ...elementProps } = props;

    return useRender({
      render,
      ref: forwardedRef,
      props: mergeProps<'div'>(
        {
          [LightboxSlideDataAttributes.slide]: '',
          style: {
            scrollSnapAlign: 'center',
            scrollSnapStop: 'always',
            // Snap box only — allow a scrollport-sized Item/Zoom stage (and
            // zoomed media) to paint outside the card without clipping.
            overflow: 'visible',
            // Containing block for absolute scrollport-fill stages in snug chrome.
            position: 'relative',
            ...style,
          },
        } as React.ComponentPropsWithRef<'div'>,
        elementProps as React.ComponentPropsWithRef<'div'>,
      ),
      defaultTagName: 'div',
    });
  },
);

LightboxSlide.displayName = 'LightboxSlide';

export { LightboxSlide };
export type { LightboxSlideProps };
