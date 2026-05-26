'use client';

import { ChevronLeft, ChevronRight, Star } from 'lucide-react';
import { ScrollGallery } from 'ramka';
import { COLOR_CLASSES } from '../../_components/colors';
import { ExampleShell } from '../../_components/example-shell';
import { IconButton } from '../../_components/icon-button';
import { testimonials } from '../../_data/testimonials';

export default function Page() {
  return (
    <ExampleShell
      title="Testimonials"
      description="A real-world testimonial carousel: center-snapping cards, dash-style markers, and edge fades to hint at off-screen content."
    >
      <ScrollGallery.Root defaultValue={0}>
        <div className="relative">
          <ScrollGallery.Viewport
            aria-label="Customer testimonials"
            style={{
              display: 'flex',
              gap: 16,
              overflowX: 'auto',
              overscrollBehaviorX: 'contain',
              scrollSnapType: 'x mandatory',
              scrollPaddingInline: 'calc(50% - 220px)',
              scrollbarWidth: 'none',
              paddingBlock: 4,
            }}
          >
            {testimonials.map((t, i) => {
              const c = COLOR_CLASSES[t.color];
              return (
                <ScrollGallery.Item
                  key={i}
                  style={{ scrollSnapAlign: 'center', flexShrink: 0, width: 440 }}
                  className="group"
                >
                  <div className="flex h-full flex-col gap-4 rounded-xl border border-neutral-200 bg-white p-6 shadow-sm transition group-data-[active]:shadow-md dark:border-neutral-800 dark:bg-neutral-900">
                    <div className="flex gap-0.5 text-yellow-400">
                      {Array.from({ length: 5 }, (_, idx) => (
                        <Star
                          key={idx}
                          className="h-4 w-4"
                          fill={idx < t.rating ? 'currentColor' : 'none'}
                          strokeWidth={1.5}
                        />
                      ))}
                    </div>
                    <p className="text-base italic leading-relaxed text-neutral-700 dark:text-neutral-300">
                      &ldquo;{t.quote}&rdquo;
                    </p>
                    <div className="mt-auto flex items-center gap-3 border-t border-neutral-200 pt-4 dark:border-neutral-800">
                      <div
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white ${c.avatarBg}`}
                      >
                        {t.initials}
                      </div>
                      <div>
                        <div className="text-sm font-bold text-neutral-900 dark:text-neutral-50">{t.author}</div>
                        <div className="text-xs text-neutral-500">{t.title}</div>
                      </div>
                    </div>
                  </div>
                </ScrollGallery.Item>
              );
            })}
          </ScrollGallery.Viewport>

          <ScrollGallery.Previous
            aria-label="Previous testimonial"
            step={1}
            className="absolute left-2 top-1/2 -translate-y-1/2"
            render={
              <IconButton className="border-transparent !bg-white shadow-md dark:!bg-neutral-900" />
            }
          >
            <ChevronLeft className="h-5 w-5" />
          </ScrollGallery.Previous>

          <ScrollGallery.Next
            aria-label="Next testimonial"
            step={1}
            className="absolute right-2 top-1/2 -translate-y-1/2"
            render={
              <IconButton className="border-transparent !bg-white shadow-md dark:!bg-neutral-900" />
            }
          >
            <ChevronRight className="h-5 w-5" />
          </ScrollGallery.Next>
        </div>

        <ScrollGallery.ScrollMarkerGroup aria-label="Choose testimonial" className="mt-6 flex justify-center gap-2">
          {testimonials.map((_, i) => (
            <ScrollGallery.ScrollMarker
              key={i}
              index={i}
              render={(props, state) => (
                <button
                  {...props}
                  aria-label={`Testimonial ${i + 1}`}
                  className={`h-1.5 cursor-pointer rounded-full border-0 p-0 transition-all ${
                    state.active
                      ? 'w-8 bg-neutral-900 dark:bg-neutral-100'
                      : 'w-1.5 bg-neutral-300 dark:bg-neutral-700'
                  }`}
                />
              )}
            />
          ))}
        </ScrollGallery.ScrollMarkerGroup>
      </ScrollGallery.Root>
    </ExampleShell>
  );
}
