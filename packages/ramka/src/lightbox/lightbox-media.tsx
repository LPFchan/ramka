'use client';

import { mergeProps } from '@base-ui/react/merge-props';
import { useRender } from '@base-ui/react/use-render';
import * as React from 'react';

import { LightboxMediaDataAttributes } from './lightbox-data-attributes';
import { useOptionalLightboxItemContext } from './lightbox-item';

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

/** React `useId()` values can include `:` — escape for use in a CSS selector. */
function escapeCssIdent(value: string): string {
  if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
    return CSS.escape(value);
  }
  return value.replace(/([^\w-])/g, '\\$1');
}

/**
 * Structural fill for a direct media child. HTML `width`/`height` are
 * presentational hints that defeat Grid stretch; this author rule wins on
 * first paint (including SSR) without cloning children.
 *
 * `min-width/min-height: 0` overrides Grid’s default `min-*: auto` so a broken
 * WebKit `<img>` (square content minimum) cannot overflow the fit-box.
 */
function mediaChildFillCss(mediaId: string): string {
  const id = escapeCssIdent(mediaId);
  return (
    `#${id} > img:not([data-ramka-media-poster]),#${id} > video,#${id} > canvas{` +
    `width:100%;height:100%;min-width:0;min-height:0;` +
    `}`
  );
}

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
 * and renders a scoped `<style>` so direct `<img>` / `<video>` / `<canvas>` children
 * fill the fit-box (`width/height: 100%` plus `min-*: 0` so broken WebKit images
 * cannot overflow via Grid’s automatic minimum). No consumer `size-full`
 * required. Prefer Slide padding for resting chrome insets (not Zoom). Radius,
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
      [forwardedRef, item],
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

    // Observe placeholder canvas presence for data-placeholder styling.
    React.useLayoutEffect(() => {
      const host = internalRef.current;
      if (!host) return;
      const update = () => {
        setPlaceholder(!!host.querySelector('[data-ramka-placeholder]'));
      };
      update();
      const mo = new MutationObserver(update);
      mo.observe(host, { childList: true });
      return () => mo.disconnect();
    }, []);

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
      };
      if (hasFitBox && width && height) {
        Object.assign(next, fitBoxStyle(width, height));
      }
      return next;
    }, [hasFitBox, height, width]);

    const fillStyle = mediaChildFillCss(mediaId);

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
        {
          children: (
            <>
              <style>{fillStyle}</style>
              {children}
            </>
          ),
        } as React.ComponentPropsWithRef<'div'>,
      ),
      defaultTagName: 'div',
    });

    return (
      <LightboxMediaContext.Provider value={mediaContext}>{rendered}</LightboxMediaContext.Provider>
    );
  },
);

LightboxMedia.displayName = 'LightboxMedia';

export { LightboxMedia, useOptionalLightboxMediaContext };
export type { LightboxMediaProps, LightboxMediaState, LightboxMediaContextValue };
