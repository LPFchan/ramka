import { Lightbox } from 'ramka';

declare const src: string;
declare const alt: string;
declare const width: number;
declare const height: number;
declare const ratio: number; // width / height

/**
 * Fill Content → Slides → Slide → Item → Zoom, then fit the image to the
 * largest rectangle of its intrinsic aspect ratio (container queries).
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
              {({ imageRef }) => (
                // Size container for cqw/cqh. Set --lightbox-fit-inset-* here
                // (or on an ancestor) to leave room for overlapping chrome at rest.
                <Lightbox.Zoom className="flex size-full items-center justify-center [container-type:size] [--lightbox-fit-inset-x:2rem] [--lightbox-fit-inset-y:4rem]">
                  <div
                    className="relative shrink-0"
                    style={{
                      width: `min(calc(100cqw - var(--lightbox-fit-inset-x, 0px)), calc((100cqh - var(--lightbox-fit-inset-y, 0px)) * ${ratio}))`,
                      aspectRatio: `${ratio}`,
                    }}
                  >
                    <img
                      ref={imageRef}
                      width={width}
                      height={height}
                      src={src}
                      alt={alt}
                      className="size-full object-cover"
                    />
                  </div>
                </Lightbox.Zoom>
              )}
            </Lightbox.Item>
          </Lightbox.Slide>
        </Lightbox.Slides>
      </Lightbox.Content>
    </Lightbox.Root>
  );
}
