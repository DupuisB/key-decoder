import fs from 'node:fs/promises';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import { auditBinaryStl } from '../src/geometry/stlExport';

const SCREENSHOT_DIR = path.resolve(process.cwd(), 'e2e/screenshots');

test.describe('Key Decoder End-to-End Verification', () => {
  test.beforeAll(async () => {
    await fs.mkdir(SCREENSHOT_DIR, { recursive: true });
  });

  test('full visual decoding workflow, 3D preview tab, valid binary STL download, and layout screenshots', async ({
    page,
  }) => {
    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => {
      pageErrors.push(err.message);
    });

    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');

    // 1. Privacy note & default WR5 preset
    await expect(page.getByTestId('privacy-badge')).toBeVisible();
    await expect(page.getByTestId('bitting-code-display')).toHaveText('1-5-2-7-6');

    // 2. Load built-in sample key photo
    await page.getByTestId('load-sample-btn').click();
    const canvas = page.getByTestId('decoder-canvas');
    await expect(canvas).toBeVisible();

    // 3. Step cut 1 (1 -> 2) and verify bitting + URL hash sync
    await page.getByTestId('pin-1-inc').click();
    await expect(page.getByTestId('bitting-code-display')).toHaveText('2-5-2-7-6');
    await expect(page).toHaveURL(/#keyway=WR5&cuts=2-5-2-7-6/);

    // Capture clean default desktop screenshot (light mode, uncluttered)
    await page.waitForTimeout(200);
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, 'simple-desktop-light.png'),
      fullPage: true,
    });

    // 4. Open Adjust tools briefly to exercise nudge & skew controls
    await page.getByTestId('toggle-adjust-tools-btn').click();
    await page.getByTestId('nudge-rot-plus').click();
    await page.getByTestId('nudge-rot-minus').click();
    await page.getByTestId('nudge-scale-plus').click();
    await page.getByTestId('nudge-scale-minus').click();
    await page.getByTestId('toggle-skew-handle-btn').check();
    await page.getByTestId('toggle-skew-handle-btn').uncheck();
    await page.getByTestId('toggle-adjust-tools-btn').click();

    // 5. Switch to 3D Preview tab and verify WebGL canvas
    await page.getByTestId('tab-3d').click();
    const previewWrap = page.getByTestId('preview-3d-canvas-wrap');
    await expect(previewWrap).toBeVisible();
    const glCanvas = previewWrap.locator('canvas');
    await expect(glCanvas).toBeVisible();
    const glBox = await glCanvas.boundingBox();
    expect(glBox?.width ?? 0).toBeGreaterThan(250);
    expect(glBox?.height ?? 0).toBeGreaterThan(250);

    // Toggle dark mode & capture 3D preview screenshot
    await page.getByTestId('theme-toggle').click();
    await page.waitForTimeout(300);
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, 'simple-desktop-3d-dark.png'),
      fullPage: true,
    });

    // 6. Open Print options, enable reinforced bow, download STL & audit watertightness
    await page.getByTestId('print-options-toggle').click();
    await expect(page.getByTestId('print-options-box')).toBeVisible();
    await page.getByTestId('reinforced-bow-toggle').check();

    const downloadPromise = page.waitForEvent('download');
    await page.getByTestId('download-stl-btn').click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe('WR5-25276.stl');

    const downloadedPath = await download.path();
    expect(downloadedPath).toBeTruthy();
    const rawBytes = await fs.readFile(downloadedPath!);
    const arrayBuffer = rawBytes.buffer.slice(rawBytes.byteOffset, rawBytes.byteOffset + rawBytes.byteLength);

    const audit = auditBinaryStl(arrayBuffer);
    expect(audit.headerText).toContain('KeyDecoder WR5 2-5-2-7-6');
    expect(audit.byteLength).toBe(audit.expectedByteLength);
    expect(audit.triangleCount).toBeGreaterThan(200);
    expect(audit.isWatertight).toBe(true);
    expect(audit.openEdgeCount).toBe(0);
    expect(audit.nonManifoldEdgeCount).toBe(0);
    expect(audit.eulerCharacteristic).toBe(0);
    expect(audit.signedVolumeMm3).toBeGreaterThan(500);

    // 7. Switch keyway via plain select to Schlage SC1 & test Custom Keyway mode
    await page.getByTestId('keyway-select').selectOption('SC1');
    await expect(page.getByTestId('bitting-code-display')).toHaveText('4-1-7-2-5');

    await page.getByTestId('custom-keyway-toggle').click();
    await expect(page.getByTestId('custom-keyway-panel')).toBeVisible();
    await page.getByTestId('apply-custom-keyway').click();
    await page.getByTestId('custom-keyway-toggle').click();

    // 8. Test Mobile 1:1 On-Screen Card Calibration -> Lock Scale -> Trace Key & Step Cuts
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');

    // Mobile auto-opens On-Screen (1:1) tab!
    await expect(page.getByTestId('screen-calibration-view')).toBeVisible();
    await expect(page.getByTestId('card-calibration-bar')).toBeVisible();
    await page.getByTestId('scale-inc-btn').click();
    await page.waitForTimeout(200);
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, 'mobile-screen-calibrate.png'),
      fullPage: true,
    });

    // Lock scale -> 1:1 physical backlit key trace surface + thumb cut controls all on screen
    await page.getByTestId('lock-scale-btn').click();
    await expect(page.getByTestId('screen-trace-locked-view')).toBeVisible();
    await expect(page.getByTestId('trace-1to1-svg')).toBeVisible();
    await page.getByTestId('pin-2-inc').click();
    await page.waitForTimeout(200);
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, 'mobile-screen-locked.png'),
      fullPage: true,
    });

    // Verify recalibrate & flip/contrast toggles work cleanly
    await page.getByTestId('trace-contrast-btn').click();
    await page.getByTestId('trace-flip-btn').click();
    await page.getByTestId('recalibrate-scale-btn').click();
    await expect(page.getByTestId('screen-calibration-view')).toBeVisible();

    expect(pageErrors, `Uncaught page errors: ${pageErrors.join('; ')}`).toEqual([]);
    expect(consoleErrors, `Console errors: ${consoleErrors.join('; ')}`).toEqual([]);
  });
});
