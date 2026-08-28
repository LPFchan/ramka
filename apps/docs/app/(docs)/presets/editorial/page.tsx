import type { Metadata } from 'next';

import { ComponentPreview } from '../../../_components/component-preview';
import { ExampleShell } from '../../../_components/example-shell';
import { readSourceFiles } from '../../../_components/read-source-files';
import { EditorialPresetDemo } from './demo';

export const metadata: Metadata = {
  title: 'Editorial lightbox preset',
  description:
    'A newsroom article-figure lightbox for React: near-black surface with a caption and credit block, built from ramka lightbox primitives.',
};

export default async function EditorialLightboxPresetPage() {
  const files = await readSourceFiles([
    {
      path: 'app/(docs)/presets/editorial/lightbox.tsx',
      name: 'lightbox.tsx',
      group: 'package',
    },
    {
      path: 'app/(docs)/presets/editorial/lightbox.css',
      name: 'lightbox.css',
      group: 'package',
    },
    {
      path: 'app/(docs)/presets/editorial/demo.tsx',
      name: 'demo.tsx',
      group: 'example',
      note: 'App composition for the preview — uses Tailwind. Not part of the package; swap utility classes for your own tokens/CSS.',
    },
  ]);

  return (
    <ExampleShell
      title="Editorial"
      description={
        <>
          The viewer newsrooms use for article figures: a near-black surface in both color schemes, a typography-forward
          caption and credit block under the media, and ghost controls. Keyboard-first, no zoom — a reading context, not
          an inspection one. Copy the{' '}
          <strong className="font-medium text-neutral-800 dark:text-neutral-200">Package</strong> files (
          <code className="text-xs">lightbox.tsx</code> + <code className="text-xs">lightbox.css</code>) into your
          design system, then wire triggers in your app. The{' '}
          <strong className="font-medium text-neutral-800 dark:text-neutral-200">Example</strong> tab shows an article
          excerpt whose inline figures open the viewer with their caption and credit.
        </>
      }
      docsHref="/docs/lightbox"
      docsLabel="Lightbox overview"
    >
      <ComponentPreview files={files} frame={false}>
        <EditorialPresetDemo />
      </ComponentPreview>
    </ExampleShell>
  );
}
