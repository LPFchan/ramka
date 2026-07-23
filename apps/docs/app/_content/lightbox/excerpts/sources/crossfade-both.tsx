import { Lightbox } from 'ramka';

declare const thumb: string;
declare const src: string;
declare const extras: number;

/**
 * Trigger crossfade="both" for a +N overlay tile.
 *
 * @docsExcerpt crossfade-both
 * @docsExcerptTitle crossfade="both"
 */
export function CrossfadeBothExcerpt() {
  return (
    <Lightbox.Root morphTo="closest">
      <Lightbox.Trigger index={0} crossfade="both">
        {({ imageRef }) => (
          <div className="relative">
            <img ref={imageRef} src={thumb} alt="" />
            <span>+{extras}</span>
          </div>
        )}
      </Lightbox.Trigger>
      <Lightbox.Portal>
        <Lightbox.Backdrop />
        <Lightbox.Content>
          <Lightbox.Slides>
            <Lightbox.Slide>
              <Lightbox.Item index={0}>{({ imageRef }) => <img ref={imageRef} src={src} alt="" />}</Lightbox.Item>
            </Lightbox.Slide>
          </Lightbox.Slides>
        </Lightbox.Content>
      </Lightbox.Portal>
    </Lightbox.Root>
  );
}
