import { expect, test } from '@playwright/test';

test('Paid receipt retries in place without entering receipt codes', async ({ page }) => {
  const id = '30000000-0000-0000-0000-000000000099';
  let status = 'DISPENSING';
  let requests = 0;
  await page.addInitScript(() =>
    sessionStorage.setItem(
      'florabot-device',
      JSON.stringify({ id: '40000000-0000-0000-0000-000000000001', key: 'test-device-key' }),
    ),
  );
  await page.route('**/catalog/items', (route) =>
    route.fulfill({
      json: [
        { bouquetId: id, name: 'Bó hồng', price: 10000, slotCode: 'S02', shopName: 'Shop thử' },
      ],
    }),
  );
  await page.route('**/flows/kiosk_checkout', (route) =>
    route.fulfill({ json: { result: 'demo-checkout' } }),
  );
  await page.route('**/checkouts/demo-checkout', (route) =>
    route.fulfill({
      json: {
        id: 'demo-checkout',
        amount: 10000,
        paymentStatus: 'SUCCEEDED',
        payBefore: new Date(Date.now() + 60000).toISOString(),
        orders: [{ id, orderCode: 'TEST-S02', amount: 10000, status, trackingToken: 'ABCD2345' }],
      },
    }),
  );
  await page.route('**/flows/request_pickup', (route) => {
    expect(route.request().postDataJSON()).toEqual({ p_order: id, p_tracking: 'ABCD2345' });
    requests++;
    return route.fulfill({ json: { result: id } });
  });
  await page.clock.install();
  await page.goto('/');
  await page.getByRole('button', { name: 'Mua hoa tại chỗ', exact: true }).click();
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: /^Thanh toán,/ }).click();
  await page.getByRole('button', { name: 'Giữ hoa và thanh toán' }).click();
  const retry = page.getByRole('button', { name: 'Cửa vẫn đóng? Thử mở lại' });
  await retry.click();
  await expect(page.getByText(/^Đã tiếp nhận yêu cầu mở ô/)).toBeVisible();
  expect(requests).toBe(1);
  await expect(page.getByText('Quét QR để lưu biên nhận')).toBeVisible();
  await expect(retry).toHaveCount(0);
  await page.clock.fastForward(25000);
  await retry.click();
  await expect(page.getByText(/^Đã tiếp nhận yêu cầu mở ô/)).toBeVisible();
  expect(requests).toBe(2);
  status = 'COMPLETED';
  await page.clock.runFor(3200);
  await expect(page.getByText('Đã nhận hoa', { exact: true })).toBeVisible();
  await expect(retry).toHaveCount(0);
});
