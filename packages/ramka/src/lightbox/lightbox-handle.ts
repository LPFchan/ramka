/**
 * Base UI–style imperative handle for Lightbox.
 *
 * `createHandle()` returns a stable object you pass to `Lightbox.Root` (and
 * optionally to detached `Lightbox.Trigger`s) for programmatic control.
 */

interface LightboxHandleOpenOptions {
  /**
   * ID of a `Lightbox.Trigger` registered with this handle (Trigger `id` +
   * `handle`). Associates the open with that trigger for morph, placeholder,
   * and focus return — including when several triggers share one index.
   */
  triggerId?: string;
}

interface LightboxHandle {
  /**
   * Open the lightbox. Optional `index` sets the active item. Pass
   * `options.triggerId` to associate the open with a registered Trigger so
   * view-transition morph / placeholders can use that element.
   *
   * Call only from an event handler or effect — not during render.
   */
  open: (index?: number, options?: LightboxHandleOpenOptions) => void;
  /** Close the lightbox. */
  close: () => void;
  /** Navigate to an index (source: `imperative`). Does not open. */
  goTo: (index: number) => void;
  /** Whether the bound Root is currently open. */
  readonly isOpen: boolean;
}

/** Trigger snapshot registered with a handle (may live outside Root). */
interface LightboxHandleTriggerRegistration {
  id: string;
  index: number;
  element: HTMLElement | null;
  image: HTMLImageElement | null;
  morphElement: HTMLElement | null;
}

/** Bound Root host — set while a Root with this handle is mounted. */
interface LightboxHandleHost {
  open: (index?: number, options?: LightboxHandleOpenOptions) => void;
  close: () => void;
  goTo: (index: number) => void;
  getOpen: () => boolean;
  getActiveIndex: () => number;
  syncTrigger: (reg: LightboxHandleTriggerRegistration) => void;
  unsyncTrigger: (reg: LightboxHandleTriggerRegistration) => void;
}

interface LightboxHandleState {
  host: LightboxHandleHost | null;
  triggers: Map<string, LightboxHandleTriggerRegistration>;
  version: number;
  listeners: Set<() => void>;
}

const handleStates = new WeakMap<LightboxHandle, LightboxHandleState>();

function getHandleState(handle: LightboxHandle): LightboxHandleState {
  const state = handleStates.get(handle);
  if (!state) {
    throw new Error('Invalid Lightbox handle');
  }
  return state;
}

function notifyHandle(state: LightboxHandleState): void {
  state.version += 1;
  for (const listener of state.listeners) {
    listener();
  }
}

/**
 * Creates a new handle to control a Lightbox imperatively and to associate
 * detached Triggers with a Root.
 *
 * @example
 * const lightbox = Lightbox.createHandle();
 *
 * <Lightbox.Trigger handle={lightbox} id="hero" index={0}>…</Lightbox.Trigger>
 * <Lightbox.Root handle={lightbox}>…</Lightbox.Root>
 *
 * lightbox.open(0, { triggerId: 'hero' });
 */
function createHandle(): LightboxHandle {
  const state: LightboxHandleState = {
    host: null,
    triggers: new Map(),
    version: 0,
    listeners: new Set(),
  };

  const handle: LightboxHandle = {
    open(index?: number, options?: LightboxHandleOpenOptions) {
      if (!state.host) {
        if (process.env.NODE_ENV !== 'production') {
          console.warn(
            'LightboxHandle.open() was called before a Lightbox.Root with this handle was mounted.',
          );
        }
        return;
      }
      state.host.open(index, options);
    },
    close() {
      if (!state.host) {
        if (process.env.NODE_ENV !== 'production') {
          console.warn(
            'LightboxHandle.close() was called before a Lightbox.Root with this handle was mounted.',
          );
        }
        return;
      }
      state.host.close();
    },
    goTo(index: number) {
      if (!state.host) {
        if (process.env.NODE_ENV !== 'production') {
          console.warn(
            'LightboxHandle.goTo() was called before a Lightbox.Root with this handle was mounted.',
          );
        }
        return;
      }
      state.host.goTo(index);
    },
    get isOpen() {
      return state.host?.getOpen() ?? false;
    },
  };

  handleStates.set(handle, state);
  return handle;
}

/** @internal Notify detached Triggers that host open/index state changed. */
function notifyLightboxHandle(handle: LightboxHandle): void {
  notifyHandle(getHandleState(handle));
}

/** @internal Bind a mounted Root as the host for this handle. */
function bindLightboxHandle(handle: LightboxHandle, host: LightboxHandleHost): void {
  const state = getHandleState(handle);
  if (process.env.NODE_ENV !== 'production' && state.host && state.host !== host) {
    console.warn('Lightbox handle is already bound to another Root.');
  }
  state.host = host;
  for (const reg of state.triggers.values()) {
    host.syncTrigger(reg);
  }
  notifyHandle(state);
}

/** @internal */
function unbindLightboxHandle(handle: LightboxHandle, host: LightboxHandleHost): void {
  const state = getHandleState(handle);
  if (state.host === host) {
    state.host = null;
    notifyHandle(state);
  }
}

/**
 * @internal Register a trigger on the handle. Returns cleanup.
 * The registration object is mutated in place by Trigger; call
 * `touchHandleTrigger` after mutating element/image/morph fields.
 */
function registerHandleTrigger(
  handle: LightboxHandle,
  reg: LightboxHandleTriggerRegistration,
): () => void {
  const state = getHandleState(handle);
  const prev = state.triggers.get(reg.id);
  if (prev && prev !== reg) {
    state.host?.unsyncTrigger(prev);
  }
  state.triggers.set(reg.id, reg);
  state.host?.syncTrigger(reg);
  notifyHandle(state);
  return () => {
    if (state.triggers.get(reg.id) !== reg) return;
    state.triggers.delete(reg.id);
    state.host?.unsyncTrigger(reg);
    notifyHandle(state);
  };
}

/** @internal Re-sync a mutated registration object to the bound Root. */
function touchHandleTrigger(handle: LightboxHandle, reg: LightboxHandleTriggerRegistration): void {
  const state = getHandleState(handle);
  if (state.triggers.get(reg.id) !== reg) return;
  state.host?.syncTrigger(reg);
  notifyHandle(state);
}

/** @internal */
function getHandleTrigger(
  handle: LightboxHandle,
  id: string,
): LightboxHandleTriggerRegistration | undefined {
  return getHandleState(handle).triggers.get(id);
}

/** @internal Subscribe to handle host / trigger registration changes. */
function subscribeLightboxHandle(handle: LightboxHandle, onStoreChange: () => void): () => void {
  const state = getHandleState(handle);
  state.listeners.add(onStoreChange);
  return () => {
    state.listeners.delete(onStoreChange);
  };
}

/** @internal */
function getLightboxHandleVersion(handle: LightboxHandle): number {
  return getHandleState(handle).version;
}

/** @internal Snapshot for detached Trigger `useSyncExternalStore`. */
function getLightboxHandleSnapshot(handle: LightboxHandle): {
  open: boolean;
  activeIndex: number;
  version: number;
} {
  const state = getHandleState(handle);
  return {
    open: state.host?.getOpen() ?? false,
    activeIndex: state.host?.getActiveIndex() ?? 0,
    version: state.version,
  };
}

export { createHandle };
export type { LightboxHandle, LightboxHandleOpenOptions, LightboxHandleTriggerRegistration };
export {
  bindLightboxHandle,
  unbindLightboxHandle,
  notifyLightboxHandle,
  registerHandleTrigger,
  touchHandleTrigger,
  getHandleTrigger,
  subscribeLightboxHandle,
  getLightboxHandleVersion,
  getLightboxHandleSnapshot,
};
