/**
 * A/B open VT abort on Android Chrome emulator.
 * Modes via ?vtopenab=
 *   baseline | keeplock | lockbefore | lockafter | keepmounted
 * (keepmounted is toggled from the debug page; others patch at runtime)
 */
const CDP_HOST = '127.0.0.1:9222';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const MODE = process.argv[2] || 'baseline';
const BASE = `http://192.168.3.173:3000/debug/vt-gates?vtstock&vtopenab=${MODE}`;

async function getPageWs() {
  const pages = await fetch(`http://${CDP_HOST}/json`).then((r) => r.json());
  const page = pages.find((p) => p.url?.includes('vt-gates') && p.type === 'page') || pages[0];
  console.log('page', page.url);
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

async function main() {
  console.log('MODE', MODE);
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
    if (text.includes('[P]') || text.includes('InvalidState')) console.log(text.slice(0, 600));
  });

  await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      const mode = new URLSearchParams(location.search).get('vtopenab') || 'baseline';
      window.__RAMKA_VT_DEBUG__ = true;
      window.__RAMKA_VT_COMPOSITED__ = false;
      // Match real docs: don't force overflow unless mode says so.
      if (mode !== 'keeplock') {
        document.documentElement.style.overflow = '';
        document.body.style.overflow = '';
      }

      const snap = () => JSON.stringify({
        iw: innerWidth, ih: innerHeight,
        vv: visualViewport && {w:visualViewport.width,h:visualViewport.height,so:visualViewport.offsetTop},
        htmlOv: document.documentElement.style.overflow,
        prep: !!document.querySelector('[data-ramka-preparing], [data-preparing]'),
        dialogVis: (() => {
          const d = document.querySelector('[role="dialog"]');
          return d ? getComputedStyle(d).visibility : null;
        })(),
        portal: !!document.querySelector('[data-ramka-portal]'),
      });

      // Optional: move overflow:hidden lock outside the VT update callback.
      if (mode === 'lockbefore' || mode === 'lockafter') {
        const orig = document.startViewTransition.bind(document);
        document.startViewTransition = (cb) => {
          if (mode === 'lockbefore') {
            document.documentElement.style.overflow = 'hidden';
          }
          const t0 = performance.now();
          console.log('[P] svt-call', mode, snap());
          const t = orig(() => {
            console.log('[P] update-enter', Math.round(performance.now()-t0), snap());
            const r = cb();
            console.log('[P] update-exit', Math.round(performance.now()-t0), snap());
            return r;
          });
          t.ready.then(
            () => console.log('[P] ready-ok', Math.round(performance.now()-t0), snap()),
            (e) => console.log('[P] ready-reject', Math.round(performance.now()-t0), e.name, e.message, snap())
          );
          t.finished.then(() => {
            console.log('[P] finished', Math.round(performance.now()-t0), snap());
            if (mode === 'lockafter') {
              document.documentElement.style.overflow = 'hidden';
            }
          });
          return t;
        };
        return 'patched-' + mode;
      }

      const orig = document.startViewTransition.bind(document);
      document.startViewTransition = (cb) => {
        const t0 = performance.now();
        console.log('[P] svt-call', mode, snap());
        const onResize = () => console.log('[P] resize', Math.round(performance.now()-t0), snap());
        window.addEventListener('resize', onResize);
        const t = orig(() => {
          console.log('[P] update-enter', Math.round(performance.now()-t0), snap());
          const r = cb();
          console.log('[P] update-exit', Math.round(performance.now()-t0), snap());
          return r;
        });
        t.ready.then(
          () => console.log('[P] ready-ok', Math.round(performance.now()-t0), snap()),
          (e) => console.log('[P] ready-reject', Math.round(performance.now()-t0), e.name, e.message, snap())
        );
        t.finished.then(() => {
          window.removeEventListener('resize', onResize);
          console.log('[P] finished', Math.round(performance.now()-t0), snap());
        });
        return t;
      };
      return 'ok-' + mode;
    })()`,
  });

  // For keepmounted mode the page itself must enable it — set flag the page reads.
  if (MODE === 'keepmounted') {
    await cdp.send('Runtime.evaluate', {
      expression: `window.__VT_OPEN_AB_KEEPMOUNTED__ = true; location.reload()`,
    });
    await sleep(3500);
    // reinstall hooks after reload
    cdp.close();
    await sleep(400);
    cdp = createCdp(await getPageWs());
    await cdp.ready;
    await cdp.send('Runtime.enable');
    cdp.on('Runtime.consoleAPICalled', (p) => {
      const text = (p.args || []).map((a) => a.value ?? a.description ?? '').join(' ');
      if (text.includes('[P]') || text.includes('InvalidState')) console.log(text.slice(0, 600));
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
          console.log('[P] svt-call keepmounted');
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
  }

  const box = await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      const el = document.querySelector('[data-ramka-trigger]');
      const r = el.getBoundingClientRect();
      return {x:r.left+r.width/2,y:r.top+r.height/2, portal:!!document.querySelector('[data-ramka-portal]')};
    })()`,
    returnByValue: true,
  });
  console.log('pre-open', box.result?.value);

  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x: box.result.value.x, y: box.result.value.y, id: 0 }],
  });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await sleep(1200);
  cdp.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
