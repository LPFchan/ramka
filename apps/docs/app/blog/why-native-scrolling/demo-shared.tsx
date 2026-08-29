'use client';

import { useEffect, useRef } from 'react';
import Image, { type StaticImageData } from 'next/image';

import { ramkaA, ramkaB, ramkaC, ramkaD, ramkaE, ramkaF, ramkaG } from '../../_components/images.generated';

export const STRIP_IMAGES: { src: StaticImageData; alt: string }[] = [
  { src: ramkaA, alt: 'Person standing in a sunlit meadow at golden hour' },
  { src: ramkaB, alt: 'Seashells scattered along the shoreline' },
  { src: ramkaC, alt: 'Curved building facade in black and white' },
  { src: ramkaD, alt: 'Airplane crossing a purple sky above the clouds' },
  { src: ramkaE, alt: 'Fog rolling over dark hills' },
  { src: ramkaF, alt: 'Aerial view of a road entering twin forest tunnels' },
  { src: ramkaG, alt: 'Bride seen through the windows of a vintage car' },
];

export function StripImage({ image }: { image: (typeof STRIP_IMAGES)[number] }) {
  return (
    <Image
      src={image.src}
      alt={image.alt}
      draggable={false}
      sizes="224px"
      className="h-36 w-56 shrink-0 select-none rounded-lg object-cover"
    />
  );
}

/** Chip label sitting above each strip. */
export function StripLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-2 text-[12px] font-medium tracking-wide text-neutral-500 uppercase dark:text-neutral-400">
      {children}
    </div>
  );
}

/**
 * The article's stand-in for a typical transform-emulated carousel: pointer
 * drag with velocity tracking, an exponential-decay momentum loop on release
 * (the reverse-engineered iOS constant, 0.95 per 60fps frame), rubber-banding
 * past the edges, and a non-passive wheel handler for trackpads.
 *
 * This is deliberately a GOOD implementation of the pattern. The article's
 * argument is not that this code is badly written; it is that every frame of
 * it runs on the main thread.
 */
export function TransformStrip({
  decelRef,
  ariaLabel,
}: {
  /** Per-frame velocity multiplier, read live so a slider can retune it. */
  decelRef?: React.RefObject<number>;
  ariaLabel: string;
}) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const viewport = viewportRef.current;
    const track = trackRef.current;
    if (!viewport || !track) return;

    let offset = 0;
    let velocity = 0; // px per 60fps frame
    let raf = 0;
    let dragging = false;
    let lastX = 0;
    let lastT = 0;

    const minOffset = () => Math.min(0, viewport.clientWidth - track.scrollWidth);

    /** Apple's Designing Fluid Interfaces rubber band, coefficient 0.55. */
    const rubber = (overshoot: number) => {
      const dim = viewport.clientWidth;
      return (overshoot * dim * 0.55) / (dim + 0.55 * Math.abs(overshoot));
    };

    const render = () => {
      let visual = offset;
      if (offset > 0) visual = rubber(offset);
      else if (offset < minOffset()) visual = minOffset() + rubber(offset - minOffset());
      track.style.transform = `translate3d(${visual}px, 0, 0)`;
    };

    const stop = () => cancelAnimationFrame(raf);

    const momentum = () => {
      let prev = performance.now();
      const tick = (now: number) => {
        const frames = Math.min((now - prev) / 16.7, 3);
        prev = now;
        const decel = decelRef?.current ?? 0.95;
        velocity *= Math.pow(decel, frames);
        offset += velocity * frames;

        // Past an edge: drop the fling and spring back to the bound.
        const min = minOffset();
        if (offset > 0) {
          velocity = 0;
          offset += (0 - offset) * 0.18;
          if (Math.abs(offset) < 0.5) offset = 0;
        } else if (offset < min) {
          velocity = 0;
          offset += (min - offset) * 0.18;
          if (Math.abs(offset - min) < 0.5) offset = min;
        }

        render();
        if (Math.abs(velocity) > 0.05 || (offset > 0 && offset !== 0) || (offset < min && offset !== min)) {
          raf = requestAnimationFrame(tick);
        }
      };
      raf = requestAnimationFrame(tick);
    };

    const onPointerDown = (e: PointerEvent) => {
      dragging = true;
      stop();
      velocity = 0;
      lastX = e.clientX;
      lastT = e.timeStamp;
      viewport.setPointerCapture(e.pointerId);
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!dragging) return;
      const dx = e.clientX - lastX;
      const dt = Math.max(e.timeStamp - lastT, 1);
      lastX = e.clientX;
      lastT = e.timeStamp;
      offset += dx;
      velocity = (dx / dt) * 16.7;
      render();
    };

    const onPointerUp = () => {
      if (!dragging) return;
      dragging = false;
      momentum();
    };

    // Trackpad support the way transform carousels do it: a wheel listener
    // that must be non-passive to call preventDefault. Horizontal intent only,
    // so vertical page scrolling stays untouched.
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
      e.preventDefault();
      stop();
      velocity = 0;
      offset = Math.max(minOffset(), Math.min(0, offset - e.deltaX));
      render();
    };

    viewport.addEventListener('pointerdown', onPointerDown);
    viewport.addEventListener('pointermove', onPointerMove);
    viewport.addEventListener('pointerup', onPointerUp);
    viewport.addEventListener('pointercancel', onPointerUp);
    viewport.addEventListener('wheel', onWheel, { passive: false });
    render();

    return () => {
      stop();
      viewport.removeEventListener('pointerdown', onPointerDown);
      viewport.removeEventListener('pointermove', onPointerMove);
      viewport.removeEventListener('pointerup', onPointerUp);
      viewport.removeEventListener('pointercancel', onPointerUp);
      viewport.removeEventListener('wheel', onWheel);
    };
  }, [decelRef]);

  return (
    <div
      ref={viewportRef}
      role="group"
      aria-label={ariaLabel}
      // overflow:hidden still makes this a scroll container as far as scroll
      // chaining is concerned, so containment here stops horizontal wheel
      // deltas the handler doesn't consume from becoming a back-swipe.
      className="cursor-grab touch-pan-y overflow-hidden overscroll-x-contain rounded-xl active:cursor-grabbing"
    >
      <div ref={trackRef} className="flex w-max gap-3 will-change-transform">
        {STRIP_IMAGES.map((image) => (
          <StripImage key={image.alt} image={image} />
        ))}
      </div>
    </div>
  );
}

/** The native counterpart: a real scroller. The browser does the rest. */
export function NativeStrip({ ariaLabel }: { ariaLabel: string }) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      tabIndex={0}
      className="scrollbar-thin flex gap-3 overflow-x-auto overscroll-x-contain overflow-y-hidden overscroll-y-none rounded-xl pb-2"
    >
      {STRIP_IMAGES.map((image) => (
        <StripImage key={image.alt} image={image} />
      ))}
    </div>
  );
}
