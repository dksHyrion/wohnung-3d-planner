import { test, expect } from '@playwright/test';

test.describe('Wohnung 3D Planner E2E', () => {
  test('1. App boot & WebGL 3D smoke check without runtime errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));

    await page.goto('/');

    const svg2d = page.locator('svg[role="img"]');
    await expect(svg2d).toBeVisible();
    const svgBox = await svg2d.boundingBox();
    expect(svgBox).not.toBeNull();
    expect(svgBox!.width).toBeGreaterThan(200);
    expect(svgBox!.height).toBeGreaterThan(200);

    // 3D canvas renders in default split view
    const canvas3d = page.locator('canvas').first();
    await expect(canvas3d).toBeVisible();
    const canvasBox = await canvas3d.boundingBox();
    expect(canvasBox).not.toBeNull();
    expect(canvasBox!.width).toBeGreaterThan(100);
    expect(canvasBox!.height).toBeGreaterThan(100);

    expect(errors).toEqual([]);
  });

  test('2. 2D furniture drag matches clientToWorldCm scale and supports Undo/Redo', async ({ page }) => {
    await page.goto('/');
    // Switch to 2D-only mode to keep drag responsive without software WebGL overhead
    await page.locator('button:has-text("2D Grundriss"), button:has-text("2D Floorplan")').first().click();

    const svg2d = page.locator('svg[role="img"]');
    const furniture = svg2d.locator('g[data-furniture-id]').first();
    await expect(furniture).toBeVisible();

    const parseTranslate = (transform: string | null) => {
      const m = transform?.match(/translate\(([\d.-]+),\s*([\d.-]+)\)/);
      if (!m) throw new Error(`Invalid transform: ${transform}`);
      return { x: parseFloat(m[1]), z: parseFloat(m[2]) };
    };

    const initialPos = parseTranslate(await furniture.getAttribute('transform'));

    // Read SVG viewBox & bounding rect to predict exact cm delta for a drag
    const scaleInfo = await svg2d.evaluate((el) => {
      const vb = el.getAttribute('viewBox')!.split(/\s+/).map(Number);
      const rect = el.getBoundingClientRect();
      return {
        cmPerPx: Math.max(vb[2] / rect.width, vb[3] / rect.height),
      };
    });

    const furnBox = await furniture.boundingBox();
    expect(furnBox).not.toBeNull();
    const startX = furnBox!.x + furnBox!.width / 2;
    const startY = furnBox!.y + furnBox!.height / 2;
    const dragPxX = 50;
    const dragPxY = 30;

    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX + dragPxX, startY + dragPxY, { steps: 4 });
    await page.mouse.up();

    const movedPos = parseTranslate(await furniture.getAttribute('transform'));
    const expectedDx = dragPxX * scaleInfo.cmPerPx;
    const expectedDz = dragPxY * scaleInfo.cmPerPx;

    expect(Math.hypot(movedPos.x - initialPos.x, movedPos.z - initialPos.z)).toBeGreaterThan(15);
    expect(Math.abs(movedPos.x - initialPos.x - expectedDx)).toBeLessThan(40);
    expect(Math.abs(movedPos.z - initialPos.z - expectedDz)).toBeLessThan(40);

    // Undo restores original coordinates, Redo restores moved coordinates
    await page.locator('button[title*="Strg+Z"], button[title*="Ctrl+Z"]').click();
    const undonePos = parseTranslate(await furniture.getAttribute('transform'));
    expect(undonePos.x).toBeCloseTo(initialPos.x, 1);
    expect(undonePos.z).toBeCloseTo(initialPos.z, 1);

    await page.locator('button[title*="Strg+Y"], button[title*="Ctrl+Y"]').click();
    const redonePos = parseTranslate(await furniture.getAttribute('transform'));
    expect(redonePos.x).toBeCloseTo(movedPos.x, 1);
    expect(redonePos.z).toBeCloseTo(movedPos.z, 1);
  });

  test('3. Plan Export dialog downloads valid scaled SVG', async ({ page }) => {
    await page.goto('/');
    await page.locator('button:has-text("2D Grundriss"), button:has-text("2D Floorplan")').first().click();

    await page.locator('button:has-text("Plan (SVG)")').click();
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();

    const downloadPromise = page.waitForEvent('download');
    await dialog.locator('button:has-text("SVG")').click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/\.svg$/i);

    const stream = await download.createReadStream();
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.from(chunk));
    }
    const svgContent = Buffer.concat(chunks).toString('utf8');
    expect(svgContent).toContain('<svg');
    expect(svgContent).toContain('class="arch-wall"');
    expect(svgContent).not.toContain('stroke="#ffffff"');
  });

  test('4. RoofSlope creation in inspector renders 2D WoFlV contours', async ({ page }) => {
    await page.goto('/');
    await page.locator('button:has-text("2D Grundriss"), button:has-text("2D Floorplan")').first().click();

    const firstWallBadge = page.locator('svg[role="img"] g[data-wall-id] > g').first();
    await expect(firstWallBadge).toBeVisible();
    await firstWallBadge.click();

    const addRoofBtn = page
      .locator('button:has-text("Dachschräge"), button:has-text("Roof Slope")')
      .first();
    await expect(addRoofBtn).toBeVisible();
    await addRoofBtn.click();
    await expect(page.locator('[data-testid="roof-slope-contours-2d"]')).toBeVisible();
  });
});
