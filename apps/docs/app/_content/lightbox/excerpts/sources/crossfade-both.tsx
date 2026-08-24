import Image, { type StaticImageData } from 'next/image';
import * as Lightbox from '@ramka/react/lightbox';

declare const photo: StaticImageData;
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
            <Image ref={imageRef} src={photo} alt="" placeholder="blur" />
            <span>+{extras}</span>
          </div>
        )}
      </Lightbox.Trigger>
      <Lightbox.Portal>
        <Lightbox.Backdrop />
        <Lightbox.Content>
          <Lightbox.Slides>
            <Lightbox.Slide>
              <Lightbox.Item index={0}>
                {({ imageRef }) => <Image ref={imageRef} src={photo} alt="" sizes="100vw" priority />}
              </Lightbox.Item>
            </Lightbox.Slide>
          </Lightbox.Slides>
        </Lightbox.Content>
      </Lightbox.Portal>
    </Lightbox.Root>
  );
}
