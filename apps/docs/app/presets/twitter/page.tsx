import { ComponentPreview } from '../../_components/component-preview';
import { ExampleShell } from '../../_components/example-shell';
import { readSourceFiles } from '../../_components/read-source-files';
import { TwitterPresetDemo } from './demo';

export default async function TwitterLightboxPresetPage() {
  const files = await readSourceFiles([
    {
      path: 'app/presets/twitter/lightbox.tsx',
      name: 'lightbox.tsx',
      group: 'package',
    },
    {
      path: 'app/presets/twitter/lightbox.css',
      name: 'lightbox.css',
      group: 'package',
    },
    {
      path: 'app/presets/twitter/demo.tsx',
      name: 'demo.tsx',
      group: 'example',
      note: 'App composition for the preview — uses Tailwind. Not part of the package; swap utility classes for your own tokens/CSS.',
    },
  ]);

  return (
    <ExampleShell
      title="Twitter"
      description={
        <>
          X-style split viewer: a semi-translucent dark media pane with close (top-left) and
          previous/next controls on the gallery edges, plus a white thread sidebar for post context
          and replies. Copy the{' '}
          <strong className="font-medium text-neutral-800 dark:text-neutral-200">Package</strong>{' '}
          files (<code className="text-xs">lightbox.tsx</code> +{' '}
          <code className="text-xs">lightbox.css</code>) into your design system, then wire triggers
          in your app. The{' '}
          <strong className="font-medium text-neutral-800 dark:text-neutral-200">Example</strong>{' '}
          tab shows a tweet card with a 2×2 media grid (Tailwind layout only).
        </>
      }
      docsHref="/docs/lightbox"
      docsLabel="Lightbox overview"
    >
      <ComponentPreview files={files}>
        <TwitterPresetDemo />
      </ComponentPreview>
    </ExampleShell>
  );
}
