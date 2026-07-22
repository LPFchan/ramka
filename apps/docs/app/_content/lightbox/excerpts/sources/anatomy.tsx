import { Lightbox } from 'ramka';

/**
 * Canonical compound-parts sketch for the Overview page.
 *
 * @docsExcerpt anatomy
 * @docsExcerptTitle Anatomy
 */
export function AnatomyExcerpt() {
  return (
    <Lightbox.Root>
      <Lightbox.Trigger index={0}>{/* thumb */}</Lightbox.Trigger>
      <Lightbox.Backdrop />
      <Lightbox.Content>
        <Lightbox.Close />
        <Lightbox.ItemGroup>
          <Lightbox.Item index={0}>{/* full image */}</Lightbox.Item>
        </Lightbox.ItemGroup>
        {/* or: Lightbox.Slides > Lightbox.Slide > Lightbox.Item */}
      </Lightbox.Content>
    </Lightbox.Root>
  );
}
