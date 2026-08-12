/**
 * Emulator CDP probe: open lightbox → close via X / programmatic setOpen.
 * Logs VT ready/finished + Abort reason.
 */
const CDP_HOST = '127.0.0.1:9222';
const BASE = 'http://192.168.3.173:3000/debug/vt-gates?vtstock';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getPageWs() {
  const pages = await fetch(`http://${CDP_HOST}/json`).then((r) => r.json());
  const page = pages.find((p) => p.url?.includes('vt-gates') && p.type === 'page') || pages[0];
  console.log('page', page.id, page.url);
  return page.webSocketDebuggerUrl;
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

async function installHooks(cdp) {
  await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      window.__RAMKA_VT_DEBUG__ = true;
      window.__RAMKA_VT_COMPOSITED__ = false;
      document.documentElement.style.overflow = '';
      document.body.style.overflow = '';
      if (window.__VT_PROBE_INSTALLED__) return 'already';
      window.__VT_PROBE_INSTALLED__ = true;
      const orig = document.startViewTransition.bind(document);
      document.startViewTransition = (cb) => {
        const t0 = performance.now();
        const snap = () => ({
          iw: innerWidth, ih: innerHeight,
          vv: visualViewport ? { w: visualViewport.width, h: visualViewport.height, so: visualViewport.offsetTop } : null,
          htmlOv: document.documentElement.style.overflow,
          bodyOv: document.body.style.overflow,
          vtNames: [...document.querySelectorAll('[style*="view-transition-name"], [data-ramka-vt-morph]')].length,
          portal: !!document.querySelector('[data-ramka-portal], [data-slot="lightbox-portal"]'),
          content: !!document.querySelector('[data-ramka-content], [role="dialog"]'),
        });
        console.log('[P] svt-call', JSON.stringify(snap()));
        const t = orig(() => {
          console.log('[P] update-enter', Math.round(performance.now()-t0), JSON.stringify(snap()));
          const r = cb();
          console.log('[P] update-exit', Math.round(performance.now()-t0), JSON.stringify(snap()));
          return r;
        });
        t.ready.then(
          () => {
            const anims = document.getAnimations().filter(a => (a.effect?.pseudoElement||'').startsWith('::view-transition'));
            console.log('[P] ready-ok', Math.round(performance.now()-t0), 'anims', anims.length, JSON.stringify(snap()));
          },
          (e) => console.log('[P] ready-reject', Math.round(performance.now()-t0), e.name, e.message, JSON.stringify(snap()))
        );
        t.finished.then(
          () => console.log('[P] finished', Math.round(performance.now()-t0), JSON.stringify(snap())),
          (e) => console.log('[P] finished-reject', Math.round(performance.now()-t0), e?.name, e?.message)
        );
        const onResize = () => console.log('[P] resize', Math.round(performance.now()-t0), JSON.stringify(snap()));
        window.addEventListener('resize', onResize);
        t.finished.finally(() => window.removeEventListener('resize', onResize));
        return t;
      };
      return 'ok';
    })()`,
  });
}

async function tap(cdp, sel) {
  const box = await cdp.send('Runtime.evaluate', {
    expression:
      '(() => { const el = document.querySelector(' +
      JSON.stringify(sel) +
      '); if (!el) return null; const r = el.getBoundingClientRect(); return {x:r.left+r.width/2,y:r.top+r.height/2, visible: r.width>0 && r.height>0}; })()',
    returnByValue: true,
  });
  const t = box.result?.value;
  console.log('tap', sel, t);
  if (!t) return null;
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x: t.x, y: t.y, id: 0 }],
  });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  return t;
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
    if (text.includes('[P]') || text.includes('[ramka') || text.includes('InvalidState')) {
      console.log(text.slice(0, 900));
    }
  });
  await installHooks(cdp);

  console.log('=== OPEN ===');
  await tap(cdp, '[data-ramka-trigger]');
  await sleep(1200);

  const state = await cdp.send('Runtime.evaluate', {
    expression: `(() => ({
      close: !!document.querySelector('button[aria-label="Close"]'),
      dialog: !!document.querySelector('[role="dialog"]'),
      closes: document.querySelectorAll('button[aria-label="Close"]').length,
    }))()`,
    returnByValue: true,
  });
  console.log('after-open', state.result?.value);

  console.log('=== CLOSE X ===');
  await tap(cdp, 'button[aria-label="Close"]');
  await sleep(1200);

  console.log('=== OPEN2 ===');
  await tap(cdp, '[data-ramka-trigger]');
  await sleep(1200);

  console.log('=== CLOSE via Escape key ===');
  await cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', windowsVirtualKeyCode: 27, key: 'Escape', code: 'Escape' });
  await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', windowsVirtualKeyCode: 27, key: 'Escape', code: 'Escape' });
  await sleep(1200);

  cdp.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
