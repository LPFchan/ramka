'use client';

import { notFound } from 'next/navigation';
import * as React from 'react';
import Image, { type StaticImageData } from 'next/image';
import * as Lightbox from '@ramka/react/lightbox';

import { ExampleShell } from '../../../_components/example-shell';
import {
  LightboxGallery,
  type LightboxGalleryItem,
  triggerFocusClass,
} from '../../../_components/lightbox-chrome';
import { inksPoster, moodboardSnugImages, plasticinePoster } from './images.generated';
import {
  FRAME_SIZE,
  LightboxScene,
  TriggerScene,
  moodboardProducts,
  waitForLightboxPainted,
  type MoodboardProduct,
} from './three-model';

/**
 * Mixed-media moodboard with snug lightbox: full-width slides on mobile;
 * aspect-sized snap cards + desktop thumbnail-strip on md+; sibling dim/zoom CSS.
 */

type ImageTile = {
  kind: 'image';
  id: string;
  alt: string;
  caption: string;
  image: StaticImageData;
};

type VideoTile = {
  kind: 'video';
  id: string;
  alt: string;
  caption: string;
  poster: StaticImageData;
  video: string;
};

type ModelTile = {
  kind: 'model';
  id: string;
  alt: string;
  caption: string;
  product: MoodboardProduct;
};

type Tile = ImageTile | VideoTile | ModelTile;

/** Short vertical Mixkit clips — full-frame vivid color, portrait (720×1280). */
const films = [
  {
    id: 'inks',
    title: 'Flowing colored inks',
    poster: inksPoster,
    video: 'https://assets.mixkit.co/videos/44793/44793-720.mp4',
  },
  {
    id: 'plasticine',
    title: 'Orange & teal plasticine',
    poster: plasticinePoster,
    video: 'https://assets.mixkit.co/videos/47332/47332-720.mp4',
  },
] as const;

const imageDefs = [
  { id: 'mb-s-01', alt: 'Foggy pine ridge at dawn', caption: 'Dawn ridge' },
  { id: 'mb-s-02', alt: 'Empty coastal highway', caption: 'Open road' },
  { id: 'mb-s-03', alt: 'Overhead of a linen breakfast table', caption: 'Slow morning' },
  { id: 'mb-s-04', alt: 'Narrow sunlit alley', caption: 'Warm alley' },
  { id: 'mb-s-05', alt: 'Wide desert dunes', caption: 'Dunes' },
  { id: 'mb-s-06', alt: 'Rain on a window', caption: 'Rainy glass' },
  { id: 'mb-s-07', alt: 'Calm lake reflection', caption: 'Still water' },
  { id: 'mb-s-08', alt: 'Tall concrete staircase', caption: 'Ascent' },
] as const;

/** Build a 12-tile wall: 7 photos, 2 vertical clips, 3 GLBs — mixed through the columns. */
function buildTiles(): Tile[] {
  const images: ImageTile[] = imageDefs.map((img, i) => ({
    kind: 'image',
    ...img,
    image: moodboardSnugImages[i]!,
  }));
  const [shoe, bottle, chair] = moodboardProducts;
  const [inks, plasticine] = films;

  // Column-friendly order (index % 3 for 3-col masonry):
  // video / model land in different columns and rows.
  return [
    images[0]!,
    {
      kind: 'video',
      id: inks.id,
      alt: inks.title,
      caption: inks.title,
      poster: inks.poster,
      video: inks.video,
    },
    images[1]!,
    {
      kind: 'model',
      id: shoe.id,
      alt: shoe.name,
      caption: `${shoe.name} · ${shoe.material}`,
      product: shoe,
    },
    images[2]!,
    images[3]!,
    {
      kind: 'video',
      id: plasticine.id,
      alt: plasticine.title,
      caption: plasticine.title,
      poster: plasticine.poster,
      video: plasticine.video,
    },
    images[4]!,
    {
      kind: 'model',
      id: chair.id,
      alt: chair.name,
      caption: `${chair.name} · ${chair.material}`,
      product: chair,
    },
    images[5]!,
    {
      kind: 'model',
      id: bottle.id,
      alt: bottle.name,
      caption: `${bottle.name} · ${bottle.material}`,
      product: bottle,
    },
    images[6]!,
  ];
}

const tiles = buildTiles();

function toGalleryItem(tile: Tile): LightboxGalleryItem {
  if (tile.kind === 'image') {
    return {
      id: tile.id,
      src: tile.image,
      thumb: tile.image,
      alt: tile.alt,
      caption: tile.caption,
    };
  }
  if (tile.kind === 'video') {
    return {
      id: tile.id,
      src: tile.poster,
      thumb: tile.poster,
      alt: tile.alt,
      caption: tile.caption,
      width: tile.poster.width,
      height: tile.poster.height,
    };
  }
  return {
    id: tile.id,
    src: tile.product.screenshot,
    thumb: tile.product.screenshot,
    alt: tile.alt,
    caption: tile.caption,
    width: FRAME_SIZE,
    height: FRAME_SIZE,
  };
}

const galleryItems = tiles.map(toGalleryItem);

/** Muted looping autoplay — used in the masonry trigger and lightbox Media. */
function AutoplayMuteVideo({
  src,
  poster,
  width,
  height,
  playing,
  className,
  videoRef: videoRefProp,
}: {
  src: string;
  poster: string;
  width: number;
  height: number;
  /** When false, pause (e.g. lightbox closed over this grid tile). */
  playing: boolean;
  className?: string;
  videoRef?: React.Ref<HTMLVideoElement | null>;
}) {
  const videoRef = React.useRef<HTMLVideoElement | null>(null);

  React.useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    el.muted = true;
    el.defaultMuted = true;
    el.volume = 0;
    if (playing) {
      el.play().catch(() => {});
    } else {
      el.pause();
    }
  }, [playing]);

  return (
    <video
      ref={(node) => {
        videoRef.current = node;
        if (typeof videoRefProp === 'function') videoRefProp(node);
        else if (videoRefProp) videoRefProp.current = node;
      }}
      src={src}
      poster={poster}
      width={width}
      height={height}
      muted
      playsInline
      autoPlay
      loop
      preload="auto"
      controls={false}
      disableRemotePlayback
      aria-label="Muted video"
      className={className}
    />
  );
}

function LightboxVideo({
  src,
  poster,
  /** Lightbox is open — still gated by viewport intersection below. */
  enabled,
  width,
  height,
}: {
  src: string;
  poster: string;
  enabled: boolean;
  width: number;
  height: number;
}) {
  const videoElRef = React.useRef<HTMLVideoElement | null>(null);
  // Optimistic true so open doesn’t hitch waiting for the first IO callback.
  const [inView, setInView] = React.useState(true);

  // Play while any part of the video intersects the screen (snug neighbors peek).
  React.useEffect(() => {
    const el = videoElRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        setInView(entry?.isIntersecting ?? false);
      },
      { root: null, threshold: 0 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <Lightbox.Zoom>
      <Lightbox.Media width={width} height={height} className="overflow-hidden rounded-none md:rounded-lg">
        <AutoplayMuteVideo
          src={src}
          poster={poster}
          width={width}
          height={height}
          videoRef={videoElRef}
          playing={enabled && inView}
          className="object-cover"
        />
      </Lightbox.Media>
    </Lightbox.Zoom>
  );
}

/** Responsive column count without CSS multicol (2 on mobile, 3 from `sm`). */
function useColumnCount() {
  const [cols, setCols] = React.useState(2);
  React.useEffect(() => {
    const mq = window.matchMedia('(min-width: 640px)');
    const update = () => setCols(mq.matches ? 3 : 2);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);
  return cols;
}

export default function MoodboardSnugPage() {
  if (process.env.NODE_ENV === 'production') {
    notFound();
  }

  const cols = useColumnCount();
  const [activeIndex, setActiveIndex] = React.useState(0);
  const activeIndexRef = React.useRef(0);

  const [open, setOpen] = React.useState(false);
  /** Orbit only after open settles — same gate as the 3d-models example. */
  const [orbitReady, setOrbitReady] = React.useState(false);

  const activeTile = tiles[activeIndex]!;
  // Videos stay chrome-free; photos + 3D share Zoom (trackpad pinch / buttons).
  const zoomControls = activeTile.kind !== 'video';

  const columns = React.useMemo(() => {
    const buckets: { tile: Tile; index: number }[][] = Array.from({ length: cols }, () => []);
    tiles.forEach((tile, i) => buckets[i % cols]!.push({ tile, index: i }));
    return buckets;
  }, [cols]);

  return (
    <ExampleShell
      title="Moodboard (snug slides)"
      description="Masonry wall with mixed media — photos, two muted autoplaying vertical clips, and three orbitable Khronos GLBs. Lightbox is snug on desktop (aspect-sized snap cards + gap, desktop thumbnail-strip) and full-width on mobile; sibling dim/blur while zoomed. 3D tiles wait for a painted WebGL frame via onBeforeOpen, then enable Trackball orbit after the morph settles."
    >
      <Lightbox.Root
        loop
        value={activeIndex}
        onValueChange={(next) => {
          // Sync before paint so `onBeforeOpen` sees the opening index.
          activeIndexRef.current = next;
          setActiveIndex(next);
        }}
        awaitImageDecode={false}
        scrollTriggerIntoView={[
          { type: 'onChange', behavior: 'instant' },
          { type: 'onOpenComplete', behavior: 'instant' },
        ]}
        onOpenChange={(nextOpen) => {
          setOpen(nextOpen);
          if (!nextOpen) setOrbitReady(false);
        }}
        onBeforeOpen={async ({ signal }) => {
          const tile = tiles[activeIndexRef.current];
          if (tile?.kind === 'model') {
            await waitForLightboxPainted(tile.product.id, { signal, timeoutMs: 2500 });
          }
        }}
        onOpenChangeComplete={(nextOpen) => {
          // Orbit only after open settles (avoid fighting the morph).
          setOrbitReady(nextOpen);
        }}
      >
        <div className="flex max-w-2xl gap-4">
          {columns.map((column, ci) => (
            <div key={ci} className="flex min-w-0 flex-1 flex-col gap-4">
              {column.map(({ tile, index }) => {
                if (tile.kind === 'image') {
                  return (
                    <Lightbox.Trigger
                      key={tile.id}
                      index={index}
                      className={`block w-full cursor-pointer overflow-hidden rounded-xl border-none bg-transparent p-0 ${triggerFocusClass}`}
                    >
                      {({ imageRef }) => (
                        <Image
                          ref={imageRef}
                          src={tile.image}
                          alt={tile.alt}
                          placeholder="blur"
                          sizes="(min-width: 640px) 224px, 50vw"
                          loading="lazy"
                          className="block h-auto w-full rounded-xl bg-neutral-100 object-cover transition duration-200 hover:opacity-90 dark:bg-neutral-800"
                        />
                      )}
                    </Lightbox.Trigger>
                  );
                }

                if (tile.kind === 'video') {
                  return (
                    <Lightbox.Trigger
                      key={tile.id}
                      index={index}
                      crossfade="close"
                      className={`block w-full cursor-pointer overflow-hidden rounded-xl border-none bg-transparent p-0 ${triggerFocusClass}`}
                    >
                      <AutoplayMuteVideo
                        src={tile.video}
                        poster={tile.poster.src}
                        width={tile.poster.width}
                        height={tile.poster.height}
                        // Keep the wall looping; pause only while this tile is open.
                        playing={!open || activeIndex !== index}
                        className="block w-full rounded-xl bg-neutral-100 object-cover transition duration-200 hover:opacity-90 dark:bg-neutral-800"
                      />
                    </Lightbox.Trigger>
                  );
                }

                // 3D — canvas in the trigger morphs to the lightbox canvas.
                return (
                  <Lightbox.Trigger
                    key={tile.id}
                    index={index}
                    crossfade="both"
                    className={`block w-full cursor-pointer overflow-hidden rounded-xl border-none bg-transparent p-0 ${triggerFocusClass}`}
                  >
                    {({ morphRef }) => (
                      <div
                        ref={morphRef}
                        className={`relative aspect-square w-full overflow-hidden rounded-xl bg-transparent`}
                      >
                        <TriggerScene
                          product={tile.product}
                          autoRotate={!open || activeIndex !== index}
                        />
                      </div>
                    )}
                  </Lightbox.Trigger>
                );
              })}
            </div>
          ))}
        </div>

        <LightboxGallery
          items={galleryItems}
          ariaLabel="Moodboard media"
          backdrop="solid"
          slidesLayout="snug"
          zoomControls={zoomControls}
          renderItem={(_item, i) => {
            const tile = tiles[i]!;
            if (tile.kind === 'video') {
              return (
                <LightboxVideo
                  src={tile.video}
                  poster={tile.poster.src}
                  enabled={open}
                  width={tile.poster.width}
                  height={tile.poster.height}
                />
              );
            }
            if (tile.kind === 'model') {
              const active = open && activeIndex === i;
              return (
                <Lightbox.Zoom maxZoom={6}>
                  <Lightbox.Media
                    width={FRAME_SIZE}
                    height={FRAME_SIZE}
                    className="overflow-hidden rounded-none bg-transparent md:rounded-lg"
                  >
                    <LightboxScene
                      product={tile.product}
                      // Same as 3d-models: orbit after settle; spin from reveal.
                      // Trackball keeps noZoom — Lightbox.Zoom owns pinch/trackpad zoom.
                      interactive={orbitReady && active}
                      autoRotate={active}
                    />
                  </Lightbox.Media>
                </Lightbox.Zoom>
              );
            }
            return (
              <Lightbox.Zoom maxZoom={6}>
                <Lightbox.Media
                  width={tile.image.width}
                  height={tile.image.height}
                  className="overflow-hidden rounded-none md:rounded-lg"
                >
                  <Image
                    src={tile.image}
                    alt={tile.alt}
                    sizes="100vw"
                    loading="eager"
                    draggable={false}
                    className="select-none"
                  />
                </Lightbox.Media>
              </Lightbox.Zoom>
            );
          }}
        />
      </Lightbox.Root>
    </ExampleShell>
  );
}
