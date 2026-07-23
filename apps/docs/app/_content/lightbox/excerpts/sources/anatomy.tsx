import { Lightbox } from 'ramka';

/**
 * Canonical compound-parts sketch for the Overview page.
 * Default layout: Slides → Slide → Item → Zoom → Media (ItemGroup is the swap alternative).
 *
 * @docsExcerpt anatomy
 * @docsExcerptTitle Anatomy
 */
export function AnatomyExcerpt() {
  return (
    <Lightbox.Root>
      <Lightbox.Trigger index={0}>{/* thumb */}</Lightbox.Trigger>
      <Lightbox.Portal>
        <Lightbox.Backdrop />
        <Lightbox.Content>
          <Lightbox.Slides>
            <Lightbox.Slide>
              <Lightbox.Item index={0}>
                <Lightbox.Zoom>
                  <Lightbox.Media>
                    <img alt="" />
                  </Lightbox.Media>
                </Lightbox.Zoom>
              </Lightbox.Item>
            </Lightbox.Slide>
          </Lightbox.Slides>
          <Lightbox.Counter />
          <Lightbox.ZoomOut />
          <Lightbox.ZoomIn />
          <Lightbox.Close />
          <Lightbox.Caption />
          {/* or stacked swap: Lightbox.ItemGroup > Lightbox.Item */}
        </Lightbox.Content>
      </Lightbox.Portal>
    </Lightbox.Root>
  );
}
