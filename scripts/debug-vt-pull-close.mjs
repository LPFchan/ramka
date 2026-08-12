/** Open lightbox then pull-to-dismiss; log VT duration. */
const CDP_HOST = '127.0.0.1:9222';
const BASE = 'http://192.168.3.173:3000/debug/vt-gates?vtstock';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getPageWs() {
  const pages = await fetch(`http://${CDP_HOST}/json`).then((r) => r.json());
  return (pages.find((p) => p.url?.includes('vt-gates') && p.type === 'page') || pages[0])
    .webSocketDebuggerUrl;
}

function createCdp(wsUrl) {
  const ws = new WebSocket(wsUrl);
  let nextId = 1;
  const pending = new Map();
  const listeners = new Map();
  const ready = new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve);
    ws.addEventListener('error', reject);
  });
  ws.addEventListener('message', (event) => {
    const msg = JSON.parse(String(event.data));
    if (msg.id != null && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(JSON.stringify(msg.error)));
      else resolve(msg.result);
      return;
    }
    if (msg.method && listeners.has(msg.method)) {
      for (const fn of listeners.get(msg.method)) fn(msg.params);
    }
  });
  const send = (method, params = {}) => {
    const id = nextId++;
    ws.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
  };
  const on = (method, fn) => {
    if (!listeners.has(method)) listeners.set(method, new Set());
    listeners.get(method).add(fn);
  };
  return { ready, send, on, close: () => ws.close() };
}

async function main() {
  let cdp = createCdp(await getPageWs());
  await cdp.ready;
  await cdp.send('Page.enable');
  await cdp.send('Page.navigate', { url: BASE });
  await sleep(3500);
  cdp.close();
  await sleep(400);

  cdp = createCdp(await getPageWs());
  await cdp.ready;
  await cdp.send('Runtime.enable');
  cdp.on('Runtime.consoleAPICalled', (p) => {
    const text = (p.args || []).map((a) => a.value ?? a.description ?? '').join(' ');
    if (text.includes('[P]') || text.includes('InvalidState') || text.includes('[ramka-vt')) {
      console.log(text.slice(0, 500));
    }
  });

  await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      window.__RAMKA_VT_DEBUG__ = true;
      window.__RAMKA_VT_COMPOSITED__ = false;
      document.documentElement.style.overflow = '';
      document.body.style.overflow = '';
      const orig = document.startViewTransition.bind(document);
      document.startViewTransition = (cb) => {
        const t0 = performance.now();
        console.log('[P] svt');
        const t = orig(cb);
        t.ready.then(
          () => console.log('[P] ready-ok', Math.round(performance.now()-t0)),
          (e) => console.log('[P] ready-reject', Math.round(performance.now()-t0), e.name, e.message)
        );
        t.finished.then(() => console.log('[P] finished', Math.round(performance.now()-t0)));
        return t;
      };
      return 'ok';
    })()`,
  });

  const box = await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      const el = document.querySelector('[data-ramka-trigger]');
      const r = el.getBoundingClientRect();
      return {x:r.left+r.width/2,y:r.top+r.height/2};
    })()`,
    returnByValue: true,
  });
  const t = box.result.value;
  console.log('=== OPEN ===', t);
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x: t.x, y: t.y, id: 0 }],
  });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await sleep(1200);

  // Pull-to-dismiss from center of dialog
  const dialog = await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      const el = document.querySelector('[role="dialog"]');
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return {x:r.left+r.width/2,y:r.top+r.height/2};
    })()`,
    returnByValue: true,
  });
  const d = dialog.result?.value;
  console.log('=== PULL CLOSE ===', d);
  if (!d) {
    cdp.close();
    return;
  }
  const startY = d.y;
  const endY = Math.min(d.y + 320, 800);
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x: d.x, y: startY, id: 0 }],
  });
  for (let i = 1; i <= 8; i++) {
    const y = startY + ((endY - startY) * i) / 8;
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x: d.x, y, id: 0 }],
    });
    await sleep(16);
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await sleep(1200);
  cdp.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
