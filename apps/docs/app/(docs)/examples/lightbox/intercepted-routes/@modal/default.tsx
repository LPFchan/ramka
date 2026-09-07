/**
 * Required for every parallel-route slot: rendered whenever the current URL
 * has no match inside `@modal` — the grid page, the standalone photo page on
 * a hard load, and any unmatched sibling route. Without it those URLs 404.
 */
export default function ModalDefault() {
  return null;
}
