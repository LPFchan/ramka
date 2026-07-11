import { networkInterfaces } from 'node:os';
import qrcode from 'qrcode-terminal';

const PORT = process.env.PORT ?? '3000';

function getLocalNetworkAddress() {
  const nets = networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] ?? []) {
      // Skip internal (127.0.0.1) and non-IPv4 addresses.
      if (net.family === 'IPv4' && !net.internal) {
        return net.address;
      }
    }
  }
  return null;
}

async function waitForServer(url, { timeoutMs = 60_000, intervalMs = 500 } = {}) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), intervalMs);
      await fetch(url, { signal: controller.signal });
      clearTimeout(timer);
      return true;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
  }
  return false;
}

async function main() {
  const ip = getLocalNetworkAddress();
  if (!ip) {
    console.log('\n[dev-qr] Could not determine a local network address; skipping QR code.\n');
    return;
  }

  const url = `http://${ip}:${PORT}`;

  // Wait until Next is actually responding so the QR appears after "Ready".
  await waitForServer(url);

  qrcode.generate(url, { small: true }, (qr) => {
    console.log('\n  Scan to open the docs on your phone (same Wi-Fi):');
    console.log(`  ${url}\n`);
    console.log(qr);
  });
}

main();
