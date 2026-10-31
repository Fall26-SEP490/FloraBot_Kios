import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const kiosk = '40000000-0000-0000-0000-000000000001';
const result = {
  orderId: '30000000-0000-0000-0000-000000000099',
  orderCode: 'FB-READY-01',
  productName: 'Bó hồng dành cho bạn',
  slotCode: 'A01',
  orderStatus: 'DISPENSING',
  commandId: '50000000-0000-0000-0000-000000000099',
  watchToken: 'private-watch-token',
  watchExpiresAt: new Date(Date.now() + 600000).toISOString(),
};
test.beforeEach(async ({ page }) => {
  await page.addInitScript(
    (id) =>
      sessionStorage.setItem('florabot-device', JSON.stringify({ id, key: 'home-device-key' })),
    kiosk,
  );
  await page.route(`**/api/kiosk-support/${kiosk}`, (route) =>
    route.fulfill({
      json: { id: kiosk, name: 'Tủ hoa Q1', status: 'ONLINE', address: 'Địa điểm kiểm thử' },
    }),
  );
  await page.route('**/catalog/items', (route) => route.fulfill({ json: [] }));
});
async function enterPickup(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: /Nhận đơn đặt trước/ }).click();
  await page.getByLabel('OTP nhận hoa', { exact: true }).fill('12345678');
  await page.getByRole('button', { name: 'Tiếp tục', exact: true }).click();
}
test('Email code opens only after confirmation, follows real status and clears on Home', async ({
  page,
}) => {
  let opens = 0;
  await page.route('**/preorders/pickup-otp/open', (route) => {
    opens++;
    expect(route.request().headers()['x-kiosk-key']).toBe('home-device-key');
    expect(route.request().postDataJSON().code).toBe('12345678');
    return route.fulfill({
      json: { ...result, attemptId: route.request().postDataJSON().attemptId },
    });
  });
  await page.route('**/preorders/pickup-otp/attempts/*', (route) => {
    expect(route.request().headers()['x-pickup-token']).toBe('private-watch-token');
    return route.fulfill({
      json: { ...result, orderStatus: 'COMPLETED', commandStatus: 'CLOSED' },
    });
  });
  await enterPickup(page);
  expect(opens).toBe(0);
  await page.getByRole('button', { name: 'Xác nhận mở ô nhận hoa' }).click();
  await expect(page.getByRole('heading', { name: 'Đã nhận hoa. Cảm ơn bạn!' })).toBeVisible();
  expect(opens).toBe(1);
  const storage = await page.evaluate(() => JSON.stringify({ ...sessionStorage, ...localStorage }));
  expect(storage).not.toContain('private-watch-token');
  expect(storage).not.toContain('12345678');
  await page.getByRole('button', { name: 'Trang chủ', exact: true }).click();
  await page.getByRole('button', { name: /Nhận đơn đặt trước/ }).click();
  await expect(page.getByLabel('OTP nhận hoa', { exact: true })).toHaveValue('');
});
test('Network ambiguity never auto-resends; explicit retry uses the same attempt', async ({
  page,
}) => {
  const attempts: string[] = [];
  await page.route('**/preorders/pickup-otp/open', (route) => {
    attempts.push(route.request().postDataJSON().attemptId);
    return route.abort();
  });
  await enterPickup(page);
  await page.getByRole('button', { name: 'Xác nhận mở ô nhận hoa' }).click();
  await expect(page.getByRole('heading', { name: 'Kiểm tra ô nhận hoa' })).toBeVisible();
  expect(attempts).toHaveLength(1);
  await page.getByRole('button', { name: 'Kiểm tra lại cùng lượt nhận' }).click();
  await expect.poll(() => attempts.length).toBe(2);
  expect(attempts[0]).toBe(attempts[1]);
});
test('Invalid code and offline kiosk never claim collection or fall back to receipt', async ({
  page,
  context,
}) => {
  await page.route('**/preorders/pickup-otp/open', (route) =>
    route.fulfill({ status: 401, json: { detail: 'Mã không đúng hoặc đã hết hạn.' } }),
  );
  await enterPickup(page);
  await page.getByRole('button', { name: 'Xác nhận mở ô nhận hoa' }).click();
  await expect(page.getByRole('alert')).toContainText('Mã không đúng');
  await expect(page.getByRole('button', { name: 'Nhận bằng biên nhận' })).toHaveCount(0);
  await context.setOffline(true);
  await expect(page.getByRole('button', { name: 'Tiếp tục', exact: true })).toBeDisabled();
  await context.setOffline(false);
});
for (const width of [390, 1024])
  test(`Email pickup is readable and accessible at ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto('/');
    await page.getByRole('button', { name: /Nhận đơn đặt trước/ }).click();
    await expect(page.getByLabel('OTP nhận hoa', { exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    expect(
      (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
        .violations,
    ).toEqual([]);
    await page.screenshot({ path: `artifacts/preorder-email-${width}.png`, fullPage: true });
  });
