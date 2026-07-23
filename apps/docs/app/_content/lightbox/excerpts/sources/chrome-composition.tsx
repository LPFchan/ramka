import { Lightbox } from 'ramka';

declare const items: { id: string; src: string; thumb: string; alt: string; caption: string }[];

/**
 * Default gallery chrome: Counter + Close + Zoom + Slides + Caption + ThumbnailGroup.
 *
 * @docsExcerpt chrome-composition
 * @docsExcerptTitle Chrome composition
 */
export function ChromeCompositionExcerpt() {
  return (
    <Lightbox.Root>
      <Lightbox.Portal>
        <Lightbox.Backdrop />
        <Lightbox.Content>
          <Lightbox.Slides>
            {items.map((item, i) => (
              <Lightbox.Slide key={item.id}>
                <Lightbox.Item index={i} caption={item.caption}>
                  <Lightbox.Zoom>
                    <Lightbox.Media>
                      <img src={item.src} alt={item.alt} />
                    </Lightbox.Media>
                  </Lightbox.Zoom>
                </Lightbox.Item>
              </Lightbox.Slide>
            ))}
          </Lightbox.Slides>

          <Lightbox.Counter />
          <Lightbox.ZoomOut />
          <Lightbox.ZoomIn />
          <Lightbox.Close />

          <Lightbox.Caption />
          <Lightbox.ThumbnailGroup>
            {items.map((item, i) => (
              <Lightbox.Thumbnail key={item.id} index={i}>
                <img src={item.thumb} alt="" />
              </Lightbox.Thumbnail>
            ))}
          </Lightbox.ThumbnailGroup>
        </Lightbox.Content>
      </Lightbox.Portal>
    </Lightbox.Root>
  );
}
