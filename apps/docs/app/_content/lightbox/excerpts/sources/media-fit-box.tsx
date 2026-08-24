import * as Lightbox from '@ramka/react/lightbox';

declare const src: string;
declare const alt: string;
declare const width: number;
declare const height: number;

/**
 * Fill Content → Slides → Slide → Item → Zoom → Media. Media `width`/`height`
 * apply the structural inscribed fit-box (cosmetics like radius stay on className).
 * Resting chrome insets belong on Slide padding.
 *
 * @docsExcerpt media-fit-box
 * @docsExcerptTitle Media fill + fit-box
 */
export function MediaFitBoxExcerpt() {
  return (
    <Lightbox.Root>
      <Lightbox.Portal>
        <Lightbox.Backdrop />
        <Lightbox.Content className="fixed inset-0 flex flex-col">
          <Lightbox.Slides className="flex-1">
            <Lightbox.Slide className="h-full p-8">
              <Lightbox.Item index={0}>
                {/* Zoom fills the Slide content box; pad the Slide for chrome insets. */}
                <Lightbox.Zoom>
                  <Lightbox.Media width={width} height={height}>
                    <img width={width} height={height} src={src} alt={alt} />
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
