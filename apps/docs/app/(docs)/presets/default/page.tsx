import { ComponentPreview } from '../../../_components/component-preview';
import { ExampleShell } from '../../../_components/example-shell';
import { readSourceFiles } from '../../../_components/read-source-files';
import { DefaultPresetDemo } from './demo';

export default async function DefaultLightboxPresetPage() {
  const files = await readSourceFiles([
    {
      path: 'app/(docs)/presets/default/lightbox.tsx',
      name: 'lightbox.tsx',
      group: 'package',
    },
    {
      path: 'app/(docs)/presets/default/lightbox.css',
      name: 'lightbox.css',
      group: 'package',
    },
    {
      path: 'app/(docs)/presets/default/demo.tsx',
      name: 'demo.tsx',
      group: 'example',
      note: 'App composition for the preview — uses Tailwind. Not part of the package; swap utility classes for your own tokens/CSS.',
    },
  ]);

  return (
    <ExampleShell
      title="Default"
      description={
        <>
          Drop the <strong className="font-medium text-neutral-800 dark:text-neutral-200">Package</strong>{' '}
          files (<code className="text-xs">lightbox.tsx</code> +{' '}
          <code className="text-xs">lightbox.css</code>) into a design-system entry, then compose
          triggers in your app. Gallery includes a top-right <strong className="font-medium text-neutral-800 dark:text-neutral-200">Bleed / Snug</strong>{' '}
          toggle (desktop) to switch between full-width and aspect-sized slide tracks. The{' '}
          <strong className="font-medium text-neutral-800 dark:text-neutral-200">Example</strong> tab
          shows the live preview (<code className="text-xs">+N</code> crossfade, child{' '}
          <code className="text-xs">morphRef</code>, whole-trigger morph) — it uses Tailwind for
          layout and is not part of the skin.
        </>
      }
      docsHref="/docs/lightbox"
      docsLabel="Lightbox overview"
    >
      <ComponentPreview files={files} frame={false}>
        <DefaultPresetDemo />
      </ComponentPreview>
    </ExampleShell>
  );
}
