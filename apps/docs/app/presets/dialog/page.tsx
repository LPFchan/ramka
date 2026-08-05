import { ComponentPreview } from '../../_components/component-preview';
import { ExampleShell } from '../../_components/example-shell';
import { readSourceFiles } from '../../_components/read-source-files';
import { DialogPresetDemo } from './demo';

export default async function DialogLightboxPresetPage() {
  const files = await readSourceFiles([
    {
      path: 'app/presets/dialog/lightbox.tsx',
      name: 'lightbox.tsx',
      group: 'package',
    },
    {
      path: 'app/presets/dialog/lightbox.css',
      name: 'lightbox.css',
      group: 'package',
    },
    {
      path: 'app/presets/dialog/demo.tsx',
      name: 'demo.tsx',
      group: 'example',
      note: 'App composition for the preview — uses Tailwind. Not part of the package; swap utility classes for your own tokens/CSS.',
    },
  ]);

  return (
    <ExampleShell
      title="Dialog"
      description={
        <>
          The Lightbox as a morphing modal dialog — no slides, caption, or zoom. Drop the{' '}
          <strong className="font-medium text-neutral-800 dark:text-neutral-200">Package</strong>{' '}
          files (<code className="text-xs">lightbox.tsx</code> +{' '}
          <code className="text-xs">lightbox.css</code>) into a design-system entry, then compose
          triggers in your app. <code className="text-xs">Lightbox.Dialog</code> mounts a single{' '}
          <code className="text-xs">Item</code> whose <code className="text-xs">morphRef</code> is
          the centered panel, so the trigger button morphs smoothly into the dialog (triggers pass{' '}
          <code className="text-xs">crossfade=&quot;both&quot;</code> since button and dialog never
          share pixels). The{' '}
          <strong className="font-medium text-neutral-800 dark:text-neutral-200">Example</strong>{' '}
          tab shows a share dialog, a now-playing mini player, a calendar event, a payment-card
          editor, and a macOS-style confirmation alert — it uses Tailwind for layout and is not
          part of the skin.
        </>
      }
      docsHref="/docs/lightbox"
      docsLabel="Lightbox overview"
    >
      <ComponentPreview files={files}>
        <DialogPresetDemo />
      </ComponentPreview>
    </ExampleShell>
  );
}
