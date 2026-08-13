/** Measure layout-viewport / overflow around lightbox open VT. */
const CDP_HOST = '127.0.0.1:9222';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const withTimeout = (p, ms, label) =>
  Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout ' + label)), ms))]);

async function main() {
  let pages = await fetch(`http://${CDP_HOST}/json`).then((r) => r.json());
  let page = pages.find((p) => p.url?.includes('vt-gates')) || pages[0];
  let ws = new WebSocket(page.webSocketDebuggerUrl);
  let nextId = 1;
  const pending = new Map();
  await new Promise((res, rej) => {
    ws.onopen = res;
    ws.onerror = rej;
  });
  const hook = () => {
    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.id != null && pending.has(msg.id)) {
        const { resolve, reject } = pending.get(msg.id);
        pending.delete(msg.id);
        msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result);
      } else if (msg.method === 'Runtime.consoleAPICalled') {
        const text = (msg.params.args || []).map((a) => a.value ?? a.description ?? '').join(' ');
        if (text.includes('[SCB]')) console.log(text.slice(0, 1200));
      }
    };
  };
  hook();
  const send = (method, params = {}) => {
    const id = nextId++;
    ws.send(JSON.stringify({ id, method, params }));
    return withTimeout(new Promise((resolve, reject) => pending.set(id, { resolve, reject })), 15000, method);
  };

  await send('Page.enable');
  await send('Page.navigate', {
    url: 'http://192.168.3.173:3000/debug/vt-gates?vtstock&t=' + Date.now(),
  });
  await sleep(4500);
  ws.close();
  await sleep(400);
  pages = await fetch(`http://${CDP_HOST}/json`).then((r) => r.json());
  page = pages.find((p) => p.url?.includes('vt-gates')) || pages[0];
  ws = new WebSocket(page.webSocketDebuggerUrl);
  nextId = 1;
  pending.clear();
  await new Promise((res, rej) => {
    ws.onopen = res;
    ws.onerror = rej;
  });
  hook();
  await send('Runtime.enable');
  await send('Runtime.evaluate', {
    expression: `(() => {
      window.__RAMKA_VT_DEBUG__ = true;
      window.__RAMKA_VT_COMPOSITED__ = false;
      document.documentElement.style.overflow = '';
      document.body.style.overflow = '';
      const snap = (label) => {
        const html = document.documentElement;
        const body = document.body;
        const vv = visualViewport;
        const wide = [];
        for (const el of document.querySelectorAll('*')) {
          const r = el.getBoundingClientRect();
          if (r.width > innerWidth + 1 || el.scrollWidth > html.clientWidth + 1) {
            wide.push({
              t: el.tagName,
              c: (el.className && String(el.className).slice(0, 80)) || el.getAttribute('data-ramka-portal') != null ? 'portal' : '',
              rw: Math.round(r.width),
              rh: Math.round(r.height),
              sw: el.scrollWidth,
              sh: el.scrollHeight,
              pos: getComputedStyle(el).position,
            });
            if (wide.length >= 8) break;
          }
        }
        return {
          label,
          inner: [innerWidth, innerHeight],
          client: [html.clientWidth, html.clientHeight],
          scroll: [html.scrollWidth, html.scrollHeight],
          bodyScroll: [body.scrollWidth, body.scrollHeight],
          vv: vv && { w: vv.width, h: vv.height, so: vv.offsetTop, sl: vv.offsetLeft, scale: vv.scale },
          screen: [screen.width, screen.height],
          htmlOv: html.style.overflow + '/' + getComputedStyle(html).overflow,
          portal: !!document.querySelector('[data-ramka-portal]'),
          wide,
        };
      };
      const orig = document.startViewTransition.bind(document);
      document.startViewTransition = (cb) => {
        const t0 = performance.now();
        console.log('[SCB] svt', JSON.stringify(snap('svt')));
        const t = orig(() => {
          console.log('[SCB] enter', JSON.stringify(snap('enter')));
          const r = cb();
          console.log('[SCB] exit', JSON.stringify(snap('exit')));
          return r;
        });
        t.ready.then(
          () => console.log('[SCB] ready-ok', Math.round(performance.now() - t0), JSON.stringify(snap('ready'))),
          (e) => console.log('[SCB] ready-reject', Math.round(performance.now() - t0), e.name, e.message, JSON.stringify(snap('reject'))),
        );
        t.finished.then(() => console.log('[SCB] finished', Math.round(performance.now() - t0), JSON.stringify(snap('fin'))));
        return t;
      };
      console.log('[SCB] pre', JSON.stringify(snap('pre')));
      return 'ok';
    })()`,
  });
  const box = await send('Runtime.evaluate', {
    expression: `(() => { const el=document.querySelector('[data-ramka-trigger]'); const r=el.getBoundingClientRect(); return {x:r.left+r.width/2,y:r.top+r.height/2}; })()`,
    returnByValue: true,
  });
  const { x, y } = box.result.value;
  await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 0 }] });
  await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await sleep(1600);
  ws.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
