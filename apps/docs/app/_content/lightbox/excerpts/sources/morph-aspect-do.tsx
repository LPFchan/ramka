import Image, { type StaticImageData } from 'next/image';
import * as Lightbox from 'ramka/lightbox';

// Static import in apps: `import photo from './photo.jpg'`
declare const photo: StaticImageData;

/**
 * Same file for trigger and destination. Square tile is CSS object-cover.
 *
 * @docsExcerpt morph-aspect-do
 * @docsExcerptTitle Do — same source aspect
 */
export function MorphAspectDoExcerpt() {
  return (
    <Lightbox.Root>
      <Lightbox.Trigger index={0}>
        {({ imageRef }) => (
          <Image
            ref={imageRef}
            src={photo}
            alt="Photo"
            placeholder="blur"
            className="aspect-square size-full object-cover"
          />
        )}
      </Lightbox.Trigger>

      <Lightbox.Portal>
        <Lightbox.Backdrop />
        <Lightbox.Content>
          <Lightbox.Slides>
            <Lightbox.Slide>
              <Lightbox.Item index={0}>
                <Lightbox.Zoom>
                  <Lightbox.Media width={photo.width} height={photo.height}>
                    <Image src={photo} alt="Photo" sizes="100vw" priority />
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
