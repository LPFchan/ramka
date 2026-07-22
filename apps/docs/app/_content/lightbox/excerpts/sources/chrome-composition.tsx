import { Lightbox } from 'ramka';

declare const items: { id: string; src: string; thumb: string; alt: string; caption: string }[];

/**
 * Nav chrome + thumbnails beside Slides inside Content.
 *
 * @docsExcerpt chrome-composition
 * @docsExcerptTitle Chrome composition
 */
export function ChromeCompositionExcerpt() {
  return (
    <Lightbox.Root>
      <Lightbox.Content>
        <Lightbox.Close />
        <Lightbox.Previous />
        <Lightbox.Next />
        <Lightbox.Counter />
        <Lightbox.Caption />

        <Lightbox.Slides>
          {items.map((item, i) => (
            <Lightbox.Slide key={item.id}>
              <Lightbox.Item index={i} caption={item.caption}>
                <img src={item.src} alt={item.alt} />
              </Lightbox.Item>
            </Lightbox.Slide>
          ))}
        </Lightbox.Slides>

        <Lightbox.ThumbnailGroup>
          {items.map((item, i) => (
            <Lightbox.Thumbnail key={item.id} index={i}>
              <img src={item.thumb} alt="" />
            </Lightbox.Thumbnail>
          ))}
        </Lightbox.ThumbnailGroup>
      </Lightbox.Content>
    </Lightbox.Root>
  );
}
