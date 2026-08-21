# Text message

iMessage-style chat with a single morphTo="origin" trigger over a stack of attachments.

## Source

```tsx examples/lightbox/text-message/page.tsx
'use client';

import Image from 'next/image';
import * as Lightbox from 'ramka/lightbox';

import { ExampleShell } from '../../../../_components/example-shell';
import {
  LightboxGallery,
  triggerFocusClass,
} from '../../../../_components/lightbox-chrome';
import { messageImageFiles } from './images.generated';

const messageImages = [
  {
    image: messageImageFiles[0]!,
    alt: 'Screenshot of a changelog notification',
  },
  {
    image: messageImageFiles[1]!,
    alt: 'Screenshot of a code review discussion',
    // Only the top of the stack registers an imageRef — the other attachments
    // rely on the destination Image's blur-up placeholder.
    destinationBlur: true,
  },
  {
    image: messageImageFiles[2]!,
    alt: 'Screenshot of a pull request overview',
    destinationBlur: true,
  },
].map((img) => ({ ...img, src: img.image, thumb: img.image }));

const stackRotations = [0, 2, -6];
const stackOffsets = [
  { x: 0, y: 0 },
  { x: 10, y: -4 },
  { x: -12, y: 8 },
];

export default function TextMessagePage() {
  return (
    <ExampleShell
      title="Text message"
      description={
        <>
          A single <code className="rounded bg-neutral-100 px-1 py-0.5 text-xs dark:bg-neutral-800">Lightbox.Trigger</code>{' '}
          wraps an entire stack of attachments. Paired with{' '}
          <code className="rounded bg-neutral-100 px-1 py-0.5 text-xs dark:bg-neutral-800">morphTo=&quot;origin&quot;</code>
          , the close animation always returns to the stack no matter which attachment is active.
        </>
      }
    >
      <div className="flex min-h-[80vh] items-end justify-end rounded-2xl bg-neutral-100 p-6 dark:bg-neutral-900">
        <Lightbox.Root morphTo="origin">
          <div className="flex max-w-[300px] flex-col items-end gap-3">
            <span className="text-[10px] font-medium uppercase tracking-[0.05em] text-neutral-500">
              Today at 11:11 AM
            </span>

            <div className="rounded-[20px] rounded-br-[4px] bg-blue-500 px-4 py-2 text-sm font-medium text-white">
              some imgs
            </div>

            <Lightbox.Trigger
              index={0}
              crossfade="close"
              className={`relative block h-80 w-[260px] cursor-pointer rounded-2xl border-none bg-transparent p-0 ${triggerFocusClass}`}
            >
              {({ morphRef, imageRef }) => (
                <div className="absolute -inset-5">
                  {messageImages.map((img, i) => {
                    const offset = stackOffsets[i] ?? { x: 0, y: 0 };
                    const rotation = stackRotations[i] ?? 0;
                    return (
                      <Image
                        key={img.alt}
                        src={img.image}
                        alt={img.alt}
                        placeholder="blur"
                        sizes="200px"
                        ref={
                          i === 0
                            ? (node) => {
                                morphRef(node);
                                imageRef(node);
                              }
                            : undefined
                        }
                        className="absolute block h-[280px] w-[200px] rounded-2xl object-cover shadow-[0_4px_20px_rgba(0,0,0,0.15)]"
                        style={{
                          left: '50%',
                          top: '50%',
                          transform: `translate(-50%, -50%) translate(${offset.x}px, ${offset.y}px) rotate(${rotation}deg)`,
                          zIndex: messageImages.length - i,
                        }}
                      />
                    );
                  })}
                </div>
              )}
            </Lightbox.Trigger>

            <div className="flex items-center gap-2 text-xs text-neutral-500">
              <svg
                aria-hidden
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
                className="opacity-40"
              >
                <rect x="1" y="3" width="6" height="5" rx="1" stroke="currentColor" strokeWidth="1.2" />
                <rect x="5" y="1" width="6" height="5" rx="1" stroke="currentColor" strokeWidth="1.2" fill="currentColor" fillOpacity="0" />
                <rect x="9" y="3" width="6" height="5" rx="1" stroke="currentColor" strokeWidth="1.2" fill="currentColor" fillOpacity="0" />
                <rect x="3" y="8" width="10" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.2" fill="currentColor" fillOpacity="0" />
              </svg>
              <span>{messageImages.length} attachments</span>
            </div>
          </div>

          <LightboxGallery items={messageImages} ariaLabel="Message attachments" />
        </Lightbox.Root>
      </div>
    </ExampleShell>
  );
}
```
