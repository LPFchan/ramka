import Image, { type StaticImageData } from 'next/image';
import { Lightbox } from 'ramka';

declare const photos: StaticImageData[];
declare const visible: number;

/**
 * +N extras have no trigger imageRef — blur those destinations only.
 *
 * @docsExcerpt nextjs-image-plus-n
 * @docsExcerptTitle Destination blur for +N extras
 */
export function NextjsImagePlusNExcerpt() {
  return (
    <Lightbox.Root morphTo="closest">
      {photos.slice(0, visible).map((photo, i) => (
        <Lightbox.Trigger key={photo.src} index={i} crossfade={i === visible - 1 ? 'both' : undefined}>
          {({ imageRef }) => <Image ref={imageRef} src={photo} alt="" placeholder="blur" />}
        </Lightbox.Trigger>
      ))}

      <Lightbox.Portal>
        <Lightbox.Backdrop />
        <Lightbox.Content>
          <Lightbox.Slides>
            {photos.map((photo, i) => (
              <Lightbox.Slide key={photo.src}>
                <Lightbox.Item index={i}>
                  <Lightbox.Zoom>
                    <Lightbox.Media width={photo.width} height={photo.height}>
                      <Image
                        src={photo}
                        alt=""
                        sizes="100vw"
                        priority
                        // Overflow indexes only — siblings with trigger thumbs stay clean.
                        {...(i >= visible ? { placeholder: 'blur' as const } : null)}
                      />
                    </Lightbox.Media>
                  </Lightbox.Zoom>
                </Lightbox.Item>
              </Lightbox.Slide>
            ))}
          </Lightbox.Slides>
        </Lightbox.Content>
      </Lightbox.Portal>
    </Lightbox.Root>
  );
}
