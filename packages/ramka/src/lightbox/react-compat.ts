/**
 * The handful of places where React 18 and React 19 disagree, kept in one file
 * so the package can honestly claim `react >= 18`.
 */

/**
 * `inert` props that survive both versions.
 *
 * Each version silently drops the other's spelling (with a console warning),
 * which would leave parked dialogs and inactive slides focusable:
 *
 * | prop            | React 18        | React 19   |
 * | --------------- | --------------- | ---------- |
 * | `inert={true}`  | dropped         | `inert=""` |
 * | `inert=""`      | `inert=""`      | dropped    |
 * | `inert="inert"` | `inert="inert"` | `inert=""` |
 *
 * A non-empty string is the one form both keep, and HTML treats any value on a
 * boolean attribute as true. React 19 normalizes it to `inert=""` anyway.
 */
const INERT_PROP = { inert: 'inert' } as unknown as { inert?: boolean };

/** Spread into element props to mark a subtree inert when `condition` holds. */
function inertWhen(condition: boolean): { inert?: boolean } {
  return condition ? INERT_PROP : {};
}

/**
 * A ref whose `current` is always present — internal registries seeded with a
 * `Map`, a counter, a flag.
 *
 * `React.RefObject<T>` cannot express that across versions: @types/react 19
 * reads it as `{ current: T }`, but 18 reads it as `{ current: T | null }`, so
 * every read of a registry would need a null check that can never fire.
 * Spelling the shape out satisfies both, and `useRef<T>(seed)` returns
 * something structurally assignable to it either way.
 */
type InitializedRef<T> = { current: T };

export { inertWhen };
export type { InitializedRef };
