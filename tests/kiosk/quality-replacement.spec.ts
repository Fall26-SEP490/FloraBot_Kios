import { expect, test } from '@playwright/test';

const kioskId = '40000000-0000-0000-0000-000000000001';
const orderId = '40000000-0000-0000-0000-000000000002';
const complaintId = '40000000-0000-0000-0000-000000000003';
const trackingToken = 'ABCD2345';
const ready = {
  id: complaintId,
  orderId,
  kioskId,
  orderCode: 'FB-REPLACEMENT',
  handlingState: 'REPLACEMENT_READY',
  status: 'OPEN',
  replacement: {
    state: 'READY',
    slotCode: 'A01',
    expiresAt: '2035-01-01T00:00:00Z',
    commandStatus: null,
  },
};

test('Opening checks an uncertain result first, reuses the attempt and waits for COLLECTED', async ({
  page,
}) => {
  await page.addInitScript(
    (id) => sessionStorage.setItem('florabot-device', JSON.stringify({ id, key: 'fixture-key' })),
    kioskId,
  );
  await page.route('**/api/kiosk-support/**', (route) => route.fulfill({ json: {} }));
  await page.route('**/maintenance-access/pending', (route) => route.fulfill({ json: [] }));
  await page.route('**/api/receipts/complaints/lookup', (route) => {
    expect(route.request().postDataJSON()).toEqual({ orderId, trackingToken });
    expect(route.request().headers()['x-kiosk-key']).toBeUndefined();
    return route.fulfill({ json: ready });
  });
  let requests = 0;
  let checks = 0;
  let attemptId = '';
  let collected = false;
  await page.route('**/quality-replacements/open', (route) => {
    const body = route.request().postDataJSON();
    expect(route.request().headers()['x-kiosk-key']).toBe('fixture-key');
    expect(body).toMatchObject({ orderId, trackingToken, complaintId });
    requests++;
    if (requests === 1) {
      attemptId = body.attemptId;
      return route.abort();
    }
    expect(body.attemptId).toBe(attemptId);
    expect(checks).toBeGreaterThan(0);
    return route.fulfill({ json: { complaintId, commandId: 'command', commandStatus: 'ISSUED' } });
  });
  await page.route('**/quality-replacements/status', (route) => {
    checks++;
    expect(route.request().postDataJSON().attemptId).toBe(attemptId);
    return route.fulfill({
      json:
        requests === 1
          ? ready
          : {
              ...ready,
              status: collected ? 'RESOLVED_FIXED' : 'OPEN',
              replacement: {
                ...ready.replacement,
                state: collected ? 'COLLECTED' : 'READY',
                commandStatus: 'CLOSED',
              },
            },
    });
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Nhận hoa thay', exact: true }).click();
  await page.getByLabel('ID biên nhận').fill(orderId);
  await page.getByLabel('Mã tra cứu').fill(trackingToken);
  await page.getByRole('button', { name: 'Tra cứu hoa thay' }).click();
  const open = page.getByRole('button', { name: 'Mở ô nhận hoa thay' });
  await open.click();
  await expect(page.getByRole('alert')).toContainText('Chưa xác nhận được lệnh mở ô');
  await expect(open).toHaveCount(0);
  const check = page.getByRole('button', { name: 'Kiểm tra trạng thái' });
  await check.click();
  await open.click();
  await check.click();
  await expect(page.getByRole('status')).toContainText('Đang chờ cảm biến');
  await expect(page.getByText('Đã nhận hoa thay thành công.')).toHaveCount(0);
  collected = true;
  await check.click();
  await expect(page.getByRole('status')).toContainText('Đã nhận hoa thay thành công.');
  expect(page.url()).not.toContain(trackingToken);
  expect(requests).toBe(2);
});
