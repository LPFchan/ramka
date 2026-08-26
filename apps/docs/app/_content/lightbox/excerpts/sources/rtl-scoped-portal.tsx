import * as React from 'react';
import * as Lightbox from '@ramka/react/lightbox';

declare const images: { id: string; src: string; alt: string }[];

/**
 * One RTL viewer inside an otherwise-LTR page. `Lightbox.Portal` defaults to
 * `document.body`, so a `dir` on your own wrapper never reaches the viewer —
 * give the Portal a host that carries `dir="rtl"` itself.
 *
 * @docsExcerpt rtl-scoped-portal
 * @docsExcerptTitle Scoping RTL to one viewer
 */
export function RtlScopedPortalExcerpt() {
  const [host, setHost] = React.useState<HTMLElement | null>(null);

  React.useEffect(() => {
    const el = document.createElement('div');
    el.dir = 'rtl';
    document.body.append(el);
    setHost(el);
    return () => el.remove();
  }, []);

  return (
    <Lightbox.Root dir="rtl">
      {/* Until the host exists, leave `container` unset so the viewer still
          portals to <body> — `container={null}` means "render in place". */}
      <Lightbox.Portal container={host ?? undefined}>
        <Lightbox.Backdrop />
        <Lightbox.Content aria-label="גלריית תמונות">
          <Lightbox.Slides>
            {images.map((img, i) => (
              <Lightbox.Slide key={img.id}>
                <Lightbox.Item index={i}>
                  <Lightbox.Media>
                    <img src={img.src} alt={img.alt} />
                  </Lightbox.Media>
                </Lightbox.Item>
              </Lightbox.Slide>
            ))}
          </Lightbox.Slides>
        </Lightbox.Content>
      </Lightbox.Portal>
    </Lightbox.Root>
  );
}
