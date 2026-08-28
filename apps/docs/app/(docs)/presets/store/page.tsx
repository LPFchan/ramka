import type { Metadata } from 'next';

import { ComponentPreview } from '../../../_components/component-preview';
import { ExampleShell } from '../../../_components/example-shell';
import { readSourceFiles } from '../../../_components/read-source-files';
import { StorePresetDemo } from './demo';

export const metadata: Metadata = {
  title: 'Store gallery lightbox preset',
  description:
    'An e-commerce product gallery lightbox for React: thumbnail rail and a buy panel with price, highlights, and a CTA, built from ramka lightbox primitives.',
};

export default async function StoreLightboxPresetPage() {
  const files = await readSourceFiles([
    {
      path: 'app/(docs)/presets/store/lightbox.tsx',
      name: 'lightbox.tsx',
      group: 'package',
    },
    {
      path: 'app/(docs)/presets/store/lightbox.css',
      name: 'lightbox.css',
      group: 'package',
    },
    {
      path: 'app/(docs)/presets/store/demo.tsx',
      name: 'demo.tsx',
      group: 'example',
      note: 'App composition for the preview — uses Tailwind. Not part of the package; swap utility classes for your own tokens/CSS.',
    },
  ]);

  return (
    <ExampleShell
      title="Store"
      description={
        <>
          A full commerce viewer: the media stage (vertical thumbnail rail, pager, corner zoom) sits beside a buy panel
          with price, highlights, and the add-to-cart CTA — on mobile the panel collapses into a sticky price + CTA bar,
          so the shopper never loses the buy button while inspecting photos. Copy the{' '}
          <strong className="font-medium text-neutral-800 dark:text-neutral-200">Package</strong> files (
          <code className="text-xs">lightbox.tsx</code> + <code className="text-xs">lightbox.css</code>) into your
          design system, then wire triggers in your app. The{' '}
          <strong className="font-medium text-neutral-800 dark:text-neutral-200">Example</strong> tab shows a product
          card whose thumbnails swap the main image, viewer navigation synced back so the close morph lands on the
          visible image, and add-to-cart state shared between the card and the viewer.
        </>
      }
      docsHref="/docs/lightbox"
      docsLabel="Lightbox overview"
    >
      <ComponentPreview files={files} frame={false}>
        <StorePresetDemo />
      </ComponentPreview>
    </ExampleShell>
  );
}
