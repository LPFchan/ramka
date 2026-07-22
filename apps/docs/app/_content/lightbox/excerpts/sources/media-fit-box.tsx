import { Lightbox } from 'ramka';

declare const src: string;
declare const alt: string;
declare const width: number;
declare const height: number;

/**
 * Fill Content → Slides → Slide → Item → Zoom → Media. Media `width`/`height`
 * apply the structural inscribed fit-box (cosmetics like radius stay on className).
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
            <Lightbox.Item
              index={0}
              className="flex size-full items-center justify-center"
            >
              {/* Size container for cqw/cqh. Optional insetX/insetY (or
                  --lightbox-fit-inset-*) shrink the resting Media box. */}
              <Lightbox.Zoom className="flex size-full items-center justify-center [container-type:size]">
                <Lightbox.Media
                  width={width}
                  height={height}
                  insetX="2rem"
                  insetY="4rem"
                  className="relative"
                >
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
