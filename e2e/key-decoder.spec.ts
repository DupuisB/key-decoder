import fs from 'node:fs/promises';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import { auditBinaryStl } from '../src/geometry/stlExport';

const SCREENSHOT_DIR = path.resolve(process.cwd(), 'e2e/screenshots');

test.describe('Key Decoder End-to-End Verification', () => {
  test.beforeAll(async () => {
    await fs.mkdir(SCREENSHOT_DIR, { recursive: true });
  });

  test('full visual decoding workflow, 3D preview, valid binary STL download, and layout screenshots', async ({
    page,
  }) => {
    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });
    page.on('pageerror', (err) => {
      pageErrors.push(err.message);
    });

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');

    // 1. Privacy badge & default WR5 preset
    await expect(page.getByTestId('privacy-badge')).toBeVisible();
    await expect(page.getByTestId('bitting-code-display')).toHaveText('1-5-2-7-6');

    // 2. Load built-in sample key photo
    await page.getByTestId('load-sample-btn').click();
    const canvas = page.getByTestId('decoder-canvas');
    await expect(canvas).toBeVisible();

    // 3. Test anchor alignment nudge buttons & skew handle
    await page.getByTestId('nudge-rot-plus').click();
    await page.getByTestId('nudge-rot-minus').click();
    await page.getByTestId('nudge-scale-plus').click();
    await page.getByTestId('nudge-scale-minus').click();
    await page.getByTestId('toggle-skew-handle-btn').click();

    // Drag canvas slightly to exercise pointer pan / anchor interaction
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();
    if (box) {
      await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.5);
      await page.mouse.down();
      await page.mouse.move(box.x + box.width * 0.52, box.y + box.height * 0.51, { steps: 4 });
      await page.mouse.up();
    }

    // 4. Step cuts and verify live bitting code + URL hash sync
    await page.getByTestId('pin-1-inc').click(); // 1 -> 2
    await expect(page.getByTestId('bitting-code-display')).toHaveText('2-5-2-7-6');
    await expect(page).toHaveURL(/#keyway=WR5&cuts=2-5-2-7-6/);

    // 5. Verify 3D WebGL preview canvas rendered
    const previewWrap = page.getByTestId('preview-3d-canvas-wrap');
    await expect(previewWrap).toBeVisible();
    const glCanvas = previewWrap.locator('canvas');
    await expect(glCanvas).toBeVisible();
    const glBox = await glCanvas.boundingBox();
    expect(glBox?.width ?? 0).toBeGreaterThan(200);
    expect(glBox?.height ?? 0).toBeGreaterThan(150);

    // Toggle 3D wireframe edges briefly and capture desktop dark screenshot
    await page.getByTestId('printing-advisory-toggle').click();
    await expect(page.getByTestId('printing-advisory-box')).toBeVisible();
    await page.getByTestId('reinforced-bow-toggle').check();

    // Wait a moment for WebGL frame settle
    await page.waitForTimeout(350);
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, 'desktop-dark.png'),
      fullPage: true,
    });

    // 6. Trigger .stl download and validate binary STL integrity & watertightness!
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

    // 7. Search & switch keyway to Schlage SC1 + switch to Light theme for visual screenshot
    await page.getByTestId('keyway-selector-trigger').click();
    await page.getByTestId('keyway-search-input').fill('SC1');
    await page.getByTestId('keyway-option-SC1').click();
    await expect(page.getByTestId('bitting-code-display')).toHaveText('4-1-7-2-5');
    await page.getByTestId('load-sample-btn').click();

    await page.getByTestId('theme-toggle').click();
    await page.waitForTimeout(300);
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, 'desktop-light-sc1.png'),
      fullPage: true,
    });

    // 8. Test Custom Keyway Mode
    await page.getByTestId('custom-keyway-toggle').click();
    await expect(page.getByTestId('custom-keyway-panel')).toBeVisible();
    await page.getByTestId('apply-custom-keyway').click();

    // 9. Capture mobile responsive layout screenshot (390x844)
    await page.getByTestId('custom-keyway-toggle').click();
    await page.getByTestId('theme-toggle').click(); // back to dark
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(300);
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, 'mobile-dark.png'),
      fullPage: true,
    });

    // Assert zero runtime errors
    expect(pageErrors, `Uncaught page errors: ${pageErrors.join('; ')}`).toEqual([]);
    expect(consoleErrors, `Console errors: ${consoleErrors.join('; ')}`).toEqual([]);
  });
});
