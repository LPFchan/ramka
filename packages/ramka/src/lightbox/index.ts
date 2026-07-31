export * as Lightbox from './lightbox';

// Composition hooks: let nested wrapper components read the refs/state a
// `Lightbox.Trigger` / `Lightbox.Item` render function would provide, without
// threading a render prop through them.
export { useLightboxContext } from './lightbox-context';
export { useOptionalLightboxItemContext as useLightboxItemContext } from './lightbox-item';
export { useOptionalLightboxMediaContext as useLightboxMediaContext } from './lightbox-media';
export { useOptionalLightboxTriggerContext as useLightboxTriggerContext } from './lightbox-trigger';
export type { LightboxHandle, LightboxHandleOpenOptions } from './lightbox-handle';
export type { LightboxContextValue, NavigationSource } from './lightbox-context';
export type { LightboxItemContextValue } from './lightbox-item';
export type { LightboxMediaContextValue } from './lightbox-media';
export type { LightboxTriggerRenderState } from './lightbox-trigger';
