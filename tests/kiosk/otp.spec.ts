import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
const id = '40000000-0000-0000-0000-000000000001';
test.beforeEach(async ({ page }) => {
  await page.addInitScript(
    (value) =>
      sessionStorage.setItem(
        'florabot-device',
        JSON.stringify({ id: value, key: 'test-device-key' }),
      ),
    id,
  );
  await page.route('**/catalog/items', (route) =>
    route.fulfill({
      json: [
        {
          bouquetId: 'bouquet-id',
          name: 'Hoa hồng',
          price: 350000,
          slotCode: 'A01',
          shopName: 'Shop',
        },
      ],
    }),
  );
  await page.route('**/otp/request', (route) => {
    expect(route.request().headers()['x-kiosk-key']).toBe('test-device-key');
    expect(route.request().postDataJSON()).toEqual({ phone: '0901234567' });
    return route.fulfill({ json: { expiresInSeconds: 180 } });
  });
});

test('OTP validation, error, bearer checkout, then session end clears token', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 });
  let attempts = 0;
  await page.route('**/otp/verify', (route) => {
    attempts++;
    expect(route.request().headers()['x-kiosk-key']).toBe('test-device-key');
    expect(route.request().postDataJSON()).toEqual({ phone: '0901234567', code: '123456' });
    return attempts === 1
      ? route.fulfill({ status: 401 })
      : route.fulfill({ json: { accessToken: 'customer-token', expiresInSeconds: 600 } });
  });
  await page.route('**/flows/kiosk_checkout', (route) => {
    expect(route.request().headers().authorization).toBe('Bearer customer-token');
    expect(route.request().headers()['x-kiosk-key']).toBeUndefined();
    expect(route.request().postDataJSON()).toEqual({ p_bouquets: ['bouquet-id'], p_points: 0 });
    return route.fulfill({ json: { result: 'checkout-id' } });
  });
  await page.route('**/checkouts/checkout-id', (route) => route.fulfill({ status: 401 }));
  await page.route('**/flows/ai_suggest', (route) => {
    expect(route.request().headers().authorization).toBe('Bearer customer-token');
    expect(route.request().headers()['x-kiosk-key']).toBeUndefined();
    return route.fulfill({ json: { result: '60000000-0000-4000-8000-000000000001' } });
  });
  await page.route('**/surveys/*', (route) => {
    expect(route.request().headers().authorization).toBe('Bearer customer-token');
    return route.fulfill({
      json: { id: '60000000-0000-4000-8000-000000000001', source: 'FALLBACK', suggestions: [] },
    });
  });
  await page.goto('/');
  await page.locator('.customer-login summary').click();
  await page.getByLabel('Số điện thoại', { exact: true }).fill('123');
  await page.getByRole('button', { name: 'Gửi mã xác thực', exact: true }).click();
  await expect(page.getByText('Nhập số điện thoại Việt Nam hợp lệ.')).toBeVisible();
  await page.getByLabel('Số điện thoại', { exact: true }).fill('0901234567');
  await page.getByRole('button', { name: 'Gửi mã xác thực', exact: true }).click();
  await expect(page.getByLabel('Mã xác thực', { exact: true })).toBeFocused();
  await page.getByLabel('Mã xác thực', { exact: true }).fill('12');
  await page.getByRole('button', { name: 'Xác nhận đăng nhập' }).click();
  await expect(page.getByText('Nhập đủ 6 chữ số trong tin nhắn.')).toBeVisible();
  await page.getByLabel('Mã xác thực', { exact: true }).fill('123456');
  await page.getByRole('button', { name: 'Xác nhận đăng nhập' }).click();
  await expect(page.getByRole('alert')).toContainText('Mã chưa đúng hoặc đã hết hạn');
  await expect(page.getByRole('button', { name: /Gửi lại sau/ })).toBeDisabled();
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
        .analyze()
    ).violations,
  ).toEqual([]);
  await page.screenshot({ path: '.impeccable/review/kiosk-otp-390.png', fullPage: true });
  await page.getByRole('button', { name: 'Xác nhận đăng nhập' }).click();
  await expect(page.getByText('Đã xác thực số điện thoại.', { exact: false })).toBeVisible();
  expect(
    await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage })),
  ).not.toContain('customer-token');
  await page.getByText('Cần một chút gợi ý để chọn hoa?', { exact: true }).click();
  await page.getByRole('button', { name: 'Tìm hoa phù hợp', exact: true }).click();
  await expect(page.getByText('Chưa có bó hoa phù hợp lúc này.', { exact: false })).toBeVisible();
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Giữ hoa và thanh toán' }).click();
  await expect(page.getByText('Đã xác thực số điện thoại.', { exact: false })).toHaveCount(0);
  await expect(page.getByRole('checkbox')).not.toBeChecked();
});

test('Customer absolute expiry clears memory without refresh or persistent personal data', async ({
  page,
}) => {
  await page.route('**/otp/verify', (route) =>
    route.fulfill({ json: { accessToken: 'short-lived-customer-token', expiresInSeconds: 2 } }),
  );
  await page.goto('/');
  await page.locator('.customer-login summary').click();
  await page.getByLabel('Số điện thoại', { exact: true }).fill('0901234567');
  await page.getByRole('button', { name: 'Gửi mã xác thực', exact: true }).click();
  await page.getByLabel('Mã xác thực', { exact: true }).fill('123456');
  await page.getByRole('button', { name: 'Xác nhận đăng nhập' }).click();
  await expect(page.getByText('Đã xác thực số điện thoại.', { exact: false })).toBeVisible();
  await expect(page.getByText('Đã xác thực số điện thoại.', { exact: false })).toHaveCount(0, {
    timeout: 5000,
  });
  await page.locator('.customer-login summary').click();
  await expect(page.getByLabel('Số điện thoại', { exact: true })).toHaveValue('');
  const stored = await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage }));
  expect(stored).not.toContain('0901234567');
  expect(stored).not.toContain('short-lived-customer-token');
});
