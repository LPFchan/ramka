import { DocsDemo } from '../../../../_components/docs-demo';
import { DocsLink } from '../../../../_components/docs-link';
import { DocsPager } from '../../../../_components/docs-pager';
import { DocsSection, DocsShell, type DocsTocItem } from '../../../../_components/docs-shell';
import { lightboxApiHref, lightboxDocsPages } from '../../../../_content/lightbox/docs-pages';
import { lightboxExcerpts } from '../../../../_content/lightbox/excerpts/generated';
import {
  NextjsImageDoDemo,
  NextjsImageDontDemo,
  NextjsImageNonImageTriggerDemo,
  NextjsImagePlusNDemo,
} from '../nextjs-image-demos';

const toc: DocsTocItem[] = [
  { id: 'rule', title: 'Rule' },
  { id: 'do', title: 'Do' },
  { id: 'dont', title: 'Don’t' },
  { id: 'no-trigger-image', title: 'No trigger image' },
  { id: 'checklist', title: 'Checklist' },
];

export default function LightboxNextjsImagePage() {
  return (
    <DocsShell
      title="Next.js Image"
      description={
        <>
          Use <code className="text-xs">next/image</code> with Ramka. Destination blur depends on
          whether that item has a trigger thumb. Part of{' '}
          <DocsLink href={lightboxDocsPages.overview.href}>Lightbox</DocsLink>.
        </>
      }
      toc={toc}
    >
      <DocsSection id="rule" title="Rule">
        <p>
          Decide <strong className="font-medium text-neutral-800 dark:text-neutral-200">per item
          index</strong>, not per gallery. Ramka paints an open bridge only when that index has a
          registered trigger image (<code className="text-xs">imageRef</code>).
        </p>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            Trigger thumbs — <code className="text-xs">placeholder=&quot;blur&quot;</code> is fine
          </li>
          <li>
            Destination with a trigger image — omit <code className="text-xs">placeholder</code> /{' '}
            <code className="text-xs">blurDataURL</code>. Next’s LQIP covers Ramka’s thumb bridge.
          </li>
          <li>
            Destination with no trigger image — destination blur is the loading placeholder (see{' '}
            <DocsLink href="#no-trigger-image">No trigger image</DocsLink>).
          </li>
        </ul>
      </DocsSection>

      <DocsSection id="do" title="Do">
        <p>
          Static-import the same asset for trigger and destination (Next fills in{' '}
          <code className="text-xs">blurDataURL</code>). Blur the trigger; leave the destination
          clean. Square trigger crop is CSS only — keep source aspect matched to Media.
        </p>
        <DocsDemo
          code={lightboxExcerpts['nextjs-image-do'].code}
          title={lightboxExcerpts['nextjs-image-do'].title}
        >
          <NextjsImageDoDemo />
        </DocsDemo>
      </DocsSection>

      <DocsSection id="dont" title="Don’t">
        <p>
          <code className="text-xs">placeholder=&quot;blur&quot;</code> on a destination that has a
          trigger thumb covers Ramka’s bridge with Next’s LQIP while the full image loads.
        </p>
        <DocsDemo
          code={lightboxExcerpts['nextjs-image-dont'].code}
          title={lightboxExcerpts['nextjs-image-dont'].title}
        >
          <NextjsImageDontDemo />
        </DocsDemo>
      </DocsSection>

      <DocsSection id="no-trigger-image" title="No trigger image">
        <p>
          If an index has no trigger <code className="text-xs">imageRef</code>, Ramka has nothing to
          paint. Use destination <code className="text-xs">placeholder=&quot;blur&quot;</code> for
          those items only — not for siblings that still have a trigger thumb.
        </p>

        <h3 className="mt-8 text-sm font-semibold text-neutral-900 dark:text-neutral-100">
          +N extras
        </h3>
        <p className="mt-2">
          Open the +N tile, then swipe past the triggered photos. Overflow slides show Next’s LQIP;
          indexes 0–1 stay on Ramka’s thumb bridge. Close uses{' '}
          <DocsLink href={`${lightboxDocsPages.viewTransitions.href}#morph-to`}>
            morphTo=&quot;closest&quot;
          </DocsLink>
          .
        </p>
        <div className="mt-4">
          <DocsDemo
            code={lightboxExcerpts['nextjs-image-plus-n'].code}
            title={lightboxExcerpts['nextjs-image-plus-n'].title}
          >
            <NextjsImagePlusNDemo />
          </DocsDemo>
        </div>

        <h3 className="mt-10 text-sm font-semibold text-neutral-900 dark:text-neutral-100">
          Non-image trigger
        </h3>
        <p className="mt-2">
          Initials / swatches have a Trigger but no thumb. Destination blur is the loading
          placeholder.
        </p>
        <div className="mt-4">
          <DocsDemo
            code={lightboxExcerpts['nextjs-image-non-image-trigger'].code}
            title={lightboxExcerpts['nextjs-image-non-image-trigger'].title}
          >
            <NextjsImageNonImageTriggerDemo />
          </DocsDemo>
        </div>
      </DocsSection>

      <DocsSection id="checklist" title="Checklist">
        <ul className="list-disc space-y-2 pl-5">
          <li>
            Per index: trigger image → no destination blur; no trigger image → destination blur OK
          </li>
          <li>
            Match Media <code className="text-xs">width</code>/<code className="text-xs">height</code>{' '}
            to the image source aspect
          </li>
          <li>
            Trigger: <code className="text-xs">imageRef</code> (or{' '}
            <DocsLink href={lightboxApiHref.useTriggerContext}>useLightboxTriggerContext</DocsLink>);
            blur OK on the thumb
          </li>
          <li>
            Prefer <code className="text-xs">priority</code> on the open destination — see{' '}
            <DocsLink href={lightboxDocsPages.viewTransitions.href}>View transitions</DocsLink>
          </li>
          <li>
            <code className="text-xs">sizes=&quot;100vw&quot;</code> for fullscreen
          </li>
          <li>
            Skip <code className="text-xs">fill</code> / <code className="text-xs">size-full</code> —
            Media already fills a direct Image child
          </li>
        </ul>
      </DocsSection>

      <DocsPager prev={lightboxDocsPages.composition} next={lightboxDocsPages.viewTransitions} />
    </DocsShell>
  );
}
