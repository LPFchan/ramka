import { Lightbox } from 'ramka';

declare const items: { id: string; src: string; thumb: string; alt: string }[];

/**
 * Getting-started quick start (home page).
 *
 * @docsExcerpt quick-start
 * @docsExcerptTitle App.tsx
 */
export function QuickStartExcerpt() {
  return (
    <Lightbox.Root viewTransition>
      {items.map((item, i) => (
        <Lightbox.Trigger key={item.id} index={i}>
          {({ imageRef }) => <img ref={imageRef} src={item.thumb} alt={item.alt} />}
        </Lightbox.Trigger>
      ))}

      <Lightbox.Backdrop />
      <Lightbox.Content>
        <Lightbox.Slides>
          {items.map((item, i) => (
            <Lightbox.Slide key={item.id}>
              <Lightbox.Item index={i}>
                {({ imageRef }) => <img ref={imageRef} src={item.src} alt={item.alt} />}
              </Lightbox.Item>
            </Lightbox.Slide>
          ))}
        </Lightbox.Slides>
      </Lightbox.Content>
    </Lightbox.Root>
  );
}
