import Image, { type StaticImageData } from 'next/image';
import * as Lightbox from 'ramka/lightbox';

// Static import in apps: `import photo from './photo.jpg'` (blurDataURL is free).
declare const photo: StaticImageData;

/**
 * Don’t put blur on the destination Image — it covers the thumb bridge.
 *
 * @docsExcerpt nextjs-image-dont
 * @docsExcerptTitle Don’t — blur on lightbox Image
 */
export function NextjsImageDontExcerpt() {
  return (
    <Lightbox.Root>
      <Lightbox.Trigger index={0}>
        {({ imageRef }) => (
          <Image ref={imageRef} src={photo} alt="Photo" className="aspect-square size-full object-cover" />
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
                      // ❌ Covers Ramka’s thumb bridge.
                      placeholder="blur"
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
