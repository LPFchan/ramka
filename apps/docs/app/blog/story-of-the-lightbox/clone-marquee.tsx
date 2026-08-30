/**
 * The clone wars, visualized: three slow marquee rows of real lightbox clone
 * names, every one transcribed verbatim from the Lightbox Clones Matrix
 * screenshot later in the article.
 *
 * Deliberately zero JavaScript, in an article that ends with an argument for
 * letting the platform do the work: a server component, a CSS transform
 * animation on the compositor, pause on hover. Under prefers-reduced-motion
 * the rows stop, drop their duplicates, and wrap into a static tag cloud.
 */

const ROWS: string[][] = [
  [
    'Thickbox',
    'jsOnlyLightbox',
    'Sexy Lightbox',
    'EasyBox',
    'Greybox Redux',
    'CeraBox',
    'prettyPhoto',
    'tinyLightbox',
    'LightBox Gone Wild',
    'simplebox',
    'Lytebox',
    'SlideWindow',
    'Floatbox',
    'CeeBox',
    'Lightbox+',
    'TopUp',
    'Facebox',
    'Bumpbox',
    'MOOdalbox',
    'ColorBox',
  ],
  [
    'Slimbox',
    'Suckerfish HoverLightbox Redux',
    'ImageZoom',
    'Fancybox',
    'Lighter Box',
    'Awesome Box',
    'piroBox',
    'Litebox',
    'mediaboxAdvanced',
    'Highslide',
    'Fancy Zoom for Prototype',
    'Sexy Lightbox2',
    'SubModal',
    'Shadowbox',
    'TALCIBox',
    'YUI based lightbox',
    'WeebBox',
    'Lightview',
    'Enlargeit!',
    'Milkbox',
  ],
  [
    'Slightly ThickerBox',
    'Lightbox2',
    'nyroModal',
    'Greybox',
    'Smoothbox',
    'jQuery lightBox plugin',
    'RoeBox',
    'Control.Modal',
    'TinyBox',
    'Multibox',
    'LightWindow',
    'Imagebox',
    'Prototype Window',
    'Fancy Zoom for jQuery',
    'SWFbox',
    'Slightbox',
    'Leightbox',
    'ModalBox',
    'iBox',
    'Fancy Zoom',
  ],
];

const marqueeCss = `
@keyframes clone-marquee-scroll {
  from { transform: translateX(0); }
  to { transform: translateX(-50%); }
}
.clone-marquee-row {
  overflow: hidden;
  -webkit-mask-image: linear-gradient(to right, transparent, #000 2.5rem, #000 calc(100% - 2.5rem), transparent);
  mask-image: linear-gradient(to right, transparent, #000 2.5rem, #000 calc(100% - 2.5rem), transparent);
}
.clone-marquee-track {
  display: flex;
  width: max-content;
  animation: clone-marquee-scroll linear infinite;
}
.clone-marquee:hover .clone-marquee-track {
  animation-play-state: paused;
}
@media (prefers-reduced-motion: reduce) {
  .clone-marquee-row {
    -webkit-mask-image: none;
    mask-image: none;
  }
  .clone-marquee-track {
    animation: none;
    width: auto;
    flex-wrap: wrap;
  }
  .clone-marquee-track > [aria-hidden] {
    display: none;
  }
}
`;

function Pills({ names, hidden }: { names: string[]; hidden?: boolean }) {
  return (
    <span className="flex flex-wrap items-center gap-2 pe-2" aria-hidden={hidden || undefined}>
      {names.map((name) => (
        <span
          key={name}
          className="whitespace-nowrap rounded-full border border-neutral-200 px-3 py-1 text-[13px] text-neutral-600 dark:border-neutral-800 dark:text-neutral-400"
        >
          {name}
        </span>
      ))}
    </span>
  );
}

export function CloneMarquee() {
  // Offset durations so the rows drift out of phase instead of pulsing together.
  const durations = [72, 88, 64];
  return (
    <figure className="clone-marquee my-8">
      <style dangerouslySetInnerHTML={{ __html: marqueeCss }} />
      <div className="flex flex-col gap-2">
        {ROWS.map((names, i) => (
          <div key={i} className="clone-marquee-row">
            <div
              className="clone-marquee-track"
              style={{
                animationDuration: `${durations[i]}s`,
                animationDirection: i === 1 ? 'reverse' : undefined,
              }}
            >
              <Pills names={names} />
              {/* Second copy makes the loop seamless; hidden from screen readers. */}
              <Pills names={names} hidden />
            </div>
          </div>
        ))}
      </div>
      <figcaption className="mt-4 text-center text-[13px] leading-6 text-neutral-400 dark:text-neutral-500">
        Sixty real clones, every name verbatim from the 2008 Clone Matrix.{' '}
        <span className="motion-reduce:hidden">Hover to stop the flood.</span>
      </figcaption>
    </figure>
  );
}
