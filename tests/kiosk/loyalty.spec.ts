import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
const kiosk = '40000000-0000-0000-0000-000000000001';
async function login(page: Page) {
  await page.addInitScript(
    (id) =>
      sessionStorage.setItem('florabot-device', JSON.stringify({ id, key: 'fixture-device-key' })),
    kiosk,
  );
  await page.route('**/catalog/items', (route) =>
    route.fulfill({
      json: [
        {
          bouquetId: 'b1',
          name: 'Bó hoa cúc',
          price: 200000,
          slotCode: 'A01',
          shopName: 'Shop thử nghiệm',
        },
      ],
    }),
  );
  await page.route('**/otp/request', (route) => route.fulfill({ json: { expiresInSeconds: 180 } }));
  await page.route('**/otp/verify', (route) =>
    route.fulfill({ json: { accessToken: 'loyalty-token', expiresInSeconds: 600 } }),
  );
  await page.goto('/');
  await page.locator('.customer-login summary').click();
  await page.getByLabel('Số điện thoại', { exact: true }).fill('0901234567');
  await page.getByRole('button', { name: 'Gửi mã xác thực', exact: true }).click();
  await page.getByLabel('Mã xác thực', { exact: true }).fill('123456');
  await page.getByRole('button', { name: 'Xác nhận đăng nhập' }).click();
  await page.getByRole('checkbox').check();
}
for (const width of [390, 1024])
  test(`Point redemption, authoritative discount and accessibility ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.route('**/customer/points', (route) => {
      expect(route.request().headers().authorization).toBe('Bearer loyalty-token');
      return route.fulfill({ json: { loyaltyPoints: 80000, maxRedeemPercent: 30 } });
    });
    let attempts = 0;
    await page.route('**/flows/kiosk_checkout', (route) => {
      attempts++;
      expect(route.request().postDataJSON()).toEqual({
        p_bouquets: ['b1'],
        p_points: attempts === 1 ? 70000 : 50000,
      });
      return attempts === 1
        ? route.fulfill({ status: 409, json: { detail: 'Đổi điểm tối đa 60.000 đồng.' } })
        : route.fulfill({ json: { result: 'checkout-one' } });
    });
    await page.route('**/checkouts/checkout-one', (route) =>
      route.fulfill({
        json: {
          id: 'checkout-one',
          paymentStatus: 'PENDING',
          amount: 150000,
          payBefore: new Date(Date.now() + 420000).toISOString(),
          orders: [
            {
              id: 'order-one',
              orderCode: 'FB-LOYALTY',
              status: 'AWAITING_PAYMENT',
              amount: 150000,
              trackingToken: 'ABCD1234',
              pointsRedeemed: 50000,
              discountAmount: 50000,
            },
          ],
        },
      }),
    );
    await login(page);
    await page.getByRole('button', { name: 'Xem điểm có thể dùng' }).click();
    await expect(page.getByText('Bạn có 80.000 điểm. Mỗi điểm giảm 1 đồng.')).toBeVisible();
    await expect(page.locator('#points-help')).toContainText('30%');
    const input = page.getByLabel('Số điểm muốn dùng');
    const buy = page.getByRole('button', { name: 'Giữ hoa và thanh toán' });
    for (const invalid of ['-1', '1.5', '80001', '9007199254740993', '']) {
      await input.fill(invalid);
      await expect(input).toHaveAttribute('aria-invalid', 'true');
      await expect(buy).toBeDisabled();
    }
    await input.fill('70000');
    await buy.click();
    await expect(page.getByRole('alert')).toContainText('Đổi điểm tối đa 60.000 đồng.');
    await expect(buy).toBeEnabled();
    await input.fill('50000');
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
    await page.locator('.basket').screenshot({ path: `.impeccable/review/loyalty-${width}.png` });
    expect(
      await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage })),
    ).not.toContain('loyalty-token');
    await buy.click();
    await expect(page.locator('.total')).toContainText('150.000');
    await expect(page.locator('.receipts')).toContainText('Đã dùng 50.000 điểm');
    await expect(page.locator('.receipts')).toContainText('Giảm 50.000');
    await page.getByRole('button', { name: 'Kết thúc lượt mua' }).click();
    await expect(page.getByLabel('Số điểm muốn dùng')).toHaveCount(0);
    expect(attempts).toBe(2);
  });

test('Points failure, expired session and lost checkout response', async ({ page }) => {
  let reads = 0;
  let checkouts = 0;
  await page.route('**/customer/points', (route) => {
    reads++;
    return route.fulfill({
      status: reads === 1 ? 503 : 200,
      json:
        reads === 1
          ? { detail: 'Chưa lấy được điểm.' }
          : { loyaltyPoints: 10000, maxRedeemPercent: 50 },
    });
  });
  await page.route('**/flows/kiosk_checkout', (route) => {
    checkouts++;
    return route.abort();
  });
  await login(page);
  await page.getByRole('button', { name: 'Xem điểm có thể dùng' }).click();
  await expect(page.getByRole('alert')).toContainText('Chưa lấy được điểm.');
  await expect(page.getByRole('button', { name: 'Giữ hoa và thanh toán' })).toBeEnabled();
  await page.getByRole('button', { name: 'Xem điểm có thể dùng' }).click();
  await page.getByLabel('Số điểm muốn dùng').fill('10000');
  await page.getByRole('button', { name: 'Giữ hoa và thanh toán' }).click();
  await expect(page.getByRole('alert')).toContainText('Để tránh tạo giỏ trùng');
  await expect(page.getByRole('button', { name: 'Giữ hoa và thanh toán' })).toBeDisabled();
  expect(checkouts).toBe(1);
  await page.getByRole('button', { name: 'Kết thúc lượt mua' }).click();
  await page.route('**/customer/points', (route) => route.fulfill({ status: 401, json: {} }));
  await login(page);
  await page.getByRole('button', { name: 'Xem điểm có thể dùng' }).click();
  await expect(page.locator('.customer-login')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Xem điểm có thể dùng' })).toHaveCount(0);
});

test('Hiding the kiosk invalidates a late points response', async ({ page }) => {
  let release: (() => void) | undefined;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/customer/points', async (route) => {
    await gate;
    await route.fulfill({ json: { loyaltyPoints: 12345, maxRedeemPercent: 50 } });
  });
  await login(page);
  await page.getByRole('button', { name: 'Xem điểm có thể dùng' }).click();
  await expect(page.getByRole('button', { name: 'Đang xem điểm…' })).toBeVisible();
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  release?.();
  await expect(page.locator('.customer-login')).toBeVisible();
  await expect(page.locator('.point-redemption')).toHaveCount(0);
  await expect(page.getByText('Bạn có 12.345 điểm. Mỗi điểm giảm 1 đồng.')).toHaveCount(0);
});
