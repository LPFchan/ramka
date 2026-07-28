import { ComponentPreview } from '../../_components/component-preview';
import { ExampleShell } from '../../_components/example-shell';
import { readSourceFiles } from '../../_components/read-source-files';
import { DefaultPresetDemo } from './demo';

export default async function DefaultLightboxPresetPage() {
  const files = await readSourceFiles([
    { path: 'app/presets/default/lightbox.tsx', name: 'lightbox.tsx' },
    { path: 'app/presets/default/lightbox.css', name: 'lightbox.css' },
  ]);

  return (
    <ExampleShell
      title="Default"
      description={
        <>
          Drop this skin into a design-system package (
          <code className="text-xs">lightbox.tsx</code> +{' '}
          <code className="text-xs">lightbox.css</code>
          ), then build app UI against{' '}
          <code className="text-xs">Lightbox.*</code>. The preview below is
          app-level only (user card, listing card with child{' '}
          <code className="text-xs">morphRef</code>,{' '}
          <code className="text-xs">+N</code> album) — not part of the package.
        </>
      }
      docsHref="/docs/lightbox"
      docsLabel="Lightbox overview"
    >
      <ComponentPreview files={files}>
        <DefaultPresetDemo />
      </ComponentPreview>
    </ExampleShell>
  );
}
