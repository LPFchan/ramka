import { Lightbox } from 'ramka';

/**
 * Root morphTo="closest" for indexes without their own trigger.
 *
 * @docsExcerpt morph-to-closest
 * @docsExcerptTitle morphTo="closest"
 */
export function MorphToClosestExcerpt() {
  return (
    <Lightbox.Root morphTo="closest">
      <Lightbox.Trigger index={0}>{/* first thumb */}</Lightbox.Trigger>
      <Lightbox.Trigger index={1}>{/* +N tile */}</Lightbox.Trigger>
      {/* items 2…n close to the nearest trigger */}
      <Lightbox.Content>
        <Lightbox.Item index={0} />
        <Lightbox.Item index={1} />
        <Lightbox.Item index={2} />
      </Lightbox.Content>
    </Lightbox.Root>
  );
}
