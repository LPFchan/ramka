import { Lightbox } from 'ramka';

declare const thumb: string;
declare const src: string;

/**
 * Minimal view-transition morph with imageRef on Trigger + Item.
 *
 * @docsExcerpt minimal-morph
 * @docsExcerptTitle Minimal morph
 */
export function MinimalMorphExcerpt() {
  return (
    <Lightbox.Root viewTransition morphTo="active">
      <Lightbox.Trigger index={0}>
        {({ imageRef }) => <img ref={imageRef} src={thumb} alt="" />}
      </Lightbox.Trigger>

      <Lightbox.Backdrop />
      <Lightbox.Content>
        <Lightbox.Item index={0}>
          {({ imageRef }) => <img ref={imageRef} src={src} alt="" />}
        </Lightbox.Item>
      </Lightbox.Content>
    </Lightbox.Root>
  );
}
