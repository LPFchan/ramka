/**
 * Async chunk entry for the pull-to-close engine.
 * Loaded when `Lightbox.Content` mounts with `pullToClose` enabled (the
 * default). Pass `pullToClose={false}` to skip that download.
 */

import { usePullToDismiss, type PullToDismissOptions } from './use-pull-to-dismiss';

function PullToDismiss(props: PullToDismissOptions) {
  usePullToDismiss(props);
  return null;
}

export { PullToDismiss };
export type { PullToDismissOptions };
