import * as Lightbox from '@ramka/react/lightbox';

declare const images: { id: string; src: string; alt: string }[];

/**
 * A fully RTL app: `dir` on <html> styles every layer, including the portaled
 * viewer, and the matching `dir` prop mirrors the lightbox's own behaviour.
 *
 * @docsExcerpt rtl-setup
 * @docsExcerptTitle Whole-app RTL
 */
export function RtlSetupExcerpt() {
  return (
    // In Next.js this is `<html lang="he" dir="rtl">` in your root layout.
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
