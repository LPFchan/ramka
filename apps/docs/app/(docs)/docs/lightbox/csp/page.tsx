import type { Metadata } from 'next';

import { CodeBlock } from '../../../../_components/code-block';
import { DocsLink } from '../../../../_components/docs-link';
import { DocsPager } from '../../../../_components/docs-pager';
import { DocsSection, DocsShell, type DocsTocItem } from '../../../../_components/docs-shell';
import { lightboxApiHref, lightboxDocsPages } from '../../../../_content/lightbox/docs-pages';
import { lightboxExcerpts } from '../../../../_content/lightbox/excerpts/generated';

export const metadata: Metadata = {
  title: 'Content Security Policy',
  description:
    'Running the lightbox under a strict CSP: what the library injects, what degrades without a nonce, and how CSPProvider wires one in.',
};

const toc: DocsTocItem[] = [
  { id: 'injects', title: 'What the library injects' },
  { id: 'nonce', title: 'Passing a nonce' },
  { id: 'server', title: 'Server rendering' },
  { id: 'attributes', title: 'Inline style attributes' },
  { id: 'hashes', title: 'Hash-based policies' },
];

const extLink =
  'underline decoration-neutral-300 underline-offset-2 hover:decoration-neutral-500 dark:decoration-neutral-700 dark:hover:decoration-neutral-500';

const CSP_HEADER = `Content-Security-Policy:
  default-src 'self';
  style-src-elem 'self' 'nonce-<generated-per-request>';
  style-src-attr 'unsafe-inline';`;

export default function LightboxCspPage() {
  return (
    <DocsShell
      title="Content Security Policy"
      description={
        <>
          Running the lightbox on pages with a strict{' '}
          <code className="text-xs">style-src</code>. Part of{' '}
          <DocsLink href={lightboxDocsPages.overview.href}>Lightbox</DocsLink>.
        </>
      }
      toc={toc}
    >
      <DocsSection id="injects" title="What the library injects">
        <p>
          The library is headless — your chrome, your CSS — but its structural rules have to come
          from somewhere, and they arrive through two channels. Almost everything goes through{' '}
          <a
            className={extLink}
            href="https://developer.mozilla.org/en-US/docs/Web/API/CSSStyleSheet"
            target="_blank"
            rel="noreferrer"
          >
            constructed stylesheets
          </a>{' '}
          created at runtime, which CSP does not police at all: a page that allows no inline styles
          whatsoever still gets every rule delivered this way, with no configuration.
        </p>
        <p>
          The exception is three small <code className="text-xs">&lt;style&gt;</code> tags with
          constant text that must exist in the markup itself, because they style the{' '}
          <em>first paint</em> of a page that server-renders an open lightbox — before any runtime
          code has run. They make media fill its fit-box, hide the active item&apos;s trigger, and
          position the initial slide. A strict <code className="text-xs">style-src</code> refuses
          them unless you allow them, and the degradation is deliberately soft: the constructed-
          stylesheet copies take over after hydration, so everything works — only those first-paint
          niceties on server-rendered-open pages are lost.
        </p>
      </DocsSection>

      <DocsSection id="nonce" title="Passing a nonce">
        <p>
          The standard way to allow specific inline styles is a{' '}
          <a
            className={extLink}
            href="https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/style-src#unsafe_inline_styles"
            target="_blank"
            rel="noreferrer"
          >
            nonce
          </a>
          : the server generates a random value per request, puts it in the header, and any{' '}
          <code className="text-xs">&lt;style&gt;</code> carrying the same value is allowed. Wrap{' '}
          <DocsLink href={lightboxApiHref.cspProvider}>CSPProvider</DocsLink> around everything that
          renders lightbox parts and pass it that value — it stamps every inline tag the library
          renders. Requires React 19.2+; older versions simply keep the fallback behavior above.
        </p>
        <CodeBlock
          code={lightboxExcerpts['csp-provider'].code}
          title={lightboxExcerpts['csp-provider'].title}
        />
        <p>
          Put it above the <em>whole</em> app, not around one gallery. A detached{' '}
          <DocsLink href={lightboxApiHref.trigger}>Trigger</DocsLink> living outside any Root needs
          the context too — and because React merges same-precedence styles and drops any copy whose
          nonce is missing, one uncovered Trigger can cost a rule that every covered one relies on.
        </p>
      </DocsSection>

      <DocsSection id="server" title="Server rendering">
        <p>
          On the server, React only emits the nonce on these tags when the same value is <em>also</em>{' '}
          passed to the render call —{' '}
          <code className="text-xs">
            renderToPipeableStream(el, &#123; nonce: &#123; style &#125; &#125;)
          </code>
          . If you own that call, pass it and you are done: the deep-link pages that server-render an
          open viewer keep their first-paint styling under a strict policy.
        </p>
        <p>
          Frameworks own that call for you, and Next.js currently forwards its nonce for scripts
          only (
          <a
            className={extLink}
            href="https://github.com/vercel/next.js/issues/76317"
            target="_blank"
            rel="noreferrer"
          >
            vercel/next.js#76317
          </a>
          ), so server HTML renders these tags without the nonce for now. The provider still earns
          its keep there: tags React inserts <em>on the client</em> carry the nonce unconditionally,
          which covers every normal open — grid loads, user clicks, viewer opens. Only the
          server-rendered-open first paint stays on the fallback until Next.js wires the style nonce
          through, at which point it lights up with no change on your side.
        </p>
      </DocsSection>

      <DocsSection id="attributes" title="Inline style attributes">
        <p>
          Separate from <code className="text-xs">&lt;style&gt;</code> elements, CSP also governs{' '}
          <code className="text-xs">style=&quot;…&quot;</code> attributes — and nonces cannot be
          applied to attributes at all. The library&apos;s structural styles ride on inline
          attributes (as does most of the React ecosystem), which only matters for markup parsed
          from server HTML: styles set from JavaScript after hydration are not policed. If you
          server-render lightbox pages under a policy stricter than{' '}
          <code className="text-xs">style-src</code> alone, split the directives and keep{' '}
          <code className="text-xs">'unsafe-inline'</code> on the attribute half:
        </p>
        <CodeBlock code={CSP_HEADER} title="CSP header" />
        <p>
          This is the industry-standard shape — Base UI and Material UI document the same split.
          Style <em>attributes</em> cannot exfiltrate data or execute code the way style elements
          can, so allowing them is a far smaller concession than{' '}
          <code className="text-xs">'unsafe-inline'</code> on elements.
        </p>
      </DocsSection>

      <DocsSection id="hashes" title="Hash-based policies">
        <p>
          Statically hosted sites have no server to mint a per-request nonce. CSP&apos;s alternative
          is a hash source: allow exactly these style blocks by their SHA-256. That is normally
          impractical for component libraries — CSS-in-JS output varies per page — but the
          library&apos;s three tags have <em>constant</em> text by design, so their hashes are
          stable for a given release. The quickest way to collect them is the browser itself: load a
          page with the policy enforced and copy the three{' '}
          <code className="text-xs">sha256-…</code> values Chrome prints in the console violation
          messages into <code className="text-xs">style-src</code>. Re-collect them when you upgrade
          the package — rule text can change between releases.
        </p>
      </DocsSection>

      <DocsPager prev={lightboxDocsPages.rtl} next={lightboxDocsPages.api} />
    </DocsShell>
  );
}
