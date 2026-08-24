import * as Lightbox from '@ramka/react/lightbox';

declare const items: { id: string; src: string; alt: string }[];

/**
 * Slides carousel — Item (and Zoom → Media) must live inside Slide.
 * `preload` gates Item contents; use the Item render prop's `active` /
 * `visible` to distinguish the current slide from preload neighbors.
 *
 * @docsExcerpt slides-nesting
 * @docsExcerptTitle Slides + Slide nesting
 */
export function SlidesNestingExcerpt() {
  return (
    <Lightbox.Root>
      <Lightbox.Portal>
        <Lightbox.Backdrop />
        <Lightbox.Content>
          <Lightbox.Slides preload={1}>
            {items.map((item, i) => (
              <Lightbox.Slide key={item.id}>
                <Lightbox.Item index={i}>
                  <Lightbox.Zoom>
                    <Lightbox.Media>
                      <img src={item.src} alt={item.alt} />
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
