import { Lightbox } from 'ramka';

declare const src: string;
declare const alt: string;
declare const width: number;
declare const height: number;

/**
 * Fill Content → Slides → Slide → Item → Zoom → Media. Media `width`/`height`
 * apply the structural inscribed fit-box (cosmetics like radius stay on className).
 * Resting chrome insets belong on Zoom padding.
 *
 * @docsExcerpt media-fit-box
 * @docsExcerptTitle Media fill + fit-box
 */
export function MediaFitBoxExcerpt() {
  return (
    <Lightbox.Root>
      <Lightbox.Content className="fixed inset-0 flex flex-col">
        <Lightbox.Slides className="flex-1">
          <Lightbox.Slide className="h-full">
            <Lightbox.Item index={0} className="size-full">
              {/* Zoom fills + size-contains; pad Zoom for chrome insets. */}
              <Lightbox.Zoom className="p-8">
                <Lightbox.Media width={width} height={height}>
                  <img
                    width={width}
                    height={height}
                    src={src}
                    alt={alt}
                    className="size-full"
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
