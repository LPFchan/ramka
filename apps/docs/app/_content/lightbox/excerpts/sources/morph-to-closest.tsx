import * as Lightbox from 'ramka/lightbox';

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
      <Lightbox.Portal>
        <Lightbox.Backdrop />
        <Lightbox.Content>
          <Lightbox.Slides>
            <Lightbox.Slide>
              <Lightbox.Item index={0} />
            </Lightbox.Slide>
            <Lightbox.Slide>
              <Lightbox.Item index={1} />
            </Lightbox.Slide>
            <Lightbox.Slide>
              <Lightbox.Item index={2} />
            </Lightbox.Slide>
          </Lightbox.Slides>
        </Lightbox.Content>
      </Lightbox.Portal>
    </Lightbox.Root>
  );
}
