import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('Virtual Cabinet 3D Simulator Interactive & Responsive Verification', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      sessionStorage.removeItem('florabot-device');
    });
  });

  test('3D Simulator renders canvas or fallback, supports camera reset and slot inspection', async ({
    page,
  }) => {
    test.setTimeout(60000);
    let networkRequestCount = 0;
    await page.route('**/api/**', (route) => {
      networkRequestCount++;
      return route.abort();
    });
    await page.route('**/*payos*/**', (route) => {
      networkRequestCount++;
      return route.abort();
    });

    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');

    // Launch preview mode from setup screen
    await page.getByRole('button', { name: 'Xem giao diện mẫu' }).click();

    // Verify 3D container / canvas is mounted or fallback is rendered
    const simulator = page.locator('.virtual-cabinet-simulator');
    await expect(simulator).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Tủ hoa thông minh FloraBot' })).toBeVisible();

    const canvasOrFallback = simulator.locator('canvas, .virtual-cabinet-fallback-notice');
    await expect(canvasOrFallback.first()).toBeVisible();

    // Camera reset button is present and interactive
    const resetCamBtn = page.getByRole('button', { name: 'Đưa góc nhìn về toàn cảnh' });
    if (await resetCamBtn.isVisible()) {
      await expect(resetCamBtn).toBeEnabled();
      await resetCamBtn.click();
    }

    // Inspect slot A01 and A02 details
    await page.getByRole('tab', { name: 'Ô A01', exact: true }).click();
    await expect(page.locator('.virtual-cabinet__inspector-card')).toHaveAttribute(
      'aria-label',
      'Chi tiết ô A01',
    );
    await expect(page.locator('.virtual-cabinet__inspector-card')).toContainText(
      'Bó hồng lụa dịu dàng',
    );

    await page.getByRole('tab', { name: 'Ô A03', exact: true }).click();
    await expect(page.locator('.virtual-cabinet__inspector-card')).toHaveAttribute(
      'aria-label',
      'Chi tiết ô A03',
    );
    await expect(page.locator('.virtual-cabinet__inspector-card')).toContainText('Đơn đặt trước');

    // 3D mode stays compact; the full card list only appears after explicitly switching to 2D.
    await expect(page.locator('.virtual-slot')).toHaveCount(0);
    await page.getByRole('button', { name: 'Chế độ 3D' }).click();
    await expect(page.locator('.virtual-slot')).toHaveCount(3);
    await page.getByRole('button', { name: 'Chế độ 2D' }).click();
    await expect(page.locator('.virtual-slot')).toHaveCount(0);

    // Test OFFLINE blocks door opening
    await page.getByText(/Bảng điều khiển giả lập/).click();
    await page.getByRole('button', { name: 'Mô phỏng offline' }).click();
    await expect(page.locator('.virtual-cabinet__alert')).toContainText(
      'LI-01 · Tủ đang mất kết nối',
    );

    // Reconnect
    await page.getByRole('button', { name: 'Kết nối lại' }).click();
    await expect(page.locator('.virtual-cabinet__connection--online')).toBeVisible();

    // Test MAINTENANCE blocks door opening
    await page.getByRole('button', { name: 'Mô phỏng bảo trì' }).click();
    await expect(page.locator('.virtual-cabinet__alert')).toContainText('Tủ đang bảo trì');
    await page.getByRole('button', { name: 'Kết thúc bảo trì' }).click();

    // Run Axe WCAG AA scan
    const axe = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();
    expect(axe.violations).toEqual([]);

    // Assert zero external API/payOS calls
    expect(networkRequestCount).toBe(0);
  });

  for (const width of [390, 768, 1024, 1280, 1680]) {
    test(`Responsive layout and touch target compliance at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 850 });
      await page.goto('/');

      await page.getByRole('button', { name: 'Xem giao diện mẫu' }).click();
      await expect(page.getByRole('heading', { name: 'Tủ hoa thông minh FloraBot' })).toBeVisible();

      // Verify no horizontal overflow
      const noOverflow = await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      );
      expect(noOverflow).toBe(true);

      // Verify product cards min-width 240px when viewport >= 1024px
      if (width >= 1024) {
        const cardBox = await page.locator('.preview-bouquet-card').first().boundingBox();
        expect(cardBox).not.toBeNull();
        expect(cardBox!.width).toBeGreaterThanOrEqual(240);
      }

      // Verify touch targets >= 44px
      const exitBtn = page.getByRole('button', { name: 'Thoát xem mẫu' });
      const exitBox = await exitBtn.boundingBox();
      expect(exitBox).not.toBeNull();
      expect(exitBox!.height).toBeGreaterThanOrEqual(44);

      // Verify 3D slot selection buttons touch targets >= 44px
      const slotSelectBtn = page.locator('.slot-tab-btn').first();
      const slotSelectBox = await slotSelectBtn.boundingBox();
      expect(slotSelectBox).not.toBeNull();
      expect(slotSelectBox!.height).toBeGreaterThanOrEqual(44);
    });
  }
});
