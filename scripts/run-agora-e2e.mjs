import { chromium } from 'playwright';

async function run() {
  const appId = process.argv[2];
  const token = process.argv[3] || '';
  const channel = process.argv[4] || 'test-channel';
  if (!appId) {
    console.error('Usage: node run-agora-e2e.mjs <APP_ID> [token] [channel]');
    process.exit(2);
  }

  const browser = await chromium.launch({
    headless: false,
    args: [
      '--use-fake-device-for-media-stream',
      '--use-fake-ui-for-media-stream',
    ],
  });
  // create context and grant permissions programmatically
  const context = await browser.newContext();
  await context.grantPermissions(['camera', 'microphone']);
  const page = await context.newPage();

  page.on('console', msg => console.log('PAGE:', msg.text()));

  try {
    await page.goto('http://localhost:3000/agora-test', { waitUntil: 'domcontentloaded' });
    await page.fill('#appId', appId);
    if (token) await page.fill('#token', token);
    await page.fill('#channel', channel);
    // leave token empty
    await page.click('text=Join');

    // wait for status to become 'joined' or local player to appear and ensure video has dimensions
    const joined = await Promise.race([
      page.waitForSelector('text=joined', { timeout: 30000 }).then(() => true).catch(() => false),
      (async () => {
        const el = await page.waitForSelector('#local-player', { timeout: 30000 }).catch(() => null);
        if (!el) return false;
        // wait until inner video / canvas reports width > 0 (some players render a <video> or canvas)
        for (let i = 0; i < 10; i++) {
          const dims = await page.evaluate(() => {
            const v = document.querySelector('#local-player video') as HTMLVideoElement | null;
            if (v) return { w: v.videoWidth, h: v.videoHeight };
            const c = document.querySelector('#local-player canvas') as HTMLCanvasElement | null;
            if (c) return { w: c.width, h: c.height };
            const d = document.getElementById('local-player');
            if (d) return { w: d.clientWidth, h: d.clientHeight };
            return { w: 0, h: 0 };
          });
          if ((dims.w || dims.h) && (dims.w > 0 || dims.h > 0)) return true;
          await page.waitForTimeout(500);
        }
        return false;
      })(),
    ]);

    if (joined) {
      console.log('E2E: joined / local player detected');
      await page.screenshot({ path: 'agora-test-screenshot.png' });
      await browser.close();
      process.exit(0);
    } else {
      console.error('E2E: failed to join or local player not found');
      await page.screenshot({ path: 'agora-test-failure.png' });
      await browser.close();
      process.exit(1);
    }
  } catch (err) {
    console.error('E2E error', err);
    await browser.close();
    process.exit(3);
  }
}

run();
