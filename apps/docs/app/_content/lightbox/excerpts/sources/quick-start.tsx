import * as Lightbox from '@ramka/react/lightbox';

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
        {/* Every string here is yours — the library ships none, so nothing it
            renders is ever in the wrong language. */}
        <Lightbox.Content aria-label="Photo viewer">
          <Lightbox.Slides aria-label="Photos" aria-roledescription="carousel">
            {items.map((item, i) => (
              <Lightbox.Slide key={item.id}>
                <Lightbox.Item
                  index={i}
                  caption={item.caption ?? item.alt}
                  aria-roledescription="slide"
                  aria-label={`${i + 1} of ${items.length}`}
                >
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
          <Lightbox.ZoomOut aria-label="Zoom out" />
          <Lightbox.ZoomIn aria-label="Zoom in" />
          <Lightbox.Close aria-label="Close" />
          <Lightbox.Caption />
        </Lightbox.Content>
      </Lightbox.Portal>
    </Lightbox.Root>
  );
}
