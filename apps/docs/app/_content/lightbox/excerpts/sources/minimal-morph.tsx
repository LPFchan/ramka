import * as Lightbox from '@ramka/react/lightbox';

declare const thumb: string;
declare const src: string;

/**
 * Minimal view-transition morph: Trigger imageRef + Item Media (auto-discovers img).
 *
 * @docsExcerpt minimal-morph
 * @docsExcerptTitle Minimal morph
 */
export function MinimalMorphExcerpt() {
  return (
    <Lightbox.Root morphTo="active">
      <Lightbox.Trigger index={0}>{({ imageRef }) => <img ref={imageRef} src={thumb} alt="" />}</Lightbox.Trigger>

      <Lightbox.Portal>
        <Lightbox.Backdrop />
        <Lightbox.Content>
          <Lightbox.Slides>
            <Lightbox.Slide>
              <Lightbox.Item index={0}>
                <Lightbox.Zoom>
                  <Lightbox.Media>
                    <img src={src} alt="" />
                  </Lightbox.Media>
                </Lightbox.Zoom>
              </Lightbox.Item>
            </Lightbox.Slide>
          </Lightbox.Slides>
        </Lightbox.Content>
      </Lightbox.Portal>
    </Lightbox.Root>
  );
}
