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
  { id: 'rule', title: 'When to use blurDataURL' },
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
          Use <code className="text-xs">next/image</code> with Ramka. Lightbox-side blur depends on
          whether that item has a trigger image. Part of{' '}
          <DocsLink href={lightboxDocsPages.overview.href}>Lightbox</DocsLink>.
        </>
      }
      toc={toc}
    >
      <DocsSection id="rule" title="When to use blurDataURL">
        <p>
          Decide <strong className="font-medium text-neutral-800 dark:text-neutral-200">per item
          index</strong>, not per gallery. Ramka paints an open bridge only when that index has a
          registered trigger image (<code className="text-xs">imageRef</code>).
        </p>
        <div className="overflow-hidden rounded-xl border border-neutral-200 dark:border-neutral-800">
          <table className="w-full text-left text-sm">
            <thead className="bg-neutral-50 text-neutral-500 dark:bg-neutral-900 dark:text-neutral-400">
              <tr>
                <th className="px-3 py-2 font-medium">Image</th>
                <th className="px-3 py-2 font-medium">
                  <code className="text-xs">placeholder=&quot;blur&quot;</code>
                </th>
                <th className="px-3 py-2 font-medium">Why</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
              <tr>
                <td className="px-3 py-2 text-neutral-700 dark:text-neutral-300">
                  Image inside <code className="text-xs">Lightbox.Trigger</code>
                </td>
                <td className="px-3 py-2">Yes</td>
                <td className="px-3 py-2">
                  A regular page image — the LQIP covers its own load. Ramka never paints a
                  placeholder here.
                </td>
              </tr>
              <tr>
                <td className="px-3 py-2 text-neutral-700 dark:text-neutral-300">
                  Lightbox image, index <em>has</em> a trigger image (
                  <code className="text-xs">imageRef</code>)
                </td>
                <td className="px-3 py-2">No</td>
                <td className="px-3 py-2">
                  While the full-size image loads, Ramka paints the trigger’s image — already
                  decoded and on screen — onto a canvas <em>behind</em> the lightbox image. Next’s
                  LQIP renders as a background on the lightbox image itself, in front of that
                  canvas, so blur here hides a sharp placeholder behind a blurry one.
                </td>
              </tr>
              <tr>
                <td className="px-3 py-2 text-neutral-700 dark:text-neutral-300">
                  Lightbox image, index has <em>no</em> trigger image
                </td>
                <td className="px-3 py-2">Yes</td>
                <td className="px-3 py-2">
                  Ramka has no trigger image to paint, so the LQIP is the only loading placeholder
                  (see <DocsLink href="#no-trigger-image">No trigger image</DocsLink>).
                </td>
              </tr>
            </tbody>
          </table>
        </div>
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
          <code className="text-xs">placeholder=&quot;blur&quot;</code> on a lightbox image whose
          index has a trigger image covers Ramka’s bridge with Next’s LQIP while the full image
          loads.
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
          those items only — not for siblings that still have a trigger image.
        </p>

        <h3 className="mt-8 text-sm font-semibold text-neutral-900 dark:text-neutral-100">
          +N extras
        </h3>
        <p className="mt-2">
          Open the +N tile, then swipe past the triggered photos. Overflow slides show Next’s LQIP;
          indexes 0–1 stay on Ramka’s trigger-image bridge. Close uses{' '}
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
          Initials / swatches have a Trigger but no trigger image. Blur on the lightbox image is
          the loading placeholder.
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
            blur OK on the trigger image
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
