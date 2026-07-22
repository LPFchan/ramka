import Image, { type StaticImageData } from 'next/image';
import { Lightbox } from 'ramka';

declare const photo: StaticImageData;

/**
 * Non-image trigger — no Ramka thumb bridge; blur the destination.
 *
 * @docsExcerpt nextjs-image-non-image-trigger
 * @docsExcerptTitle Destination blur for non-image triggers
 */
export function NextjsImageNonImageTriggerExcerpt() {
  return (
    <Lightbox.Root>
      <Lightbox.Trigger index={0} crossfade="both">
        <div className="flex size-16 items-center justify-center rounded-full bg-sky-700 text-white">
          AC
        </div>
      </Lightbox.Trigger>

      <Lightbox.Content>
        <Lightbox.Slides>
          <Lightbox.Slide>
            <Lightbox.Item index={0}>
              <Lightbox.Zoom>
                <Lightbox.Media width={photo.width} height={photo.height}>
                  <Image
                    src={photo}
                    alt="Portrait"
                    sizes="100vw"
                    priority
                    placeholder="blur"
                  />
                </Lightbox.Media>
              </Lightbox.Zoom>
            </Lightbox.Item>
          </Lightbox.Slide>
        </Lightbox.Slides>
      </Lightbox.Content>
    </Lightbox.Root>
  );
}
