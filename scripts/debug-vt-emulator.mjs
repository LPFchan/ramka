#!/usr/bin/env node
/**
 * Drive Pixel emulator Chrome via CDP: open lightbox → pull-dismiss → dump VT probes.
 * Usage: node scripts/debug-vt-emulator.mjs
 */
const CDP_HOST = '127.0.0.1:9222';

async function getPageWs() {
  const pages = await fetch(`http://${CDP_HOST}/json`).then((r) => r.json());
  const page =
    pages.find((p) => p.url?.includes('/debug/vt-gates')) ||
    pages.find((p) => p.type === 'page');
  if (!page?.webSocketDebuggerUrl) throw new Error('No Chrome page found via CDP');
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
    return new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject });
    });
  };

  const on = (method, fn) => {
    if (!listeners.has(method)) listeners.set(method, new Set());
    listeners.get(method).add(fn);
    return () => listeners.get(method).delete(fn);
  };

  return { ready, send, on, close: () => ws.close() };
}

async function main() {
  const wsUrl = await getPageWs();
  const cdp = createCdp(wsUrl);
  await cdp.ready;

  await cdp.send('Runtime.enable');
  await cdp.send('Page.enable');
  await cdp.send('DOM.enable');
  await cdp.send('Overlay.disable').catch(() => {});

  const consoleLines = [];
  cdp.on('Runtime.consoleAPICalled', (params) => {
    const text = (params.args || [])
      .map((a) => a.value ?? a.description ?? '')
      .join(' ');
    if (
      text.includes('[ramka-vt') ||
      text.includes('[vt-probe]') ||
      text.includes('ramka-vt-trace')
    ) {
      consoleLines.push({ type: params.type, text: text.slice(0, 4000) });
      console.log('CONSOLE:', text.slice(0, 500));
    }
  });

  // Install probes: viewport tracking + wrap startViewTransition.
  await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      window.__RAMKA_VT_DEBUG__ = true;
      window.__VT_PROBES__ = [];
      const push = (kind, extra = {}) => {
        const vv = window.visualViewport;
        const row = {
          t: performance.now(),
          kind,
          inner: [innerWidth, innerHeight],
          outer: [outerWidth, outerHeight],
          vv: vv ? [vv.width, vv.height, vv.offsetTop, vv.scale] : null,
          screen: [screen.width, screen.height],
          avt: !!document.querySelector('html:active-view-transition'),
          ...extra,
        };
        window.__VT_PROBES__.push(row);
        console.log('[vt-probe]', JSON.stringify(row));
        return row;
      };
      push('install');
      for (const ev of ['resize', 'orientationchange']) {
        window.addEventListener(ev, () => push('window-' + ev));
      }
      visualViewport?.addEventListener('resize', () => push('vv-resize'));
      visualViewport?.addEventListener('scroll', () => push('vv-scroll'));

      const orig = document.startViewTransition?.bind(document);
      if (!orig || document.startViewTransition.__vtProbed) return 'already';
      document.startViewTransition = (cb) => {
        push('svt-call');
        const t = orig(cb);
        t.ready.then(
          () => push('svt-ready-ok'),
          (e) => push('svt-ready-reject', { err: String(e && e.message || e), name: e && e.name })
        );
        t.finished.then(
          () => push('svt-finished', { avtAfter: !!document.querySelector('html:active-view-transition') }),
          (e) => push('svt-finished-reject', { err: String(e && e.message || e) })
        );
        return t;
      };
      document.startViewTransition.__vtProbed = true;
      return 'ok';
    })()`,
    returnByValue: true,
  });

  // Find first trigger image center.
  const box = await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      const el = document.querySelector('[data-ramka-trigger]') || document.querySelector('img');
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: r.left + r.width/2, y: r.top + r.height/2, w: r.width, h: r.height, innerH: innerHeight, innerW: innerWidth };
    })()`,
    returnByValue: true,
  });
  const target = box.result?.value;
  if (!target) throw new Error('No trigger found');
  console.log('TAP target', target);

  // Tap to open.
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x: target.x, y: target.y, id: 0 }],
  });
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchEnd',
    touchPoints: [],
  });
  console.log('Tapped open, waiting…');
  await new Promise((r) => setTimeout(r, 1200));

  // Pull-to-dismiss: vertical drag from center downward.
  const x = target.innerW / 2;
  const y0 = target.innerH * 0.45;
  const y1 = target.innerH * 0.9;
  const steps = 12;
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x, y: y0, id: 0 }],
  });
  for (let i = 1; i <= steps; i++) {
    const y = y0 + ((y1 - y0) * i) / steps;
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x, y, id: 0 }],
    });
    await new Promise((r) => setTimeout(r, 16));
  }
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchEnd',
    touchPoints: [],
  });
  console.log('Pulled to dismiss, waiting…');
  await new Promise((r) => setTimeout(r, 1500));

  const probes = await cdp.send('Runtime.evaluate', {
    expression: `JSON.stringify({ probes: window.__VT_PROBES__ || [], logCount: document.querySelectorAll('pre').length }, null, 2)`,
    returnByValue: true,
  });
  console.log('\n=== PROBES ===\n', probes.result?.value);

  // Also try X-close path: reopen then click close.
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x: target.x, y: target.y, id: 0 }],
  });
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchEnd',
    touchPoints: [],
  });
  await new Promise((r) => setTimeout(r, 1000));

  const closeBtn = await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      const el = document.querySelector('[data-ramka-close], button[aria-label="Close"]');
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: r.left + r.width/2, y: r.top + r.height/2 };
    })()`,
    returnByValue: true,
  });
  if (closeBtn.result?.value) {
    const c = closeBtn.result.value;
    console.log('X close at', c);
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ x: c.x, y: c.y, id: 0 }],
    });
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchEnd',
      touchPoints: [],
    });
    await new Promise((r) => setTimeout(r, 1200));
  } else {
    console.log('Close button not found');
  }

  const probes2 = await cdp.send('Runtime.evaluate', {
    expression: `JSON.stringify(window.__VT_PROBES__ || [], null, 2)`,
    returnByValue: true,
  });
  console.log('\n=== ALL PROBES ===\n', probes2.result?.value);
  console.log('\n=== CONSOLE SNIPS ===\n', JSON.stringify(consoleLines, null, 2));

  cdp.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
