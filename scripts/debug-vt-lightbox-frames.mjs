const CDP_HOST = '127.0.0.1:9222';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getPageWs() {
  const pages = await fetch(`http://${CDP_HOST}/json`).then((r) => r.json());
  return (pages.find((p) => p.url?.includes('vt-gates')) || pages[0]).webSocketDebuggerUrl;
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
  await cdp.send('Page.navigate', {
    url: 'http://192.168.3.173:3000/debug/vt-gates?vtstock',
  });
  await sleep(3000);
  cdp.close();
  await sleep(400);
  cdp = createCdp(await getPageWs());
  await cdp.ready;
  await cdp.send('Runtime.enable');
  cdp.on('Runtime.consoleAPICalled', (p) => {
    const text = (p.args || []).map((a) => a.value ?? a.description ?? '').join(' ');
    if (text.includes('[L]') || text.includes('InvalidState')) console.log(text.slice(0, 700));
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
        console.log('[L] svt-call');
        const t = orig(() => {
          console.log('[L] update-enter', Math.round(performance.now()-t0));
          const r = cb();
          console.log('[L] update-exit', Math.round(performance.now()-t0));
          return r;
        });
        t.ready.then(
          () => {
            const anims = document.getAnimations().filter(a => (a.effect?.pseudoElement||'').startsWith('::view-transition'));
            console.log('[L] ready-ok', Math.round(performance.now()-t0), JSON.stringify(anims.map(a => ({p:a.effect.pseudoElement, n:a.animationName, st:a.playState, ct:a.currentTime}))));
          },
          (e) => console.log('[L] ready-reject', Math.round(performance.now()-t0), e.name, e.message)
        );
        t.finished.then(() => console.log('[L] finished', Math.round(performance.now()-t0)));
        let n=0;
        const tick = () => {
          const anims = document.getAnimations().filter(a => (a.effect?.pseudoElement||'').includes('view-transition'));
          console.log('[L] frame', n, Math.round(performance.now()-t0), JSON.stringify(anims.map(a => ({p:a.effect.pseudoElement, n:a.animationName, st:a.playState, ct:a.currentTime}))));
          if (++n < 10) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
        return t;
      };
      return 'ok';
    })()`,
  });

  const tap = async (sel) => {
    const box = await cdp.send('Runtime.evaluate', {
      expression:
        '(() => { const el = document.querySelector(' +
        JSON.stringify(sel) +
        '); if (!el) return null; const r = el.getBoundingClientRect(); return {x:r.left+r.width/2,y:r.top+r.height/2}; })()',
      returnByValue: true,
    });
    const t = box.result?.value;
    if (!t) {
      console.log('missing', sel);
      return null;
    }
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ x: t.x, y: t.y, id: 0 }],
    });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    return t;
  };

  console.log('=== OPEN ===');
  await tap('[data-ramka-trigger]');
  await sleep(1100);
  console.log('=== CLOSE X ===');
  await tap('button[aria-label="Close"]');
  await sleep(1100);
  cdp.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
