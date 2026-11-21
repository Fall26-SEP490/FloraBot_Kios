import { test, expect } from '@playwright/test';

test('customer kiosk does not expose or poll internal maintenance OTP', async ({ page }) => {
  const kiosk = '00000000-0000-0000-0000-000000000001';
  await page.addInitScript((id) => {
    sessionStorage.setItem('florabot-device', JSON.stringify({ id, key: 'test-kiosk-device-key' }));
  }, kiosk);
  await page.route('**/api/**', (route) => route.fulfill({ status: 503, json: {} }));
  await page.route('**/hub/**', (route) => route.fulfill({ status: 503 }));
  let internalRequests = 0;
  await page.route('**/maintenance-access/**', (route) => {
    internalRequests++;
    return route.fulfill({ json: [] });
  });
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Nhập mã thao tác tủ' })).toHaveCount(0);
  await expect(page.getByRole('dialog', { name: 'Xác nhận mở ô' })).toHaveCount(0);
  await expect(page.locator('.kh-main')).toBeVisible();
  expect(internalRequests).toBe(0);
});
