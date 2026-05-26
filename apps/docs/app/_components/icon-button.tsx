import * as React from 'react';

type IconButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement>;

/**
 * A small, neutral icon button used to render `ScrollGallery.Previous` /
 * `ScrollGallery.Next`. It is passed via the primitive's `render` prop so
 * the library wires up `type`, `disabled`, `data-disabled`, and `onClick`.
 */
export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { className = '', ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      {...props}
      className={`inline-flex h-9 w-9 items-center justify-center rounded-lg border border-neutral-200 bg-white text-neutral-700 transition hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300 dark:hover:bg-neutral-800 ${className}`}
    />
  );
});
