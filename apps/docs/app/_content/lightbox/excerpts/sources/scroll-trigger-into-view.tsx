import { Lightbox } from 'ramka';

/**
 * Keep the close-morph trigger on-screen while navigating.
 *
 * @docsExcerpt scroll-trigger-into-view
 * @docsExcerptTitle scrollTriggerIntoView
 */
export function ScrollTriggerIntoViewExcerpt() {
  return (
    <Lightbox.Root
      scrollTriggerIntoView={[
        { type: 'onChange', behavior: 'instant' },
        { type: 'onOpenComplete', behavior: 'instant' },
      ]}
    >
      {/* triggers + content */}
    </Lightbox.Root>
  );
}
