'use client';

import { mergeProps, useRender } from '@base-ui/react';
import * as React from 'react';

/**
 * `Lightbox.Slide` — one full-viewport-wide snap box inside `Lightbox.Slides`.
 *
 * It is the scroll child that the native snap engine positions, so it carries
 * the snap contract (`flex: 0 0 100%`, `scroll-snap-align: center`,
 * `scroll-snap-stop: always`) and the `data-lightbox-slide` marker that
 * `Lightbox.Slides` measures for its offset-based geometry.
 *
 * Put a `Lightbox.Item` *inside* the slide (not the slide itself): pull-to-dismiss
 * transforms the item, and keeping that transform off the snap box means the
 * scroll layout never shifts mid-gesture.
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
          'data-lightbox-slide': '',
          style: {
            // One viewport per slide; the browser snaps its center. `min-width`
            // is belt-and-suspenders so the box can't be squeezed by flex even
            // if a consumer forgets `shrink-0`.
            flex: '0 0 100%',
            minWidth: '100%',
            scrollSnapAlign: 'center',
            scrollSnapStop: 'always',
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
