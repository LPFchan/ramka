import type { Metadata } from 'next';

import { ExampleShell } from '../../../_components/example-shell';
import { PresetVariantPreview } from '../../../_components/preset-variant-preview';
import { readSourceFiles } from '../../../_components/read-source-files';
import { DefaultPresetDemo } from './demo';

export const metadata: Metadata = {
  title: 'Default lightbox preset',
  description:
    'A copy-paste React lightbox preset: morphing open, swipe navigation, zoom, thumbnails, and captions, styled like the ramka docs and ready for a design system.',
};

const demoFile = {
  path: 'app/(docs)/presets/default/demo.tsx',
  name: 'demo.tsx',
  group: 'example' as const,
  note: 'App composition for the preview — renders either variant. In your app, import one variant directly; trigger layout classes use Tailwind.',
};

export default async function DefaultLightboxPresetPage() {
  const [tailwindFiles, cssFiles] = await Promise.all([
    readSourceFiles([
      {
        path: 'app/(docs)/presets/default/tailwind/lightbox.tsx',
        name: 'lightbox.tsx',
        group: 'package',
        note: 'Single file, no stylesheet. Requires Tailwind CSS v4, the shadcn `cn` helper (@/lib/utils), and lucide-react.',
      },
      demoFile,
    ]),
    readSourceFiles([
      {
        path: 'app/(docs)/presets/default/css/lightbox.tsx',
        name: 'lightbox.tsx',
        group: 'package',
      },
      {
        path: 'app/(docs)/presets/default/css/lightbox.css',
        name: 'lightbox.css',
        group: 'package',
      },
      demoFile,
    ]),
  ]);

  return (
    <ExampleShell
      title="Default"
      description={
        <>
          Pick a styling flavor with the toggle:{' '}
          <strong className="font-medium text-neutral-800 dark:text-neutral-200">Tailwind</strong>{' '}
          is a single <code className="text-xs">lightbox.tsx</code> (utilities only, no
          stylesheet), <strong className="font-medium text-neutral-800 dark:text-neutral-200">CSS</strong>{' '}
          pairs <code className="text-xs">lightbox.tsx</code> with{' '}
          <code className="text-xs">lightbox.css</code>. Both export the identical styled{' '}
          <code className="text-xs">Lightbox</code> namespace — drop the{' '}
          <strong className="font-medium text-neutral-800 dark:text-neutral-200">Package</strong>{' '}
          files into a design-system entry, then compose triggers in your app. Gallery includes a
          top-right <strong className="font-medium text-neutral-800 dark:text-neutral-200">Bleed / Snug</strong>{' '}
          toggle (desktop) to switch between full-width and aspect-sized slide tracks. The{' '}
          <strong className="font-medium text-neutral-800 dark:text-neutral-200">Example</strong>{' '}
          tab shows the live preview (<code className="text-xs">+N</code> crossfade, child{' '}
          <code className="text-xs">morphRef</code>, whole-trigger morph) — it is app UI, not part
          of the skin.
        </>
      }
      docsHref="/docs/lightbox"
      docsLabel="Lightbox overview"
    >
      <PresetVariantPreview
        variants={[
          {
            id: 'tailwind',
            label: 'Tailwind',
            files: tailwindFiles,
            children: <DefaultPresetDemo variant="tailwind" />,
          },
          {
            id: 'css',
            label: 'CSS',
            files: cssFiles,
            children: <DefaultPresetDemo variant="css" />,
          },
        ]}
      />
    </ExampleShell>
  );
}
