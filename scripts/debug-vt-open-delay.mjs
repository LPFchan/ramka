const CDP_HOST = '127.0.0.1:9222';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const withTimeout = (p, ms, label) =>
  Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout ' + label)), ms))]);

async function trial(label) {
  console.log('\n===', label, '===');
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
        if (text.includes('[P]')) console.log(text.slice(0, 250));
      }
    };
  };
  hook();
  const send = (method, params = {}) => {
    const id = nextId++;
    ws.send(JSON.stringify({ id, method, params }));
    return withTimeout(new Promise((resolve, reject) => pending.set(id, { resolve, reject })), 12000, method);
  };
  await send('Page.enable');
  await send('Page.navigate', {
    url: 'http://192.168.3.173:3000/debug/vt-gates?vtstock&t=' + Date.now() + Math.random(),
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
      const orig = document.startViewTransition.bind(document);
      document.startViewTransition = (cb) => {
        const t0 = performance.now();
        console.log('[P] svt');
        const t = orig(cb);
        t.ready.then(
          () => console.log('[P] ready-ok', Math.round(performance.now() - t0)),
          (e) => console.log('[P] ready-reject', Math.round(performance.now() - t0), e.name),
        );
        t.finished.then(() => console.log('[P] finished', Math.round(performance.now() - t0)));
        return t;
      };
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

const ms = Number(process.argv[2] || 50);
const { readFileSync, writeFileSync } = await import('fs');
const path = 'packages/ramka/src/lightbox/use-view-transition-morph.ts';
let text = readFileSync(path, 'utf8');
text = text.replace(/setTimeout\(resolve, \d+\)/, `setTimeout(resolve, ${ms})`);
writeFileSync(path, text);
console.log('delay set to', ms);
await sleep(2500);
await trial(ms + 'ms');
