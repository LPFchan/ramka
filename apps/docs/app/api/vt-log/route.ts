import { appendFile } from 'node:fs/promises';

const LOG_FILE = '/tmp/ramka-vt-log.jsonl';

/**
 * Dev-only sink for ramka's View Transition debug traces (see vt-debug.ts in
 * the ramka package). Lets a phone connected over adb reverse-port-forwarding
 * deliver per-frame traces to the machine running the dev server, where
 * release Firefox for Android offers no console access.
 */
export async function POST(req: Request) {
  const body = await req.text();
  // eslint-disable-next-line no-console -- visible in the dev server terminal
  console.log(`[vt-log] received trace (${body.length} bytes) -> ${LOG_FILE}`);
  await appendFile(LOG_FILE, `${body}\n`);
  return new Response('ok');
}
