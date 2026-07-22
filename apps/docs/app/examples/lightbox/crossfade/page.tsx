import { ExampleShell } from '../../../_components/example-shell';
import { LightboxCrossfadeDemos } from '../../../docs/lightbox/crossfade-demos';

const code = 'rounded bg-neutral-100 px-1 py-0.5 text-xs dark:bg-neutral-800';

export default function CrossfadePage() {
  return (
    <ExampleShell
      title="Trigger crossfade"
      docsHref="/docs/lightbox/view-transitions#crossfade"
      docsLabel="View transitions → Trigger crossfade"
      description={
        <>
          Alias of the live demos on the Lightbox docs. Prefer reading{' '}
          <code className={code}>crossfade</code> rules there; this page exists for the Examples nav.
        </>
      }
    >
      <div className="mx-auto max-w-2xl">
        <LightboxCrossfadeDemos />
      </div>
    </ExampleShell>
  );
}
