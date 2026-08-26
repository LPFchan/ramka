import * as Lightbox from '@ramka/react/lightbox';

declare const items: { id: string; src: string; alt: string }[];
declare function t(key: string, vars?: Record<string, unknown>): string;

/**
 * Every string a screen reader reads comes from the consumer — the library
 * ships none, so nothing it renders can be in the wrong language.
 *
 * @docsExcerpt i18n-copy
 * @docsExcerptTitle viewer.tsx
 */
export function I18nCopyExcerpt() {
  return (
    <Lightbox.Root dir="rtl">
      <Lightbox.Portal>
        <Lightbox.Content aria-label={t('viewer.dialog')}>
          {/* `aria-roledescription` replaces the word a screen reader would
              otherwise use for the role ("group"), so it has to be translated
              — an English "carousel" inside Hebrew speech is worse than the
              default. Name the carousel itself with `aria-label`, and leave
              the word "carousel" out of that name; the roledescription
              already says it. */}
          <Lightbox.Slides
            aria-label={t('viewer.photos')}
            aria-roledescription={t('viewer.carousel')}
          >
            {items.map((item, i) => (
              <Lightbox.Slide key={item.id}>
                {/* A slide is a `group`, and a group is not named by the text
                    inside it, so the caption names nothing. The APG carousel
                    pattern puts the position in the name instead — you have
                    the index and the count already. */}
                <Lightbox.Item
                  index={i}
                  aria-roledescription={t('viewer.slide')}
                  aria-label={t('viewer.position', { current: i + 1, total: items.length })}
                >
                  <Lightbox.Media>
                    <img src={item.src} alt={item.alt} />
                  </Lightbox.Media>
                </Lightbox.Item>
              </Lightbox.Slide>
            ))}
          </Lightbox.Slides>

          {/* Counter renders "1 / 7" by default. Digits are not English, but
              their formatting is a locale decision — pass children to run the
              numbers through Intl. */}
          <Lightbox.Counter>
            {({ current, total }) =>
              t('viewer.position', { current, total })
            }
          </Lightbox.Counter>

          <Lightbox.Previous aria-label={t('viewer.previous')} />
          <Lightbox.Next aria-label={t('viewer.next')} />
          <Lightbox.Close aria-label={t('viewer.close')} />
        </Lightbox.Content>
      </Lightbox.Portal>
    </Lightbox.Root>
  );
}
