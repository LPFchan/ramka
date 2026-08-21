// The parts deliberately do not pass through this entry. They ship as the
// `ramka/lightbox` subpath, so consumers write the namespace themselves:
//
//   import * as Lightbox from 'ramka/lightbox';
//
// Handing out a ready-made namespace instead (`export * as Lightbox`) reads the
// same at the call site and costs real bytes: esbuild cannot tell which members
// of a package-owned namespace a consumer touched, so `Lightbox.Root` retains
// every part — 20.4 KB gzipped instead of 14.4 on a six-part gallery. Rollup
// shakes both shapes, which is why the regression ships unnoticed.
// scripts/probe-export-shape.mjs guards this.

// Composition hooks: let nested wrapper components read the refs/state a
// `Lightbox.Trigger` / `Lightbox.Item` render function would provide, without
// threading a render prop through them.
export { useLightboxContext } from './lightbox-context';
export { useOptionalLightboxItemContext as useLightboxItemContext } from './lightbox-item';
export { useOptionalLightboxMediaContext as useLightboxMediaContext } from './lightbox-media';
export { useOptionalLightboxTriggerContext as useLightboxTriggerContext } from './lightbox-trigger';
export { useOptionalLightboxStageContext as useLightboxStageContext } from './lightbox-stage';
export type { LightboxHandle, LightboxHandleOpenOptions } from './lightbox-handle';
export type { LightboxContextValue, NavigationSource } from './lightbox-context';
export type { LightboxItemContextValue } from './lightbox-item';
export type { LightboxMediaContextValue } from './lightbox-media';
export type { LightboxTriggerRenderState } from './lightbox-trigger';
export type { LightboxStageRenderState } from './lightbox-stage';
