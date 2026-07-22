import { CodeBlock } from '../../../_components/code-block';
import { DocsDemo } from '../../../_components/docs-demo';
import { DocsLink } from '../../../_components/docs-link';
import { DocsPager } from '../../../_components/docs-pager';
import { DocsSection, DocsShell, type DocsTocItem } from '../../../_components/docs-shell';
import { PropSectionTitle } from '../../../_components/prop-section-title';
import { lightboxApiHref, lightboxDocsPages } from '../../../_content/lightbox/docs-pages';
import { lightboxExcerpts } from '../../../_content/lightbox/excerpts/generated';
import { LightboxCrossfadeDemos } from '../crossfade-demos';
import { LightboxMorphToDemos } from '../morph-to-demos';

const toc: DocsTocItem[] = [
  { id: 'enable', title: 'Enable + refs' },
  { id: 'crossfade', title: 'Trigger crossfade' },
  { id: 'morph-to', title: 'Root morphTo' },
  { id: 'scroll-trigger', title: 'scrollTriggerIntoView' },
  { id: 'programmatic', title: 'Programmatic open' },
  { id: 'styling', title: 'Styling hooks' },
];

export default function LightboxViewTransitionsPage() {
  return (
    <DocsShell
      title="View transitions"
      description={
        <>
          Morph open/close between a trigger and the active item with the browser View Transitions API.
          Part of{' '}
          <DocsLink href={lightboxDocsPages.overview.href}>Lightbox</DocsLink>. Unsupported browsers,
          reduced-motion, and low-end devices fall back to a plain fade.
        </>
      }
      toc={toc}
    >
      <DocsSection id="enable" title="Enable + refs">
        <p>
          Set <code className="text-xs">viewTransition</code> on{' '}
          <DocsLink href={lightboxApiHref.root}>Root</DocsLink>. Prefer render-prop children on{' '}
          <DocsLink href={lightboxApiHref.trigger}>Trigger</DocsLink> and{' '}
          <DocsLink href={lightboxApiHref.item}>Item</DocsLink> so you can attach:
        </p>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <code className="text-xs">imageRef</code> — put on the <code className="text-xs">&lt;img&gt;</code>{' '}
            whose pixels should bridge the morph (thumb on Trigger, destination image on Item). Lets
            open reuse an already-decoded bitmap so the transition doesn’t flash empty space.
          </li>
          <li>
            <code className="text-xs">morphRef</code> — optional. Put on a larger element when the morph
            bounds should be bigger than the image alone (tile with overlay, swatch + label). Default
            is the whole Trigger / Item host.
          </li>
        </ul>
        <p>
          Nested wrappers can use{' '}
          <DocsLink href={lightboxApiHref.useTriggerContext}>useLightboxTriggerContext</DocsLink> /{' '}
          <DocsLink href={lightboxApiHref.useItemContext}>useLightboxItemContext</DocsLink> instead of
          threading the render prop. Use <code className="text-xs">awaitImageDecode</code> on{' '}
          <DocsLink href={lightboxApiHref.root}>Root</DocsLink> when you want a short wait for the
          destination image before the morph starts (default ~200ms cap).
        </p>
        <CodeBlock
          code={lightboxExcerpts['minimal-morph'].code}
          title={lightboxExcerpts['minimal-morph'].title}
        />
      </DocsSection>

      <DocsSection
        id="crossfade"
        title={
          <PropSectionTitle
            partHref={lightboxApiHref.trigger}
            part="Trigger"
            prop="crossfade"
            sectionId="crossfade"
          />
        }
      >
        <p>
          Controls whether the morph <em>dissolves</em> between trigger and item snapshots or
          hard-cuts geometry only.
        </p>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong className="font-medium text-neutral-800 dark:text-neutral-200">Omit (default)</strong>{' '}
            — hard-cut. Best when trigger and item show the <em>same</em> picture (different crop/size
            is fine). Sets <code className="text-xs">data-lightbox-no-crossfade</code> on{' '}
            <code className="text-xs">&lt;html&gt;</code> during the transition.
          </li>
          <li>
            <code className="text-xs">both</code> — dissolve on open and close (stack → single photo,
            +N overlay tile, etc.).
          </li>
          <li>
            <code className="text-xs">open</code> / <code className="text-xs">close</code> — dissolve in
            one direction only (e.g. poster → live video often wants{' '}
            <code className="text-xs">close</code>).
          </li>
        </ul>
        <p>
          Keep trigger and item images on <code className="text-xs">object-fit: cover</code> (or the
          same fit) so crops stay coherent. Put border-radius on the morph target itself — the library
          interpolates <code className="text-xs">--lightbox-morph-border-radius-from/to</code> on{' '}
          <code className="text-xs">&lt;html&gt;</code>.
        </p>
        <DocsDemo
          code={lightboxExcerpts['crossfade-both'].code}
          title={lightboxExcerpts['crossfade-both'].title}
        >
          <LightboxCrossfadeDemos />
        </DocsDemo>
      </DocsSection>

      <DocsSection
        id="morph-to"
        title={
          <PropSectionTitle
            partHref={lightboxApiHref.root}
            part="Root"
            prop="morphTo"
            sectionId="morph-to"
          />
        }
      >
        <p>
          Picks which trigger receives the <em>close</em> morph:
        </p>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <code className="text-xs">active</code> (default) — trigger for the current active index.
            No morph if that index has no trigger.
          </li>
          <li>
            <code className="text-xs">origin</code> — always the trigger that opened the lightbox
            (one tile opens many items).
          </li>
          <li>
            <code className="text-xs">closest</code> — active index if registered, otherwise the nearest
            registered trigger.
          </li>
        </ul>
        <DocsDemo
          code={lightboxExcerpts['morph-to-closest'].code}
          title={lightboxExcerpts['morph-to-closest'].title}
        >
          <LightboxMorphToDemos />
        </DocsDemo>
      </DocsSection>

      <DocsSection
        id="scroll-trigger"
        title={
          <PropSectionTitle
            partHref={lightboxApiHref.root}
            part="Root"
            prop="scrollTriggerIntoView"
            sectionId="scroll-trigger"
          />
        }
      >
        <p>
          When the page scrolls while the lightbox is open, the close morph can land off-screen. Use{' '}
          <code className="text-xs">scrollTriggerIntoView</code> to keep the target trigger in view:
        </p>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <code className="text-xs">onChange</code> — scroll to the active trigger as the index changes
            (preemptive).
          </li>
          <li>
            <code className="text-xs">onOpenComplete</code> — reposition once open settles (invisible under
            the overlay; <code className="text-xs">instant</code> recommended).
          </li>
          <li>
            <code className="text-xs">onClose</code> — scroll just before the close morph (visible jump at
            close start).
          </li>
        </ul>
        <p>
          Pass one option or an array. Pair with <code className="text-xs">morphTo</code> so the scrolled
          element is the same one that receives the morph.
        </p>
        <CodeBlock
          code={lightboxExcerpts['scroll-trigger-into-view'].code}
          title={lightboxExcerpts['scroll-trigger-into-view'].title}
        />
      </DocsSection>

      <DocsSection id="programmatic" title="Programmatic open">
        <p>
          Prefer{' '}
          <DocsLink href={lightboxApiHref.createHandle}>createHandle()</DocsLink>:{' '}
          <code className="text-xs">open(index, {'{ triggerId }'})</code> associates a Trigger that
          declared that <code className="text-xs">id</code> so the open morph can use that element.
          Without a registered trigger (or <code className="text-xs">triggerId</code>), the open falls
          back to the fade path. Trigger clicks still morph. Demo:{' '}
          <DocsLink href={`${lightboxDocsPages.stateLifecycle.href}#imperative`}>
            State & lifecycle → Imperative API
          </DocsLink>
          .
        </p>
      </DocsSection>

      <DocsSection id="styling" title="Styling hooks">
        <p>
          During a morph, ramka sets document-level attributes and CSS variables so you can style{' '}
          <code className="text-xs">::view-transition-*</code> without shipping library CSS. Full tables
          live under{' '}
          <DocsLink href={lightboxApiHref.documentVt}>Document (view transitions)</DocsLink> in the API
          reference. Highlights:
        </p>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <code className="text-xs">data-lightbox-view-transition</code> —{' '}
            <code className="text-xs">opening</code> | <code className="text-xs">closing</code>
          </li>
          <li>
            <code className="text-xs">data-lightbox-no-crossfade</code> — hard-cut path
          </li>
          <li>
            <code className="text-xs">--lightbox-morph-border-radius-from/to</code>,{' '}
            <code className="text-xs">--lightbox-morph-old/new-opacity</code>
          </li>
          <li>
            <DocsLink href={lightboxApiHref.trigger}>Trigger</DocsLink>{' '}
            <code className="text-xs">data-morph-target</code> /{' '}
            <DocsLink href={lightboxApiHref.item}>Item</DocsLink>{' '}
            <code className="text-xs">data-skip-fade</code> — hide the live morph source and suppress
            entrance fades on the destination while the VT layer is up
          </li>
        </ul>
        <p>
          The docs site’s live VT CSS (excerpted from{' '}
          <code className="text-xs">app/lightbox-demo/view-transitions.css</code>):
        </p>
        <CodeBlock
          code={lightboxExcerpts['morph-border-radius'].code}
          title={lightboxExcerpts['morph-border-radius'].title}
          lang="css"
        />
        <CodeBlock
          code={lightboxExcerpts['no-crossfade-hard-cut'].code}
          title={lightboxExcerpts['no-crossfade-hard-cut'].title}
          lang="css"
        />
        <p>
          Lifecycle timing for your own CSS: Content/Backdrop stay <code className="text-xs">mounted</code>{' '}
          through exit animations; while a VT open is preparing they may be{' '}
          <code className="text-xs">visibility: hidden</code> so the morph layer owns the pixels. Prefer{' '}
          <code className="text-xs">onOpenChangeComplete</code> for post-motion work — see{' '}
          <DocsLink href="/examples/lightbox/lifecycle-callbacks">Lifecycle callbacks</DocsLink>.
        </p>
      </DocsSection>

      <DocsPager prev={lightboxDocsPages.composition} next={lightboxDocsPages.gestures} />
    </DocsShell>
  );
}
