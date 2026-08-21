import * as Lightbox from 'ramka/lightbox';

declare const open: boolean;
declare const setOpen: (open: boolean) => void;
declare const value: number;
declare const setValue: (value: number) => void;

/**
 * Controlled open + active index on Root.
 *
 * @docsExcerpt controlled-state
 * @docsExcerptTitle Controlled open + value
 */
export function ControlledStateExcerpt() {
  return (
    <Lightbox.Root open={open} onOpenChange={setOpen} value={value} onValueChange={setValue}>
      {/* triggers + content */}
    </Lightbox.Root>
  );
}
