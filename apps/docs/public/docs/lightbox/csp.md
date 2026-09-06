# Content Security Policy

Running the lightbox on pages with a strict `style-src`. Part of [Lightbox](docs/lightbox.md).

## What the library injects

The library is headless — your chrome, your CSS — but its structural rules have to come from somewhere, and they arrive through two channels. Almost everything goes through [constructed stylesheets](https://developer.mozilla.org/en-US/docs/Web/API/CSSStyleSheet) created at runtime, which CSP does not police at all: a page that allows no inline styles whatsoever still gets every rule delivered this way, with no configuration.

The exception is three small `<style>` tags with constant text that must exist in the markup itself, because they style the *first paint* of a page that server-renders an open lightbox — before any runtime code has run. They make media fill its fit-box, hide the active item's trigger, and position the initial slide. A strict `style-src` refuses them unless you allow them, and the degradation is deliberately soft: the constructed- stylesheet copies take over after hydration, so everything works — only those first-paint niceties on server-rendered-open pages are lost.

## Passing a nonce

The standard way to allow specific inline styles is a [nonce](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/style-src#unsafe_inline_styles) : the server generates a random value per request, puts it in the header, and any `<style>` carrying the same value is allowed. Wrap [CSPProvider](docs/lightbox/api.md#api-csp-provider) around everything that renders lightbox parts and pass it that value — it stamps every inline tag the library renders. Requires React 19.2+; older versions simply keep the fallback behavior above.

```tsx app/layout.tsx
import * as Lightbox from '@ramka/react/lightbox';

const nonce = (await headers()).get('x-nonce') ?? undefined;

<Lightbox.CSPProvider nonce={nonce}>{children}</Lightbox.CSPProvider>
```

Put it above the *whole* app, not around one gallery. A detached [Trigger](docs/lightbox/api.md#api-trigger) living outside any Root needs the context too — and because React merges same-precedence styles and drops any copy whose nonce is missing, one uncovered Trigger can cost a rule that every covered one relies on.

## Server rendering

On the server, React only emits the nonce on these tags when the same value is *also* passed to the render call — `renderToPipeableStream(el, &#123; nonce: &#123; style &#125; &#125;)` . If you own that call, pass it and you are done: the deep-link pages that server-render an open viewer keep their first-paint styling under a strict policy.

Frameworks own that call for you, and Next.js currently forwards its nonce for scripts only ( [vercel/next.js#76317](https://github.com/vercel/next.js/issues/76317) ), so server HTML renders these tags without the nonce for now. The provider still earns its keep there: tags React inserts *on the client* carry the nonce unconditionally, which covers every normal open — grid loads, user clicks, viewer opens. Only the server-rendered-open first paint stays on the fallback until Next.js wires the style nonce through, at which point it lights up with no change on your side.

## Inline style attributes

Separate from `<style>` elements, CSP also governs `style="…"` attributes — and nonces cannot be applied to attributes at all. The library's structural styles ride on inline attributes (as does most of the React ecosystem), which only matters for markup parsed from server HTML: styles set from JavaScript after hydration are not policed. If you server-render lightbox pages under a policy stricter than `style-src` alone, split the directives and keep `'unsafe-inline'` on the attribute half:

```tsx CSP header
Content-Security-Policy:
  default-src 'self';
  style-src-elem 'self' 'nonce-<generated-per-request>';
  style-src-attr 'unsafe-inline';
```

This is the industry-standard shape — Base UI and Material UI document the same split. Style *attributes* cannot exfiltrate data or execute code the way style elements can, so allowing them is a far smaller concession than `'unsafe-inline'` on elements.

## Hash-based policies

Statically hosted sites have no server to mint a per-request nonce. CSP's alternative is a hash source: allow exactly these style blocks by their SHA-256. That is normally impractical for component libraries — CSS-in-JS output varies per page — but the library's three tags have *constant* text by design, so their hashes are stable for a given release. The quickest way to collect them is the browser itself: load a page with the policy enforced and copy the three `sha256-…` values Chrome prints in the console violation messages into `style-src`. Re-collect them when you upgrade the package — rule text can change between releases.
