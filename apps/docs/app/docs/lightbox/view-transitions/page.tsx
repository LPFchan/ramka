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
  { id: 'timing-presets', title: 'Timing presets' },
  { id: 'injected-css', title: 'Injected CSS' },
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
          Pass one option or an array. Each option also accepts{' '}
          <code className="text-xs">block</code> / <code className="text-xs">inline</code> alignment
          (defaults <code className="text-xs">nearest</code>) — use{' '}
          <code className="text-xs">inline: &apos;center&apos;</code> for horizontal snap strips with
          variable-width tiles. Pair with <code className="text-xs">morphTo</code> so the scrolled
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
          You write <strong className="font-medium text-neutral-800 dark:text-neutral-200">zero</strong>{' '}
          view-transition CSS: the library injects the structural{' '}
          <code className="text-xs">::view-transition-*</code> rules itself (see{' '}
          <DocsLink href="#injected-css">Injected CSS</DocsLink>) and writes document hooks during a
          morph so your own skin CSS can react — e.g. keep Backdrop/Content fades on the morph&apos;s
          clock. Attribute / CSS-variable tables live under{' '}
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
            <code className="text-xs">data-ramka-vt-preset</code>,{' '}
            <code className="text-xs">--lightbox-vt-duration</code>,{' '}
            <code className="text-xs">--lightbox-vt-easing</code>,{' '}
            <code className="text-xs">--lightbox-vt-root-easing</code> — the active timing preset,
            written by the library (see <DocsLink href="#timing-presets">Timing presets</DocsLink>)
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
          Motion splits into{' '}
          <strong className="font-medium text-neutral-800 dark:text-neutral-200">timing</strong>{' '}
          (a preset picked on Root — see below) and{' '}
          <strong className="font-medium text-neutral-800 dark:text-neutral-200">structure</strong>{' '}
          (injected by the library). Your CSS only handles cosmetics — and reads the library-written
          contract vars where it wants to stay in sync.
        </p>
      </DocsSection>

      <DocsSection id="timing-presets" title="Timing presets">
        <p>
          Morph duration and easing are chosen with the{' '}
          <code className="text-xs">viewTransition</code> prop on{' '}
          <DocsLink href={lightboxApiHref.root}>Root</DocsLink> — pass a preset name instead of{' '}
          <code className="text-xs">true</code>:
        </p>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <code className="text-xs">&quot;default&quot;</code> — 360ms, sheet curve with a tamed
            launch (what <code className="text-xs">true</code> runs)
          </li>
          <li>
            <code className="text-xs">&quot;snappy&quot;</code> — 340ms, hotter launch; reads quicker
          </li>
          <li>
            <code className="text-xs">&quot;relaxed&quot;</code> — 400ms, softer launch and longer
            settle
          </li>
          <li>
            <code className="text-xs">&quot;spring&quot;</code> — 450ms, critically damped spring;
            Photos-style settle
          </li>
        </ul>
        <CodeBlock
          code={`<Lightbox.Root viewTransition="spring">{/* … */}</Lightbox.Root>`}
          title="Picking a preset"
          lang="tsx"
        />
        <p>
          Timing is preset-based rather than free-form CSS on purpose: each preset is vetted
          on-device to stay smooth and skip-safe on iOS Safari (including Low Power Mode) and
          Android, where arbitrary curves stutter or teleport. During a morph the library writes the
          active preset onto <code className="text-xs">documentElement</code> —{' '}
          <code className="text-xs">data-ramka-vt-preset</code> plus{' '}
          <code className="text-xs">--lightbox-vt-duration</code> /{' '}
          <code className="text-xs">--lightbox-vt-easing</code> /{' '}
          <code className="text-xs">--lightbox-vt-root-easing</code> — and clears them when it ends.
          Read those vars in your own CSS to keep skin fades in lockstep with the morph (e.g.{' '}
          <code className="text-xs">
            transition: opacity var(--lightbox-vt-duration, 340ms) ease-out
          </code>{' '}
          on Backdrop/Content); do not set them yourself.
        </p>
      </DocsSection>

      <DocsSection id="injected-css" title="Injected CSS">
        <p>
          On first <DocsLink href={lightboxApiHref.root}>Root</DocsLink> mount the library injects one
          stylesheet with everything a morph structurally needs — no copy-paste block to maintain, and
          multiple skins on one page can never fight over it:
        </p>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong className="font-medium text-neutral-800 dark:text-neutral-200">Name isolation</strong>{' '}
            — <code className="text-xs">startViewTransition</code> snapshots the whole document, so any
            page element with its own <code className="text-xs">view-transition-name</code> would paint{' '}
            <em>over</em> the lightbox. Every name is cleared while{' '}
            <code className="text-xs">data-ramka-view-transition</code> is set; the morph target
            re-applies its name inline with <code className="text-xs">!important</code> and stays the
            only captured group.
          </li>
          <li>
            <strong className="font-medium text-neutral-800 dark:text-neutral-200">Morph group</strong>{' '}
            — clipping + border-radius interpolation (put radius on the morph target element; JS writes{' '}
            <code className="text-xs">--lightbox-morph-border-radius-from/to</code>), timed by the
            active preset.
          </li>
          <li>
            <strong className="font-medium text-neutral-800 dark:text-neutral-200">Snapshots</strong>{' '}
            — hard-cut by default (<code className="text-xs">object-fit: cover</code>, no UA dissolve);
            when Trigger <code className="text-xs">crossfade</code> sets{' '}
            <code className="text-xs">data-ramka-crossfade</code>, the dissolve path (UA fade,{' '}
            <code className="text-xs">plus-lighter</code>, <code className="text-xs">object-fit: fill</code>)
            runs on the same preset clock.
          </li>
          <li>
            <strong className="font-medium text-neutral-800 dark:text-neutral-200">Root snapshot</strong>{' '}
            — the page-behind crossfade, kept as a <em>single</em> root group (promoting Backdrop /
            Content into named groups tanks Safari). Fade scrim and chrome with live{' '}
            <code className="text-xs">opacity</code> transitions instead.
          </li>
          <li>
            <strong className="font-medium text-neutral-800 dark:text-neutral-200">Morph-target hide</strong>{' '}
            — <code className="text-xs">[data-morph-target]</code> gets{' '}
            <code className="text-xs">opacity: 0</code> with a 200ms fade-back (disabled during the
            transition so it can&apos;t be captured mid-flight), so the live trigger never shows doubled
            under the morphing snapshot.
          </li>
          <li>
            <strong className="font-medium text-neutral-800 dark:text-neutral-200">Thumb-jump crossfade</strong>{' '}
            — the element-scoped Slides transition started by ThumbnailStrip&apos;s{' '}
            <code className="text-xs">selectViewTransition</code>, tunable via{' '}
            <code className="text-xs">--lightbox-select-vt-duration/easing</code> on Slides.
          </li>
        </ul>
        <p>
          Everything except name isolation is gated under{' '}
          <code className="text-xs">prefers-reduced-motion: no-preference</code>. The stylesheet is
          inserted at the <em>start</em> of <code className="text-xs">&lt;head&gt;</code>, so your own
          stylesheets cascade after it — overriding any injected rule takes an ordinary declaration of
          equal specificity, no <code className="text-xs">!important</code> needed.
        </p>
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
