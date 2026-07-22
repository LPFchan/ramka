import { Lightbox } from 'ramka';

declare const items: { id: string; src: string; alt: string }[];

/**
 * Slides carousel — Item (and Zoom) must live inside Slide.
 *
 * @docsExcerpt slides-nesting
 * @docsExcerptTitle Slides + Slide nesting
 */
export function SlidesNestingExcerpt() {
  return (
    <Lightbox.Root>
      <Lightbox.Content>
        <Lightbox.Slides preload={1}>
          {items.map((item, i) => (
            <Lightbox.Slide key={item.id}>
              <Lightbox.Item index={i}>
                {({ imageRef }) => <img ref={imageRef} src={item.src} alt={item.alt} />}
              </Lightbox.Item>
            </Lightbox.Slide>
          ))}
        </Lightbox.Slides>
      </Lightbox.Content>
    </Lightbox.Root>
  );
}
