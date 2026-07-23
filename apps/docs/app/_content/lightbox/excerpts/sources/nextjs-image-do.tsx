import Image, { type StaticImageData } from 'next/image';
import { Lightbox } from 'ramka';

// Static import in apps: `import photo from './photo.jpg'` (blurDataURL is free).
declare const photo: StaticImageData;

/**
 * Blur on the trigger only. No placeholder on the destination Image.
 *
 * @docsExcerpt nextjs-image-do
 * @docsExcerptTitle Do — blur on trigger only
 */
export function NextjsImageDoExcerpt() {
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
                    <Image
                      src={photo}
                      alt="Photo"
                      sizes="100vw"
                      priority
                      // No placeholder — Ramka owns the open bridge.
                    />
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
