import { DocsDemo } from '../../../_components/docs-demo';
import { DocsLink } from '../../../_components/docs-link';
import { DocsPager } from '../../../_components/docs-pager';
import { DocsSection, DocsShell, type DocsTocItem } from '../../../_components/docs-shell';
import { lightboxApiHref, lightboxDocsPages } from '../../../_content/lightbox/docs-pages';
import { lightboxExcerpts } from '../../../_content/lightbox/excerpts/generated';
import {
  ControlledStateDemo,
  CreateHandleDemo,
  LifecycleCallbacksDemo,
} from '../state-lifecycle-demos';

const toc: DocsTocItem[] = [
  { id: 'controlled', title: 'Controlled state' },
  { id: 'imperative', title: 'Imperative API' },
  { id: 'lifecycle', title: 'Lifecycle callbacks' },
  { id: 'before-open', title: 'onBeforeOpen' },
];

export default function LightboxStateLifecyclePage() {
  return (
    <DocsShell
      title="State & lifecycle"
      description={
        <>
          Control open state and the active index from React,{' '}
          <code className="text-xs">createHandle()</code>, or both — and know when callbacks fire. Part of{' '}
          <DocsLink href={lightboxDocsPages.overview.href}>Lightbox</DocsLink>.
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
        <DocsDemo
          code={lightboxExcerpts['controlled-state'].code}
          title={lightboxExcerpts['controlled-state'].title}
        >
          <ControlledStateDemo />
        </DocsDemo>
      </DocsSection>

      <DocsSection id="imperative" title="Imperative API">
        <p>
          <DocsLink href={lightboxApiHref.createHandle}>Lightbox.createHandle()</DocsLink> lets Triggers
          and Root live apart — pass the same handle to both. Call{' '}
          <code className="text-xs">open(index, {'{ triggerId }'})</code> from any button so the open still
          morphs from the matching <DocsLink href={lightboxApiHref.trigger}>Trigger</DocsLink>.
        </p>
        <DocsDemo
          code={lightboxExcerpts['create-handle'].code}
          title={lightboxExcerpts['create-handle'].title}
        >
          <CreateHandleDemo />
        </DocsDemo>
      </DocsSection>

      <DocsSection id="lifecycle" title="Lifecycle callbacks">
        <p>
          <code className="text-xs">onOpenChange</code> fires immediately when open flips — use it to sync
          URL or external state. <code className="text-xs">onOpenChangeComplete</code> fires after enter/exit
          motion settles — use it for cleanup and focus. <code className="text-xs">onValueChange</code>{' '}
          reports the new index plus a{' '}
          <DocsLink href={lightboxApiHref.types}>NavigationSource</DocsLink> (including{' '}
          <code className="text-xs">imperative</code> for handle navigation).
        </p>
        <DocsDemo
          code={lightboxExcerpts['lifecycle-callbacks'].code}
          title={lightboxExcerpts['lifecycle-callbacks'].title}
        >
          <LifecycleCallbacksDemo />
        </DocsDemo>
      </DocsSection>

      <DocsSection id="before-open" title="onBeforeOpen">
        <p>
          When View Transitions are on, open is{' '}
          <em>prepare → optional image decode → optional onBeforeOpen → morph</em>. Use{' '}
          <DocsLink href={lightboxApiHref.root}>Root</DocsLink>
          ’s <code className="text-xs">onBeforeOpen</code> to delay the morph until custom media is
          ready (iframe <code className="text-xs">load</code>, video, WebGL, …). It runs after the
          lightbox is mounted hidden — so destination nodes exist — and before{' '}
          <code className="text-xs">startViewTransition</code>.
        </p>
        <p>
          Keep <code className="text-xs">awaitImageDecode</code> for photos (default{' '}
          <code className="text-xs">true</code>). For non-image destinations, pass{' '}
          <code className="text-xs">awaitImageDecode={'{false}'}</code> and wait in{' '}
          <code className="text-xs">onBeforeOpen</code>. Bound your own timeout;{' '}
          <code className="text-xs">ctx.signal</code> aborts if a newer open/close wins. See{' '}
          <DocsLink href="/examples/lightbox/google-maps">Google Maps</DocsLink>.
        </p>
      </DocsSection>

      <DocsPager prev={lightboxDocsPages.overview} next={lightboxDocsPages.composition} />
    </DocsShell>
  );
}
