import * as Lightbox from 'ramka/lightbox';

declare const items: { id: string; src: string; thumb: string; alt: string; caption?: string }[];

/**
 * Getting-started quick start (home page) — default Slides + Zoom chrome.
 *
 * @docsExcerpt quick-start
 * @docsExcerptTitle App.tsx
 */
export function QuickStartExcerpt() {
  return (
    <Lightbox.Root>
      {items.map((item, i) => (
        <Lightbox.Trigger key={item.id} index={i}>
          {({ imageRef }) => <img ref={imageRef} src={item.thumb} alt={item.alt} />}
        </Lightbox.Trigger>
      ))}

      <Lightbox.Portal>
        <Lightbox.Backdrop />
        <Lightbox.Content>
          <Lightbox.Slides>
            {items.map((item, i) => (
              <Lightbox.Slide key={item.id}>
                <Lightbox.Item index={i} caption={item.caption ?? item.alt}>
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
        </Lightbox.Content>
      </Lightbox.Portal>
    </Lightbox.Root>
  );
}
