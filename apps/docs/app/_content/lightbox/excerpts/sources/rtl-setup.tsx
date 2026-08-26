import * as Lightbox from '@ramka/react/lightbox';

declare const images: { id: string; src: string; alt: string }[];

/**
 * `dir` on Root is the whole setup. It mirrors navigation, and it is written to
 * the Portal host as a `dir` attribute — so CSS direction follows it across the
 * portal boundary, even though the host mounts on `document.body`.
 *
 * This works whether the surrounding page is RTL or LTR, which makes it also
 * the way to scope one RTL viewer inside an LTR app.
 *
 * @docsExcerpt rtl-setup
 * @docsExcerptTitle Setting the direction
 */
export function RtlSetupExcerpt() {
  return (
    <Lightbox.Root dir="rtl">
      <Lightbox.Portal>
        <Lightbox.Backdrop />
        <Lightbox.Content aria-label="גלריית תמונות">
          <Lightbox.Slides>
            {images.map((img, i) => (
              <Lightbox.Slide key={img.id}>
                <Lightbox.Item index={i}>
                  <Lightbox.Media>
                    <img src={img.src} alt={img.alt} />
                  </Lightbox.Media>
                </Lightbox.Item>
              </Lightbox.Slide>
            ))}
          </Lightbox.Slides>
          <Lightbox.Close aria-label="סגירה" />
        </Lightbox.Content>
      </Lightbox.Portal>
    </Lightbox.Root>
  );
}
