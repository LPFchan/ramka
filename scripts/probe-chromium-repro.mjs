const CDP_HOST = '127.0.0.1:9222';
const BASE = 'http://192.168.3.219:3000';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function pages() {
  return fetch(`http://${CDP_HOST}/json`).then((r) => r.json());
}

function createCdp(wsUrl) {
  const ws = new WebSocket(wsUrl);
  let nextId = 1;
  const pending = new Map();
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
    }
  });
  const send = (method, params = {}) => {
    const id = nextId++;
    return new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params }));
    });
  };
  return { ready, send, close: () => ws.close() };
}

async function evaluate(cdp, expression) {
  const result = await cdp.send('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.text || JSON.stringify(result.exceptionDetails));
  }
  return result.result.value;
}

const OVERLAY = `(async () => {
  const size = () => [window.innerWidth, window.innerHeight];
  const twoFrames = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  let resizes = 0, fake = 0;
  const base = String(size());
  const onResize = () => { resizes += 1; if (String(size()) === base) fake += 1; };
  window.addEventListener('resize', onResize);
  const el = document.createElement('div');
  el.className = 'lightbox-demo-content';
  el.style.cssText = 'position:fixed;inset:0;overflow:hidden;z-index:99999;background:rgba(255,0,0,.3)';
  el.style.setProperty('--lightbox-inset-top', 'calc(4rem + env(safe-area-inset-top, 0px))');
  el.style.setProperty('--lightbox-inset-bottom', 'calc(4rem + env(safe-area-inset-bottom, 0px))');
  document.body.append(el);
  document.documentElement.style.overflow = 'hidden';
  void el.offsetHeight;
  await twoFrames();
  el.style.display = 'none';
  await twoFrames();
  el.remove();
  document.documentElement.style.overflow = '';
  window.removeEventListener('resize', onResize);
  return { resizes, fake, inner: size(), href: location.pathname };
})()`;

async function main() {
  const list = await pages();
  const page = list.find((p) => p.type === 'page' && p.url?.includes('3000')) || list.find((p) => p.type === 'page');
  const cdp = createCdp(page.webSocketDebuggerUrl);
  await cdp.ready;
  await cdp.send('Runtime.enable');
  await cdp.send('Page.enable');

  const t = Date.now();

  await cdp.send('Page.navigate', { url: BASE + '/debug/chromium-safe-area-resize.html?t=' + t });
  await sleep(2800);
  const s1 = await evaluate(cdp, `({inner:window.innerHeight, viewport:document.querySelector('meta[name=viewport]').content})`);
  const tap2 = await evaluate(cdp, `(async () => {
    const status = document.getElementById('status');
    document.getElementById('go').click();
    await new Promise((r) => setTimeout(r, 500));
    return { status: status.textContent, cls: status.className, inner: window.innerHeight };
  })()`);
  console.log('02 meta/size', JSON.stringify(s1));
  console.log('02 tap', JSON.stringify(tap2));
  console.log('02 inject', JSON.stringify(await evaluate(cdp, OVERLAY)));

  await cdp.send('Page.navigate', { url: BASE + '/debug/chromium-url-bar.html?t=' + Date.now() });
  await sleep(2800);
  const tap1 = await evaluate(cdp, `(async () => {
    const status = document.getElementById('status');
    document.getElementById('thumb').click();
    await new Promise((r) => setTimeout(r, 1800));
    return { status: status.textContent, cls: status.className, inner: window.innerHeight };
  })()`);
  console.log('01 tap', JSON.stringify(tap1));
  cdp.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
