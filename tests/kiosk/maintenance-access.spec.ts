import { test, expect } from '@playwright/test';

for (const operation of ['START', 'PREORDER_LOAD']) {
  test(`${operation} OTP is entered at the bound kiosk and requests only one unlock`, async ({
    page,
  }) => {
    const kiosk = '00000000-0000-0000-0000-000000000001';
    const challenge = '00000000-0000-0000-0000-000000000002';
    await page.addInitScript((id) => {
      sessionStorage.setItem(
        'florabot-device',
        JSON.stringify({ id, key: 'test-kiosk-device-key' }),
      );
    }, kiosk);
    let completed = false;
    let submitted = 0;
    await page.route('**/api/kiosk-support/**', (route) =>
      route.fulfill({ json: { name: 'Test kiosk', code: 'KIOSK1' } }),
    );
    await page.route(`**/api/kiosks/${kiosk}/maintenance-access/pending`, (route) => {
      expect(route.request().headers()['x-kiosk-key']).toBe('test-kiosk-device-key');
      return route.fulfill({
        json: completed
          ? []
          : [
              {
                id: challenge,
                slotCode: operation === 'PREORDER_LOAD' ? 'P01' : 'W01',
                operation,
                expiresAt: new Date(Date.now() + 120_000).toISOString(),
              },
            ],
      });
    });
    await page.route(`**/api/kiosks/${kiosk}/maintenance-access/${challenge}/confirm`, (route) => {
      expect(route.request().headers()['x-kiosk-key']).toBe('test-kiosk-device-key');
      expect(route.request().postDataJSON()).toEqual({ code: '012345' });
      submitted++;
      completed = true;
      return route.fulfill({ json: { status: 'ACCEPTED' } });
    });

    await page.goto('/');
    const dialog = page.getByRole('dialog', { name: 'Xác nhận mở ô' });
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText(operation === 'PREORDER_LOAD' ? 'P01' : 'W01');
    await expect(dialog.getByRole('button', { name: 'Xác nhận', exact: true })).toBeDisabled();
    await dialog
      .getByLabel(operation === 'PREORDER_LOAD' ? 'Mã 6 số trong email' : 'Mã 6 số trên điện thoại')
      .fill('012345');
    await dialog.getByRole('button', { name: 'Xác nhận', exact: true }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByText('Đã tiếp nhận lệnh mở ô.')).toBeVisible();
    expect(submitted).toBe(1);
  });
}
