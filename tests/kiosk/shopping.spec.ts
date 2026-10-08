import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
const id = '40000000-0000-0000-0000-000000000001';
const bouquet = '50000000-0000-0000-0000-000000000001';
const orderId = '30000000-0000-0000-0000-000000000099';
test.beforeEach(async ({ page }) => {
  await page.addInitScript(
    (value) =>
      sessionStorage.setItem(
        'florabot-device',
        JSON.stringify({ id: value, key: 'test-device-key' }),
      ),
    id,
  );
  await page.route('**/catalog/items', (route) => {
    expect(route.request().headers()['x-kiosk-key']).toBe('test-device-key');
    return route.fulfill({
      json: [
        {
          bouquetId: bouquet,
          name: 'Bó hồng dịu dàng',
          price: 350000,
          slotCode: 'A01',
          shopName: 'Tiệm Hoa Nhỏ',
        },
      ],
    });
  });
});

for (const width of [390, 1024])
  test(`Guest purchase and receipt at ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    let orderStatus = 'AWAITING_PAYMENT';
    await page.route('**/flows/kiosk_checkout', (route) => {
      expect(route.request().postDataJSON()).toEqual({ p_bouquets: [bouquet] });
      return route.fulfill({ json: { result: 'checkout-id' } });
    });
    await page.route('**/checkouts/checkout-id', (route) =>
      route.fulfill({
        json: {
          id: 'checkout-id',
          amount: 350000,
          paymentStatus: orderStatus === 'AWAITING_PAYMENT' ? 'PENDING' : 'SUCCEEDED',
          payBefore: new Date(Date.now() + 420000).toISOString(),
          orders: [
            {
              id: orderId,
              orderCode: 'FB261007-ABC123',
              amount: 350000,
              status: orderStatus,
              trackingToken: 'ABCD2345',
            },
          ],
        },
      }),
    );
    await page.route('**/payment-link', (route) =>
      route.fulfill({
        json: {
          orderCode: 123,
          amount: 350000,
          checkoutUrl: 'https://pay.payos.vn/web/124c33293c934a85be5b7f8761a27a07',
        },
      }),
    );
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Một bó hoa, một ngày vui.' })).toBeVisible();
    await page.screenshot({
      path: `.impeccable/review/kiosk-catalog-${width}.png`,
      fullPage: true,
    });
    await page.getByRole('checkbox').check();
    await page.getByRole('button', { name: 'Giữ hoa và thanh toán' }).click();
    await page.getByRole('button', { name: 'Tạo mã thanh toán' }).click();
    await expect(
      page.getByRole('link', { name: 'Mở liên kết thanh toán (tab mới)' }),
    ).toHaveAttribute('href', 'https://pay.payos.vn/web/124c33293c934a85be5b7f8761a27a07');
    await expect(page.getByText('ABCD2345')).toBeVisible();
    const receiptLink = new URL(
      (await page.getByRole('link', { name: 'Xem biên nhận (tab mới)' }).getAttribute('href'))!,
    );
    expect(receiptLink.pathname).toBe('/receipt');
    expect(receiptLink.search).toBe('');
    expect(new URLSearchParams(receiptLink.hash.slice(1)).get('order')).toBe(orderId);
    expect(new URLSearchParams(receiptLink.hash.slice(1)).get('token')).toBe('ABCD2345');
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
      path: `.impeccable/review/kiosk-payment-${width}.png`,
      fullPage: true,
    });
    orderStatus = 'COMPLETED';
    await expect(page.getByText('Đã nhận hoa', { exact: true })).toBeVisible({ timeout: 7000 });
    await expect(page.getByRole('link', { name: 'Mở liên kết thanh toán (tab mới)' })).toHaveCount(
      0,
    );
    await page.getByRole('button', { name: 'Kết thúc lượt mua' }).click();
    await expect(page.getByText('ABCD2345')).toHaveCount(0);
    await expect(page.getByRole('checkbox')).not.toBeChecked();
  });

test('No automatic checkout retry after response loss and idle clears selection', async ({
  page,
}) => {
  let attempts = 0;
  await page.route('**/flows/kiosk_checkout', (route) => {
    attempts++;
    return route.abort();
  });
  await page.goto('/');
  await page.clock.install();
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Giữ hoa và thanh toán' }).click();
  await expect(page.getByRole('alert')).toContainText('tránh tạo giỏ trùng');
  await expect(page.getByRole('button', { name: 'Giữ hoa và thanh toán' })).toBeDisabled();
  await page.clock.fastForward(540000);
  await expect(page.getByText('Lượt mua sẽ kết thúc', { exact: false })).toBeVisible();
  await page.clock.fastForward(61000);
  await expect(page.getByRole('checkbox')).not.toBeChecked();
  expect(attempts).toBe(1);
});

test('Installed offline shell does not cache checkout or enable purchase', async ({
  page,
  context,
}) => {
  await page.goto('/');
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await expect(page.getByRole('checkbox')).toBeVisible();
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Một bó hoa, một ngày vui.' })).toBeVisible();
  await expect(page.getByRole('alert')).toContainText('mất kết nối');
  await expect(page.getByRole('button', { name: 'Giữ hoa và thanh toán' })).toBeDisabled();
  const cached = await page.evaluate(async () =>
    (
      await Promise.all(
        (await caches.keys()).map(async (key) =>
          (await (await caches.open(key)).keys()).map((request) => request.url),
        ),
      )
    ).flat(),
  );
  expect(cached.some((url) => new URL(url).pathname.startsWith('/api/'))).toBe(false);
});
