import Image, { type StaticImageData } from 'next/image';
import * as Lightbox from '@ramka/react/lightbox';

// Static import in apps: `import photo from './photo.jpg'`
declare const photo: StaticImageData;
declare const squareThumb: StaticImageData;

/**
 * Don’t bake a different aspect into the trigger file (CDN w=h&fit=crop).
 *
 * @docsExcerpt morph-aspect-dont
 * @docsExcerptTitle Don’t — baked square crop
 */
export function MorphAspectDontExcerpt() {
  return (
    <Lightbox.Root>
      <Lightbox.Trigger index={0}>
        {({ imageRef }) => (
          // ❌ 1∶1 file. Media below is the full 3∶2 photo.
          <Image ref={imageRef} src={squareThumb} alt="Photo" className="size-full object-cover" />
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
