'use client';

import * as React from 'react';

import { LightboxMediaDataAttributes } from './lightbox-data-attributes';
import { useOptionalLightboxItemContext } from './lightbox-item';
import { insertLibrarySheet } from './lightbox-style-sheets';
import { REACT_SUPPORTS_STYLE_HOISTING } from './react-style-hoisting';
import { mergeProps } from '../render/merge-props';
import { useRender } from '../render/use-render';

/** Only used by the <style> fallback in environments without CSSOM sheets. */
const MEDIA_FILL_MARKER = 'data-ramka-media-fill';

/**
 * Context published by `Lightbox.Media` for descendants / advanced wrappers.
 */
interface LightboxMediaContextValue {
  /** Media host element (morph + placeholder host). */
  element: HTMLElement | null;
}

const LightboxMediaContext = React.createContext<LightboxMediaContextValue | null>(null);

function useOptionalLightboxMediaContext(): LightboxMediaContextValue | null {
  return React.useContext(LightboxMediaContext);
}

interface LightboxMediaState extends Record<string, unknown> {
  /** Present while the open-morph placeholder canvas is bridging. */
  placeholder: boolean;
}

interface LightboxMediaProps extends useRender.ComponentProps<'div', LightboxMediaState> {
  /**
   * Intrinsic pixel width of the media (same idea as Next.js `<Image width>`).
   * With `height`, applies a structural inscribed fit-box. When omitted, dims are
   * taken from the child `<img>`’s HTML `width`/`height` if present.
   */
  width?: number;
  /**
   * Intrinsic pixel height of the media (same idea as Next.js `<Image height>`).
   */
  height?: number;
}

const mediaStateAttributesMapping = {
  placeholder: (value: unknown) => (value ? { 'data-placeholder': '' } : null),
};

function dimsFromImg(img: HTMLImageElement): { width: number; height: number } | null {
  const w = Number(img.getAttribute('width')) || img.naturalWidth;
  const h = Number(img.getAttribute('height')) || img.naturalHeight;
  if (!(w > 0 && h > 0)) return null;
  return { width: w, height: h };
}

function fitBoxStyle(width: number, height: number): React.CSSProperties {
  const ratio = width / height;
  return {
    // Explicit size (not max-* alone): a non-replaced grid with width/height auto
    // won’t grow to fill Zoom — only the old cqw/cqh formula letterboxes correctly.
    // Resolves against Zoom’s size container (padding box).
    width: `min(100cqw, calc(100cqh * ${ratio}))`,
    aspectRatio: `${width} / ${height}`,
  };
}

/**
 * Structural fill for a direct media child. HTML `width`/`height` are
 * presentational hints that defeat Grid stretch; this author rule beats them
 * without cloning children.
 *
 * `min-width/min-height: 0` overrides Grid’s default `min-*: auto` so a broken
 * WebKit `<img>` (square content minimum) cannot overflow the fit-box.
 *
 * `:not(#_)` adds id-level specificity so consumer CSS cannot accidentally
 * outrank the rule and collapse the fit-box — same protection the old
 * per-instance `#id` scoping bought, but with CONSTANT rule text. Constant
 * text is what lets one copy serve every Media: the hoistable `<style>` below
 * dedupes by `href` across instances and remounts (per-instance text would
 * accumulate a dead hoisted tag per viewer open — React never removes
 * hoistables), and the CSSOM fallback needs no per-id bookkeeping either.
 */
const MEDIA_FILL_HOST = '[data-ramka-media]:not(#_)';
const MEDIA_FILL_CSS =
  `${MEDIA_FILL_HOST} > img:not([data-ramka-media-poster]),` +
  `${MEDIA_FILL_HOST} > video,${MEDIA_FILL_HOST} > canvas{` +
  `width:100%;height:100%;min-width:0;min-height:0;` +
  `}`;

/**
 * Sized destination media host. Morph target + placeholder canvas container by
 * contract — place an `<img>`, `<video>`, or `<canvas>` inside (not chrome). Prefer
 * nesting under `Lightbox.Zoom` (a size container for `cqw` / `cqh`):
 *
 * ```tsx
 * <Lightbox.Zoom>
 *   <Lightbox.Media width={w} height={h}>
 *     <img width={w} height={h} src={src} alt="" />
 *   </Lightbox.Media>
 * </Lightbox.Zoom>
 * ```
 *
 * `width` / `height` are **structural** (correct morph box). Media is a CSS grid
 * and ships fill rules so direct `<img>` / `<video>` / `<canvas>` children fill
 * the fit-box (`width/height: 100%` plus `min-*: 0` so broken WebKit images
 * cannot overflow via Grid’s automatic minimum). No consumer `size-full`
 * required. The rules are delivered twice: a hoistable `<style>` that exists in
 * server HTML (correct first paint when a page server-renders an open lightbox,
 * e.g. deep links with `Portal container={null}`) and a CSSOM sheet that covers
 * strict-CSP environments where inline styles are refused. Prefer Slide padding for resting chrome insets (not Zoom). Radius,
 * colors, and `object-fit` remain consumer-owned.
 *
 * Discovers the primary `<img>` (direct child preferred) and wires Item's
 * `imageRef` for decode / thumbnail placeholder paint.
 */
const LightboxMedia = React.forwardRef<HTMLDivElement, LightboxMediaProps>(
  function LightboxMedia(props, forwardedRef) {
    const {
      render,
      children,
      style,
      id: idProp,
      width: widthProp,
      height: heightProp,
      ...elementProps
    } = props;
    const item = useOptionalLightboxItemContext();
    const autoId = React.useId();
    const mediaId = idProp ?? autoId;
    const internalRef = React.useRef<HTMLDivElement | null>(null);
    const [placeholder, setPlaceholder] = React.useState(false);
    const [element, setElement] = React.useState<HTMLElement | null>(null);
    const [autoDims, setAutoDims] = React.useState<{ width: number; height: number } | null>(null);
    const wiredImageRef = React.useRef<HTMLImageElement | null>(null);

    const width = widthProp ?? autoDims?.width;
    const height = heightProp ?? autoDims?.height;
    const hasFitBox = !!(width && height && width > 0 && height > 0);

    const setMediaNode = React.useCallback(
      (node: HTMLDivElement | null) => {
        internalRef.current = node;
        setElement(node);
        item?.registerMedia(node);
        item?.registerPlaceholder(node ? setPlaceholder : null);
        if (typeof forwardedRef === 'function') {
          forwardedRef(node);
        } else if (forwardedRef) {
          forwardedRef.current = node;
        }
        if (!node && wiredImageRef.current) {
          item?.imageRef(null);
          wiredImageRef.current = null;
        }
      },
      [forwardedRef, item, setPlaceholder],
    );

    const managedPosterRef = React.useRef<HTMLImageElement | null>(null);

    const clearManagedPoster = React.useCallback(() => {
      const managed = managedPosterRef.current;
      if (!managed) return;
      managed.remove();
      managedPosterRef.current = null;
    }, []);

    // Discover primary <img> for placeholder / decode; prefer a direct child.
    // Video-only: synthesize a sized poster <img> from `video.poster` so the
    // open-morph bridge has a decode/paint target without a fake consumer ref.
    const syncImage = React.useCallback(() => {
      const host = internalRef.current;
      if (!host || !item) return;

      const isManaged = (n: Element | null) => n === managedPosterRef.current;
      const direct = Array.from(host.children).find(
        (n): n is HTMLImageElement => n instanceof HTMLImageElement && !isManaged(n),
      );
      const nested = Array.from(host.querySelectorAll('img')).find((n) => !isManaged(n));
      const img = direct ?? nested ?? null;

      if (img) {
        clearManagedPoster();
        const next = dimsFromImg(img);
        setAutoDims((prev) =>
          prev?.width === next?.width && prev?.height === next?.height ? prev : next,
        );
        if (img !== wiredImageRef.current) {
          wiredImageRef.current = img;
          item.imageRef(img);
        }
        return;
      }

      const video = host.querySelector('video');
      const poster = video?.getAttribute('poster') || video?.poster || '';
      if (video && poster) {
        let managed = managedPosterRef.current;
        if (!managed) {
          managed = document.createElement('img');
          managed.setAttribute('data-ramka-media-poster', '');
          managed.alt = '';
          managed.setAttribute('aria-hidden', 'true');
          const s = managed.style;
          s.position = 'absolute';
          s.inset = '0';
          s.width = '100%';
          s.height = '100%';
          s.opacity = '0';
          s.pointerEvents = 'none';
          host.insertBefore(managed, host.firstChild);
          managedPosterRef.current = managed;
        }
        const cs = getComputedStyle(video);
        managed.style.objectFit = cs.objectFit === 'contain' ? 'contain' : 'cover';
        managed.style.objectPosition = cs.objectPosition || 'center';
        if (managed.getAttribute('src') !== poster) {
          managed.src = poster;
        }
        setAutoDims((prev) => (prev === null ? prev : null));
        if (managed !== wiredImageRef.current) {
          wiredImageRef.current = managed;
          item.imageRef(managed);
        }
        return;
      }

      clearManagedPoster();
      setAutoDims(null);
      if (wiredImageRef.current) {
        item.imageRef(null);
        wiredImageRef.current = null;
      }
    }, [clearManagedPoster, item]);

    React.useLayoutEffect(() => {
      syncImage();
      const host = internalRef.current;
      if (!host) return;
      const mo = new MutationObserver(syncImage);
      mo.observe(host, { childList: true, subtree: true });
      return () => {
        mo.disconnect();
        clearManagedPoster();
        if (wiredImageRef.current) {
          item?.imageRef(null);
          wiredImageRef.current = null;
        }
      };
    }, [clearManagedPoster, item, syncImage]);

    const state = React.useMemo<LightboxMediaState>(() => ({ placeholder }), [placeholder]);

    const mediaContext = React.useMemo<LightboxMediaContextValue>(
      () => ({ element }),
      [element],
    );

    const structuralStyle = React.useMemo((): React.CSSProperties => {
      const next: React.CSSProperties = {
        position: 'relative',
        flexShrink: 0,
        // Grid host for a single in-flow media child. Placeholder canvas stays absolute.
        display: 'grid',
        // So the z-index:-1 placeholder canvas stays in this box (not behind the page).
        // Must be on the React style — notify re-renders Media and would wipe a DOM write.
        isolation: 'isolate',
      };
      if (hasFitBox && width && height) {
        Object.assign(next, fitBoxStyle(width, height));
      }
      return next;
    }, [hasFitBox, height, width]);

    // CSSOM delivery of the fill rules — the strict-CSP path. A `style-src`
    // that refuses inline styles blocks the hoistable <style> rendered below,
    // and the fill is load-bearing (without it media sizes to its intrinsic
    // dimensions instead of the fit-box), so a CSSOM copy — invisible to CSP —
    // always lands too. Insertion-effect timing puts it in place before any
    // layout effect measures. Redundant where the <style> applied: identical
    // rule text, so the duplicate is inert.
    React.useInsertionEffect(() => {
      const sheet = insertLibrarySheet(MEDIA_FILL_CSS, MEDIA_FILL_MARKER);
      return () => sheet.release();
    }, []);

    const rendered = useRender({
      render,
      ref: setMediaNode,
      state,
      stateAttributesMapping: mediaStateAttributesMapping,
      props: mergeProps<'div'>(
        {
          id: mediaId,
          [LightboxMediaDataAttributes.media]: '',
          ...(hasFitBox && width && height
            ? {
                [LightboxMediaDataAttributes.width]: String(width),
                [LightboxMediaDataAttributes.height]: String(height),
              }
            : null),
          style: {
            ...structuralStyle,
            ...style,
          },
        } as React.ComponentPropsWithRef<'div'>,
        elementProps as React.ComponentPropsWithRef<'div'>,
        { children } as React.ComponentPropsWithRef<'div'>,
      ),
      defaultTagName: 'div',
    });

    return (
      <LightboxMediaContext.Provider value={mediaContext}>
        {/*
          Markup delivery of the fill rules — the SERVER-PAINT path. Effects
          never run during server rendering, so on a server-rendered page with
          the lightbox already open (deep links rendering Portal in place) the
          CSSOM copy above doesn't exist yet and the first paint would show the
          media at its intrinsic size inside a correctly sized fit-box.
          `href` + `precedence` make this a hoistable: streamed into <head> on
          the server, deduped by `href` across every Media instance and remount
          on the client (constant rule text is what makes the dedupe sound).
          React-19-only — React 18 has no hoisting and would render one inline
          tag per instance, so it keeps the CSSOM-only baseline; see
          react-style-hoisting.ts. Under a strict `style-src` the tag is
          refused; the CSSOM copy takes over after hydration, matching the
          pre-hoistable behavior exactly.
        */}
        {REACT_SUPPORTS_STYLE_HOISTING ? (
          <style href="ramka-media-fill" precedence="ramka">
            {MEDIA_FILL_CSS}
          </style>
        ) : null}
        {rendered}
      </LightboxMediaContext.Provider>
    );
  },
);

LightboxMedia.displayName = 'LightboxMedia';

export { LightboxMedia, useOptionalLightboxMediaContext };
export type { LightboxMediaProps, LightboxMediaState, LightboxMediaContextValue };
