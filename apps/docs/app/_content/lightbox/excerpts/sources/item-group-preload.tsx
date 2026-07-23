import { Lightbox } from 'ramka';

declare const items: { id: string; src: string; alt: string }[];

/**
 * ItemGroup swap layout with preload neighbors.
 *
 * @docsExcerpt item-group-preload
 * @docsExcerptTitle ItemGroup + preload
 */
export function ItemGroupPreloadExcerpt() {
  return (
    <Lightbox.Root>
      <Lightbox.Content>
        <Lightbox.ItemGroup preload={1}>
          {items.map((item, i) => (
            <Lightbox.Item key={item.id} index={i}>
              {({ active, visible }) =>
                visible ? (
                  <img
                    src={item.src}
                    alt={item.alt}
                    // Prefer active for expensive work; visible includes preload neighbors.
                    data-active={active || undefined}
                  />
                ) : null
              }
            </Lightbox.Item>
          ))}
        </Lightbox.ItemGroup>
      </Lightbox.Content>
    </Lightbox.Root>
  );
}
