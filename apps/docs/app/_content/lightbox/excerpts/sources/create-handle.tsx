import { Lightbox } from 'ramka';

declare const images: { id: string; src: string; alt: string }[];

/**
 * Product gallery: thumbnails + a “View gallery” CTA share one createHandle.
 *
 * @docsExcerpt create-handle
 * @docsExcerptTitle createHandle
 */
export function CreateHandleExcerpt() {
  const lightbox = Lightbox.createHandle();

  return (
    <>
      <button type="button" onClick={() => lightbox.open(0, { triggerId: 'photo-0' })}>
        View gallery
      </button>

      {images.map((img, i) => (
        <Lightbox.Trigger key={img.id} handle={lightbox} id={`photo-${i}`} index={i}>
          <img src={img.src} alt={img.alt} />
        </Lightbox.Trigger>
      ))}

      <Lightbox.Root handle={lightbox}>
        <Lightbox.Backdrop />
        <Lightbox.Content>
          <Lightbox.Slides>
            {images.map((img, i) => (
              <Lightbox.Slide key={img.id}>
                <Lightbox.Item index={i}>
                  <Lightbox.Zoom>
                    <img src={img.src} alt={img.alt} />
                  </Lightbox.Zoom>
                </Lightbox.Item>
              </Lightbox.Slide>
            ))}
          </Lightbox.Slides>
          <Lightbox.Close />
        </Lightbox.Content>
      </Lightbox.Root>
    </>
  );
}
