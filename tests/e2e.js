// End-to-end: fake camera (moving video) + fake mic (spoken question) -> real Gemini Live.
//   python tests/make_fixtures.py && python main.py &   then   node tests/e2e.js

const { chromium } = require('playwright');
const path = require('path');
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const scenes = ['apple + HELLO EP6', 'banana sliding', 'hand rising', 'STOP sign'];
(async () => {
  const browser = await chromium.launch({ args: [
    '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream',
    `--use-file-for-fake-video-capture=${path.resolve(__dirname, 'fixtures/camera.y4m')}`,
    `--use-file-for-fake-audio-capture=${path.resolve(__dirname, 'fixtures/mic.wav')}`,
    '--autoplay-policy=no-user-gesture-required',
  ]});
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, permissions: ['camera', 'microphone'],
    recordVideo: { dir: path.resolve(__dirname, 'out'), size: { width: 1440, height: 900 } } });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(e.message)); page.on('console', m => { if (m.type()==='error') errs.push(m.text()); });
  const t0 = Date.now(); const scene = () => scenes[Math.floor(((Date.now()-t0)/1000 % 20) / 5)];
  const state = () => page.evaluate(() => ({ you: document.getElementById('youText').textContent, agent: document.getElementById('agentText').textContent,
      hint: document.getElementById('hint').textContent, badge: document.getElementById('watchBadge').textContent,
      frames: window.EYES.frames, tokens: window.EYES.tokens, audioBytes: window.EYES.audioBytes||0 }));

  await page.goto('http://localhost:8000/'); await sleep(1500);
  // ── 1. go live (mic wav: 3 s silence, then "What is this? Please read any text you see.")
  await page.click('#micBtn'); await sleep(2500);
  console.log('after connect:', (await state()).hint);
  // ── 2. snapshot while the question is being spoken
  const snapScene = scene(); await page.click('#lookBtn'); console.log('LOOK sent during scene:', snapScene);
  await sleep(400); await page.screenshot({ path: __dirname + '/out/e2e-look.png' });
  let s; for (let i = 0; i < 30; i++) { await sleep(1000); s = await state(); if (s.audioBytes > 0 && s.agent && !s.agent.startsWith('Hold')) break; }
  await sleep(6000); s = await state();
  console.log('SNAPSHOT RESULT:', JSON.stringify(s, null, 1));
  await page.screenshot({ path: __dirname + '/out/e2e-answer.png' });
  // ── 3. watcher + stream: watch for a raised hand at 1 fps
  await page.fill('#watchTarget', 'a raised hand'); await page.press('#watchTarget', 'Enter');
  await page.click('#watchBtn'); console.log('WATCH on at scene:', scene());
  let seenAt = null, seenShot = false;
  for (let i = 0; i < 45; i++) {
    await sleep(1000); s = await state();
    if (s.badge !== 'watching' && s.badge !== 'off' && !seenAt) { seenAt = scene(); console.log('WATCHER FIRED:', s.badge, '| scene:', seenAt); }
    if (seenAt && !seenShot) { await sleep(300); await page.screenshot({ path: __dirname + '/out/e2e-watch.png' }); seenShot = true; }
  }
  s = await state(); console.log('STREAM RESULT:', JSON.stringify(s, null, 1));
  if (!seenShot) await page.screenshot({ path: __dirname + '/out/e2e-watch.png' });
  await page.click('#micBtn'); await sleep(500);
  console.log('errors:', errs);
  await ctx.close(); await browser.close();
})();
