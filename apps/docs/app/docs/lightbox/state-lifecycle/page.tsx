import { CodeBlock } from '../../../_components/code-block';
import { DocsLink } from '../../../_components/docs-link';
import { DocsPager } from '../../../_components/docs-pager';
import { DocsSection, DocsShell, type DocsTocItem } from '../../../_components/docs-shell';
import { lightboxApiHref, lightboxDocsPages } from '../../../_content/lightbox/docs-pages';
import { lightboxExcerpts } from '../../../_content/lightbox/excerpts/generated';
import {
  ControlledStateDemo,
  ImperativeRefDemo,
  LifecycleCallbacksDemo,
} from '../state-lifecycle-demos';

const toc: DocsTocItem[] = [
  { id: 'controlled', title: 'Controlled state' },
  { id: 'imperative', title: 'Imperative API' },
  { id: 'lifecycle', title: 'Lifecycle callbacks' },
];

export default function LightboxStateLifecyclePage() {
  return (
    <DocsShell
      title="State & lifecycle"
      description={
        <>
          Control open state and the active index from React, a Root ref, or both — and know when
          callbacks fire. Part of <DocsLink href={lightboxDocsPages.overview.href}>Lightbox</DocsLink>.
        </>
      }
      toc={toc}
    >
      <DocsSection id="controlled" title="Controlled state">
        <p>
          Pass <code className="text-xs">open</code> / <code className="text-xs">onOpenChange</code> and{' '}
          <code className="text-xs">value</code> / <code className="text-xs">onValueChange</code> on{' '}
          <DocsLink href={lightboxApiHref.root}>Root</DocsLink> to drive the lightbox from URL params, a
          store, or sibling UI. Omit them for uncontrolled defaults (
          <code className="text-xs">defaultOpen</code> / <code className="text-xs">defaultValue</code>).
        </p>
        <CodeBlock
          code={lightboxExcerpts['controlled-state'].code}
          title={lightboxExcerpts['controlled-state'].title}
        />
        <ControlledStateDemo />
      </DocsSection>

      <DocsSection id="imperative" title="Imperative API">
        <p>
          Attach a ref to Root for <code className="text-xs">open(index?)</code>,{' '}
          <code className="text-xs">close()</code>, and <code className="text-xs">goTo(index)</code> — see{' '}
          <DocsLink href={lightboxApiHref.rootRef}>LightboxRootRef</DocsLink>. You can combine a ref with
          controlled props.
        </p>
        <p>
          <strong className="font-medium text-neutral-800 dark:text-neutral-200">View transitions:</strong>{' '}
          <code className="text-xs">open()</code> without a trigger click has no trigger-element morph
          (fade path only). Trigger clicks still morph — details in{' '}
          <DocsLink href={`${lightboxDocsPages.viewTransitions.href}#programmatic`}>
            View transitions → Programmatic open
          </DocsLink>
          .
        </p>
        <CodeBlock
          code={lightboxExcerpts['imperative-ref'].code}
          title={lightboxExcerpts['imperative-ref'].title}
        />
        <ImperativeRefDemo />
      </DocsSection>

      <DocsSection id="lifecycle" title="Lifecycle callbacks">
        <p>
          <code className="text-xs">onOpenChange</code> fires immediately when open flips — use it to sync
          URL or external state. <code className="text-xs">onOpenChangeComplete</code> fires after enter/exit
          motion settles — use it for cleanup and focus. <code className="text-xs">onValueChange</code>{' '}
          reports the new index plus a{' '}
          <DocsLink href={lightboxApiHref.types}>NavigationSource</DocsLink>.
        </p>
        <CodeBlock
          code={lightboxExcerpts['lifecycle-callbacks'].code}
          title={lightboxExcerpts['lifecycle-callbacks'].title}
        />
        <LifecycleCallbacksDemo />
      </DocsSection>

      <DocsPager prev={lightboxDocsPages.overview} next={lightboxDocsPages.composition} />
    </DocsShell>
  );
}
