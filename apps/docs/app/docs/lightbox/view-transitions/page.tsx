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
  { id: 'enable', title: 'Morph refs' },
  { id: 'crossfade', title: 'Trigger crossfade' },
  { id: 'morph-to', title: 'Root morphTo' },
  { id: 'scroll-trigger', title: 'scrollTriggerIntoView' },
  { id: 'programmatic', title: 'Programmatic open' },
  { id: 'styling', title: 'Styling' },
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
      <DocsSection id="enable" title="Morph refs">
        <p>
          Morph is on by default (<code className="text-xs">viewTransition</code> on{' '}
          <DocsLink href={lightboxApiHref.root}>Root</DocsLink>). Pass{' '}
          <code className="text-xs">viewTransition={'{false}'}</code> to opt out. Recommended destination
          shape: <DocsLink href={lightboxApiHref.media}>Lightbox.Media</DocsLink> around the{' '}
          <code className="text-xs">&lt;img&gt;</code> / <code className="text-xs">&lt;video&gt;</code>{' '}
          (sized fit-box = morph target + placeholder host). On{' '}
          <DocsLink href={lightboxApiHref.trigger}>Trigger</DocsLink>, prefer a render prop:
        </p>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <code className="text-xs">imageRef</code> — put on the Trigger thumb{' '}
            <code className="text-xs">&lt;img&gt;</code> whose pixels bridge the morph. Media
            auto-discovers the destination image (or video poster). Lets open reuse an already-decoded
            bitmap so the transition doesn’t flash empty space.
          </li>
          <li>
            <code className="text-xs">morphRef</code> — optional escape hatch when morph bounds should
            differ from Media / the image (tile with overlay, swatch + label).
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
            is fine). Leaves <code className="text-xs">data-ramka-crossfade</code> unset on{' '}
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

      <DocsSection id="styling" title="Styling">
        <p>
          Ramka is cosmetically unstyled: it sets document hooks during a morph so <em>your</em> CSS can
          drive <code className="text-xs">::view-transition-*</code> (and Media may apply a structural
          fit-box via <code className="text-xs">width</code>/<code className="text-xs">height</code>).
          Attribute / CSS-variable tables live under{' '}
          <DocsLink href={lightboxApiHref.documentVt}>Document (view transitions)</DocsLink>. Hooks:
        </p>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <code className="text-xs">data-ramka-view-transition</code> —{' '}
            <code className="text-xs">opening</code> | <code className="text-xs">closing</code>
          </li>
          <li>
            <code className="text-xs">data-ramka-crossfade</code> — dissolve path (present when Trigger
            <code className="text-xs">crossfade</code> is active for this phase; absent for hard-cut)
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
          The recipe below is what this docs site loads from{' '}
          <code className="text-xs">app/lightbox-demo/view-transitions.css</code> — copy and tune it for
          your app. Gate motion under{' '}
          <code className="text-xs">prefers-reduced-motion: no-preference</code> (the file does).
        </p>

        <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
          Isolate other view-transition names
        </h3>
        <p>
          <code className="text-xs">startViewTransition</code> snapshots the whole document. If a page
          element already has a <code className="text-xs">view-transition-name</code> (e.g. a photo grid),
          it becomes a separate VT group and can paint <em>over</em> the lightbox. While{' '}
          <code className="text-xs">data-ramka-view-transition</code> is set, clear every name; the morph
          target re-applies its name inline with <code className="text-xs">!important</code> so it stays
          the only captured group.
        </p>
        <CodeBlock
          code={lightboxExcerpts['vt-isolate-names'].code}
          title={lightboxExcerpts['vt-isolate-names'].title}
          lang="css"
        />

        <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
          Root snapshot timing
        </h3>
        <p>
          Keep a <em>single</em> root group for the page-behind crossfade. Do not promote Backdrop /
          Content into their own named groups — Safari pays heavily for that. Fade scrim and chrome with
          live <code className="text-xs">opacity</code> transitions instead of the root VT snapshot.
        </p>
        <CodeBlock
          code={lightboxExcerpts['vt-root-snapshot'].code}
          title={lightboxExcerpts['vt-root-snapshot'].title}
          lang="css"
        />

        <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
          Morph border-radius
        </h3>
        <p>
          Put radius on the morph target element. JS writes{' '}
          <code className="text-xs">--lightbox-morph-border-radius-from/to</code>; the group clips and
          interpolates shape for the whole transition.
        </p>
        <CodeBlock
          code={lightboxExcerpts['morph-border-radius'].code}
          title={lightboxExcerpts['morph-border-radius'].title}
          lang="css"
        />

        <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
          Morph snapshot fit
        </h3>
        <p>
          Default snapshots use <code className="text-xs">object-fit: cover</code> and{' '}
          <code className="text-xs">mix-blend-mode: plus-lighter</code> so same-image hard-cuts keep crops
          coherent. When dissolving (<code className="text-xs">data-ramka-crossfade</code>), switch
          to <code className="text-xs">fill</code> so circular triggers don’t “balloon” under cover — the
          group’s border-radius is the visible shape.
        </p>
        <CodeBlock
          code={lightboxExcerpts['vt-morph-snapshots'].code}
          title={lightboxExcerpts['vt-morph-snapshots'].title}
          lang="css"
        />

        <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
          Hard-cut (default morph)
        </h3>
        <p>
          When Trigger omits <code className="text-xs">crossfade</code>, ramka leaves{' '}
          <code className="text-xs">data-ramka-crossfade</code> unset. Kill the UA dissolve, drop{' '}
          <code className="text-xs">plus-lighter</code>, and drive opacity from{' '}
          <code className="text-xs">--lightbox-morph-old/new-opacity</code>.
        </p>
        <CodeBlock
          code={lightboxExcerpts['vt-hard-cut'].code}
          title={lightboxExcerpts['vt-hard-cut'].title}
          lang="css"
        />

        <p>
          Lifecycle timing for your own CSS: Content/Backdrop stay <code className="text-xs">mounted</code>{' '}
          through exit animations; while a VT open is preparing they may be{' '}
          <code className="text-xs">visibility: hidden</code> so the morph layer owns the pixels. Prefer{' '}
          <code className="text-xs">onOpenChangeComplete</code> for post-motion work — see{' '}
          <DocsLink href={`${lightboxDocsPages.stateLifecycle.href}#lifecycle`}>
            State & lifecycle → Lifecycle callbacks
          </DocsLink>
          .
        </p>
      </DocsSection>

      <DocsPager prev={lightboxDocsPages.nextjsImage} next={lightboxDocsPages.gestures} />
    </DocsShell>
  );
}
