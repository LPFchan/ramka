import * as Lightbox from '@ramka/react/lightbox';

/**
 * Immediate vs post-motion open callbacks.
 *
 * @docsExcerpt lifecycle-callbacks
 * @docsExcerptTitle Lifecycle callbacks
 */
export function LifecycleCallbacksExcerpt() {
  return (
    <Lightbox.Root
      onOpenChange={(open) => {
        // Fires immediately — sync URL / store here.
        void open;
      }}
      onOpenChangeComplete={(open) => {
        // Fires after enter/exit motion settles — cleanup / focus here.
        void open;
      }}
      onValueChange={(value, { source }) => {
        void value;
        void source; // 'trigger' | 'keyboard' | 'thumbnail' | 'button' | 'scroll' | 'imperative'
      }}
    >
      {/* … */}
    </Lightbox.Root>
  );
}
