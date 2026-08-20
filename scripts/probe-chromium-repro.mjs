const CDP_HOST = '127.0.0.1:9222';
const URL =
  'http://192.168.3.219:3000/debug/chromium-url-bar.html?t=' + Date.now();
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

async function main() {
  const list = await pages();
  const page = list.find((p) => p.type === 'page' && p.url?.includes('3000')) || list.find((p) => p.type === 'page');
  const cdp = createCdp(page.webSocketDebuggerUrl);
  await cdp.ready;
  await cdp.send('Runtime.enable');
  await cdp.send('Page.enable');
  await cdp.send('Input.setIgnoreInputEvents', { ignore: false }).catch(() => {});
  await cdp.send('Page.navigate', { url: URL });
  await sleep(2800);

  const start = await evaluate(cdp, `({inner:window.innerHeight, vv:window.visualViewport&&Math.round(window.visualViewport.height), y:window.scrollY})`);
  console.log('at load', JSON.stringify(start));

  // Flick the page so the URL bar animates, then tap a mid-page photo.
  await evaluate(
    cdp,
    `(async () => {
      const el = document.querySelectorAll('.thumb')[0];
      const r = el.getBoundingClientRect();
      const y = window.scrollY + r.top - 120;
      window.scrollTo(0, Math.max(0, y));
      await new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(res)));
      return { inner: window.innerHeight, vv: window.visualViewport && Math.round(window.visualViewport.height), y: window.scrollY };
    })()`,
  );
  await sleep(50);
  const mid = await evaluate(cdp, `({inner:window.innerHeight, vv:window.visualViewport&&Math.round(window.visualViewport.height), y:window.scrollY, msg:document.getElementById('msg').textContent})`);
  console.log('after jump', JSON.stringify(mid));

  // Smooth-ish scroll via several steps, then click immediately.
  const afterFlick = await evaluate(
    cdp,
    `(async () => {
      const startY = window.scrollY;
      for (let i = 1; i <= 8; i++) {
        window.scrollTo(0, startY + i * 24);
        await new Promise((r) => requestAnimationFrame(r));
      }
      const sizes = { inner: window.innerHeight, vv: window.visualViewport && Math.round(window.visualViewport.height), y: window.scrollY };
      document.querySelectorAll('.thumb')[0].click();
      await new Promise((r) => setTimeout(r, 900));
      return {
        sizes,
        msg: document.getElementById('msg').textContent,
        cls: document.getElementById('status').className,
      };
    })()`,
  );
  console.log('flick+tap', JSON.stringify(afterFlick, null, 2));
  cdp.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
