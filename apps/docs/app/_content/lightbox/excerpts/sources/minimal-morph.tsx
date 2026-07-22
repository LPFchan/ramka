import { Lightbox } from 'ramka';

declare const thumb: string;
declare const src: string;

/**
 * Minimal view-transition morph with imageRef on Trigger + Item.
 *
 * @docsExcerpt minimal-morph
 * @docsExcerptTitle Minimal morph
 */
export function MinimalMorphExcerpt() {
  return (
    <Lightbox.Root morphTo="active">
      <Lightbox.Trigger index={0}>
        {({ imageRef }) => <img ref={imageRef} src={thumb} alt="" />}
      </Lightbox.Trigger>

      <Lightbox.Backdrop />
      <Lightbox.Content>
        <Lightbox.Slides>
          <Lightbox.Slide>
            <Lightbox.Item index={0}>
              {({ imageRef }) => (
                <Lightbox.Zoom>
                  <img ref={imageRef} src={src} alt="" />
                </Lightbox.Zoom>
              )}
            </Lightbox.Item>
          </Lightbox.Slide>
        </Lightbox.Slides>
      </Lightbox.Content>
    </Lightbox.Root>
  );
}
