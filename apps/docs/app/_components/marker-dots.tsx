import { ScrollGallery } from 'react-image-gallery';

export function MarkerDots({ count }: { count: number }) {
  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <ScrollGallery.ScrollMarker
          key={i}
          index={i}
          render={(props, state) => (
            <button
              {...props}
              aria-label={`Go to item ${i + 1}`}
              className={`h-2 w-2 cursor-pointer rounded-full border-[1.5px] border-neutral-400 p-0 transition dark:border-neutral-600 ${
                state.active ? 'bg-neutral-900 dark:bg-neutral-100' : 'bg-transparent'
              }`}
            />
          )}
        />
      ))}
    </>
  );
}
