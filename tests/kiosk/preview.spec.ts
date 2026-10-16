import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

for (const width of [390, 1200]) {
  test(`Preview shopping journey never sends a command or payment at ${width}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 950 });
    const writes: string[] = [];
    await page.route('**/api/**', async (route) => {
      if (route.request().method() !== 'GET') writes.push(route.request().url());
      await route.fulfill({ status: 500, json: { detail: 'Not used in sample preview' } });
    });
    await page.goto('/?preview=1');
    await expect(page.getByRole('heading', { name: /Hôm nay, bạn muốn/ })).toBeVisible();
    await page.getByRole('button', { name: 'Chọn Một chút dịu dàng', exact: true }).click();
    await page.screenshot({ path: `artifacts/kiosk-preview-${width}.png`, fullPage: true });
    expect(
      (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
        .violations,
    ).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.getByRole('button', { name: 'Xem giỏ hoa', exact: true }).click();
    await page.getByLabel('Một lời nhắn nhỏ (tùy chọn)').fill('Một ngày thật dịu dàng nhé!');
    await page.getByRole('button', { name: 'Xem bước thanh toán' }).click();
    await expect(page.getByText('Chưa tạo QR hoặc liên kết payOS')).toBeVisible();
    await page.getByRole('button', { name: 'Xem màn hình nhận hoa', exact: true }).click();
    await page.getByLabel('Mã minh họa', { exact: true }).fill('DEMO2026');
    await page.getByRole('button', { name: 'Xem màn hoàn tất' }).click();
    await expect(page.getByRole('heading', { name: 'Bản xem trước đã hoàn tất' })).toBeVisible();
    expect(writes).toEqual([]);
    await page.getByRole('button', { name: 'Khám phá thêm mẫu hoa' }).click();
    await expect(page.getByText('Giỏ đang chờ một chút sắc màu.')).toBeVisible();
  });
}
test('API mode reads real public catalog and does not silently substitute sample products', async ({
  page,
}) => {
  const writes: string[] = [];
  await page.route('**/api/**', async (route) => {
    expect(route.request().headers()['x-kiosk-key']).toBeUndefined();
    if (route.request().method() !== 'GET') writes.push(route.request().url());
    await route.fulfill({
      json: route.request().url().includes('/shop/catalog') ? { items: [], hasMore: false } : [],
    });
  });
  await page.goto('/?preview=1');
  await page.getByRole('button', { name: 'Danh mục API', exact: true }).click();
  await expect(page.getByText('Chưa có mẫu hoa phù hợp.')).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Chọn Một chút dịu dàng', exact: true }),
  ).toHaveCount(0);
  expect(writes).toEqual([]);
});
test('Explicit preview ignores a previously configured device session', async ({ page }) => {
  await page.addInitScript(() =>
    sessionStorage.setItem(
      'florabot-device',
      JSON.stringify({ id: '40000000-0000-0000-0000-000000000001', key: 'test-device-key' }),
    ),
  );
  const deviceCalls: string[] = [];
  await page.route('**/api/kiosks/**', async (route) => {
    deviceCalls.push(route.request().url());
    await route.abort();
  });
  await page.goto('/?preview=1');
  await expect(page.getByText('Bản xem thử · Chưa có IoT')).toBeVisible();
  expect(deviceCalls).toEqual([]);
});
