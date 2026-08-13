import { ComponentPreview } from '../../../_components/component-preview';
import { ExampleShell } from '../../../_components/example-shell';
import { readSourceFiles } from '../../../_components/read-source-files';
import { StoriesPresetDemo } from './demo';

export default async function StoriesLightboxPresetPage() {
  const files = await readSourceFiles([
    {
      path: 'app/(docs)/presets/stories/lightbox.tsx',
      name: 'lightbox.tsx',
      group: 'package',
    },
    {
      path: 'app/(docs)/presets/stories/lightbox.css',
      name: 'lightbox.css',
      group: 'package',
    },
    {
      path: 'app/(docs)/presets/stories/demo.tsx',
      name: 'demo.tsx',
      group: 'example',
      note: 'App composition for the preview — uses Tailwind. Not part of the package; swap utility classes for your own tokens/CSS.',
    },
  ]);

  return (
    <ExampleShell
      title="Stories"
      description={
        <>
          Instagram-style stories: a horizontal row of avatars, each dissolving into a vertical
          video via <code className="text-xs">crossfade=&quot;both&quot;</code> (the circle is not
          the 9:16 frame, so a geometry morph would look wrong). Inside the viewer, slides are a
          native snap scroller with a CSS view-timeline rotateY — cards hinge on their leading
          edge as they enter and on their trailing edge as they leave. Copy the{' '}
          <strong className="font-medium text-neutral-800 dark:text-neutral-200">Package</strong>{' '}
          files (<code className="text-xs">lightbox.tsx</code> +{' '}
          <code className="text-xs">lightbox.css</code>) into your design system, then wire
          triggers in your app.
        </>
      }
      docsHref="/docs/lightbox"
      docsLabel="Lightbox overview"
    >
      <ComponentPreview files={files} frame={false}>
        <StoriesPresetDemo />
      </ComponentPreview>
    </ExampleShell>
  );
}
