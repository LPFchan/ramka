export * as Lightbox from './lightbox';

// Composition hooks: let nested wrapper components read the refs/state a
// `Lightbox.Trigger` / `Lightbox.Item` render function would provide, without
// threading a render prop through them.
export { useOptionalLightboxItemContext as useLightboxItemContext } from './lightbox-item';
export { useOptionalLightboxTriggerContext as useLightboxTriggerContext } from './lightbox-trigger';
export type { LightboxItemContextValue } from './lightbox-item';
export type { LightboxTriggerRenderState } from './lightbox-trigger';
