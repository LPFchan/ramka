import * as React from 'react';
import { Lightbox } from 'ramka';

/**
 * Drive the lightbox from a Root ref.
 *
 * @docsExcerpt imperative-ref
 * @docsExcerptTitle Imperative Root ref
 */
export function ImperativeRefExcerpt() {
  const ref = React.useRef<Lightbox.LightboxRootRef | null>(null);

  return (
    <>
      <button type="button" onClick={() => ref.current?.open(0)}>
        Open
      </button>
      <button type="button" onClick={() => ref.current?.goTo(2)}>
        goTo(2)
      </button>
      <button type="button" onClick={() => ref.current?.close()}>
        Close
      </button>

      <Lightbox.Root ref={ref}>{/* content */}</Lightbox.Root>
    </>
  );
}
