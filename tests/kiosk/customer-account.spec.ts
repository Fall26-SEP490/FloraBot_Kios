import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
const id = '40000000-0000-0000-0000-000000000001';
const order = {
  id: 'order-one',
  orderCode: 'FB-PRIVATE-1',
  createdAt: '2026-10-07T06:00:00Z',
  status: 'COMPLETED',
  totalAmount: 100000,
  pointsEarned: 1000,
  pointsRedeemed: 0,
  shopName: 'Tiệm Hoa Nhỏ',
  items: ['Bó cúc trắng'],
};
async function login(page: Page, canForgetAccount = true) {
  await page.addInitScript(
    (value) =>
      sessionStorage.setItem(
        'florabot-device',
        JSON.stringify({ id: value, key: 'test-device-key' }),
      ),
    id,
  );
  await page.route('**/catalog/items', (route) => route.fulfill({ json: [] }));
  await page.route('**/otp/request', (route) => route.fulfill({ json: { expiresInSeconds: 180 } }));
  await page.route('**/otp/verify', (route) =>
    route.fulfill({
      json: { accessToken: 'privacy-token', expiresInSeconds: 600, canForgetAccount },
    }),
  );
  await page.goto('/');
  await page.locator('.customer-login summary').click();
  await page.getByLabel('Số điện thoại', { exact: true }).fill('0901234567');
  await page.getByRole('button', { name: 'Gửi mã xác thực', exact: true }).click();
  await page.getByLabel('Mã xác thực', { exact: true }).fill('123456');
  await page.getByRole('button', { name: 'Xác nhận đăng nhập' }).click();
  await page.getByRole('button', { name: 'Lịch sử mua và thông tin cá nhân' }).click();
}
test('Shop owner cannot start kiosk account erasure before loading history', async ({ page }) => {
  await login(page, false);
  await expect(page.getByText('Tài khoản này đang quản lý shop.', { exact: false })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Tìm hiểu và yêu cầu xóa' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Xem lịch sử mua' })).toBeEnabled();
});

for (const width of [390, 1024])
  test(`Customer history, explicit erasure and accessibility ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    let forgets = 0;
    await page.route('**/customer/history?*', (route) => {
      expect(route.request().headers().authorization).toBe('Bearer privacy-token');
      expect(route.request().headers()['x-kiosk-key']).toBeUndefined();
      const second = new URL(route.request().url()).searchParams.get('page') === '2';
      return route.fulfill({
        json: {
          items: second ? [] : [order],
          page: second ? 2 : 1,
          hasMore: !second,
          loyaltyPoints: 1000,
        },
      });
    });
    await page.route('**/flows/forget_customer', (route) => {
      forgets++;
      expect(route.request().postDataJSON()).toEqual({});
      expect(route.request().headers().authorization).toBe('Bearer privacy-token');
      return route.fulfill({ json: { result: null } });
    });
    await login(page);
    await expect(page.getByRole('heading', { name: 'Những lần bạn ghé FloraBot' })).toBeFocused();
    await page.getByRole('button', { name: 'Xem lịch sử mua' }).click();
    await expect(page.getByText('Đơn FB-PRIVATE-1')).toBeVisible();
    expect(
      await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage })),
    ).not.toContain('FB-PRIVATE-1');
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
          .analyze()
      ).violations,
    ).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({
      path: `.impeccable/review/customer-account-${width}.png`,
      fullPage: true,
    });
    await page.getByRole('button', { name: 'Trang sau' }).click();
    await expect(page.getByText('Chưa có đơn hàng trong trang lịch sử này.')).toBeVisible();
    await page.getByRole('button', { name: 'Trang trước' }).click();
    await expect(page.getByText('Đơn FB-PRIVATE-1')).toBeVisible();
    await page.getByRole('button', { name: 'Trở lại chọn hoa' }).click();
    await expect(
      page.getByRole('button', { name: 'Lịch sử mua và thông tin cá nhân' }),
    ).toBeFocused();
    await page.getByRole('button', { name: 'Lịch sử mua và thông tin cá nhân' }).click();
    await expect(page.getByText('Đơn FB-PRIVATE-1')).toHaveCount(0);
    await page.getByRole('button', { name: 'Tìm hiểu và yêu cầu xóa' }).click();
    await expect(
      page.getByRole('heading', { name: 'Xác nhận xóa thông tin định danh' }),
    ).toBeFocused();
    await page.getByRole('button', { name: 'Giữ tài khoản của tôi' }).click();
    expect(forgets).toBe(0);
    await page.getByRole('button', { name: 'Tìm hiểu và yêu cầu xóa' }).click();
    await page.getByRole('button', { name: 'Xác nhận xóa và kết thúc phiên' }).click();
    await expect(page.getByRole('checkbox')).toBeFocused();
    expect(forgets).toBe(0);
    await page.getByRole('checkbox').check();
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
          .analyze()
      ).violations,
    ).toEqual([]);
    await page.getByRole('button', { name: 'Xác nhận xóa và kết thúc phiên' }).click();
    await expect(
      page.getByRole('status').filter({ hasText: 'Đã xóa thông tin định danh' }),
    ).toBeVisible();
    expect(forgets).toBe(1);
    await expect(page.locator('.customer-login')).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Lịch sử mua và thông tin cá nhân' }),
    ).toHaveCount(0);
  });

test('Lost erasure response ends the session without retry', async ({ page }) => {
  let attempts = 0;
  await page.route('**/flows/forget_customer', (route) => {
    attempts++;
    return route.abort();
  });
  await login(page);
  await page.getByRole('button', { name: 'Tìm hiểu và yêu cầu xóa' }).click();
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Xác nhận xóa và kết thúc phiên' }).click();
  await expect(
    page.getByRole('status').filter({ hasText: 'Chưa xác nhận được kết quả xóa' }),
  ).toBeVisible();
  await expect(
    page.getByRole('status').filter({ hasText: 'Chưa xác nhận được kết quả xóa' }),
  ).toBeFocused();
  await expect(page.locator('.customer-account')).toHaveCount(0);
  expect(attempts).toBe(1);
});

test('Offline blocks account requests and an expired read session returns to guest shopping', async ({
  page,
  context,
}) => {
  let reads = 0;
  await page.route('**/customer/history?*', (route) => {
    reads++;
    return route.fulfill({ status: reads === 1 ? 503 : 401, json: {} });
  });
  await login(page);
  await context.setOffline(true);
  await expect(page.getByRole('button', { name: 'Xem lịch sử mua' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Tìm hiểu và yêu cầu xóa' })).toBeDisabled();
  expect(reads).toBe(0);
  await context.setOffline(false);
  await page.getByRole('button', { name: 'Xem lịch sử mua' }).click();
  await expect(page.getByRole('alert')).toContainText('Chưa tải được lịch sử');
  expect(reads).toBe(1);
  await page.getByRole('button', { name: 'Xem lịch sử mua' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Phiên đã hết hiệu lực' })).toBeVisible();
  await expect(page.locator('.customer-account')).toHaveCount(0);
  expect(reads).toBe(2);
});

test('Late history cannot appear after tab hiding ends the session', async ({ page }) => {
  let release!: () => void;
  let started = false;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/customer/history?*', async (route) => {
    started = true;
    await held;
    await route.fulfill({ json: { items: [order], page: 1, hasMore: false, loyaltyPoints: 1000 } });
  });
  await login(page);
  await page.getByRole('button', { name: 'Xem lịch sử mua' }).click();
  await expect.poll(() => started).toBe(true);
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  const response = page.waitForResponse('**/customer/history?*');
  release();
  await (await response).finished();
  await page.evaluate(() => new Promise(requestAnimationFrame));
  await expect(page.locator('.customer-login')).toBeVisible();
  await expect(page.getByText('Đơn FB-PRIVATE-1')).toHaveCount(0);
});
