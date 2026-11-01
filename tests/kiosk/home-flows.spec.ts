import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const kiosk = '40000000-0000-0000-0000-000000000001';
const order = '30000000-0000-0000-0000-000000000099';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(
    (id) =>
      sessionStorage.setItem('florabot-device', JSON.stringify({ id, key: 'home-device-key' })),
    kiosk,
  );
  await page.route(`**/api/kiosk-support/${kiosk}`, (route) =>
    route.fulfill({
      json: {
        id: kiosk,
        code: 'K-Q1-01',
        name: 'Tủ hoa Quận 1',
        address: 'Địa điểm kiểm thử',
        status: 'ONLINE',
        sellerId: '20000000-0000-0000-0000-000000000001',
        shopName: 'Shop hoa của bạn',
      },
    }),
  );
  await page.route('**/catalog/items', (route) =>
    route.fulfill({
      json: [
        {
          bouquetId: 'b1',
          name: 'Bó hồng lụa',
          price: 350000,
          slotCode: 'A02',
          shopName: 'Shop hoa của bạn',
        },
      ],
    }),
  );
});

for (const width of [390, 1024, 1366])
  test(`Home service choice, language, staff boundary and support QR ${width}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1000 });
    const mutations: string[] = [];
    await page.route('**/pickup/**', (route) => {
      if (route.request().method() === 'POST') mutations.push(route.request().url());
      return route.abort();
    });
    await page.goto('/');
    await expect(page.getByRole('button', { name: 'Mua hoa tại chỗ', exact: false })).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Nhận đơn đặt trước', exact: false }),
    ).toBeVisible();
    await expect(page.getByRole('img', { name: 'QR báo lỗi thiết bị' })).toBeVisible();
    await expect(page.getByRole('img', { name: 'QR hỗ trợ cửa hàng' })).toBeVisible();
    await page.getByRole('button', { name: 'Tôi là nhân viên' }).click();
    await expect(page.getByRole('link', { name: 'Đăng nhập nhân viên' })).toHaveAttribute(
      'href',
      'https://florabot-fe.vercel.app/workspace',
    );
    expect(mutations).toEqual([]);
    await page.getByRole('button', { name: 'Tôi là khách hàng' }).click();
    await page.screenshot({ path: `artifacts/kiosk-home-vi-${width}.png`, fullPage: true });
    await page.getByRole('button', { name: 'English', exact: true }).click();
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(
      page.getByRole('heading', { name: 'What brings you a little joy today?' }),
    ).toBeVisible();
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
    await page.screenshot({ path: `artifacts/kiosk-home-${width}.png`, fullPage: true });
    await page.getByRole('button', { name: /Buy flowers here/ }).click();
    await expect(page.getByRole('heading', { name: 'Find your little joy' })).toBeVisible();
    await expect(page.getByRole('checkbox', { name: /Bó hồng lụa/ })).toBeVisible();
    await page.getByRole('checkbox', { name: /Bó hồng lụa/ }).check();
    await page.getByRole('button', { name: /^Open basket/ }).click();
    await expect(page.getByRole('button', { name: 'Reserve and pay' })).toBeEnabled();
    await page.getByRole('button', { name: 'Close basket' }).click();
    await page.getByRole('button', { name: 'Home', exact: true }).click();
    await expect(page.getByRole('button', { name: /Collect a preorder/ })).toBeVisible();
  });

test('Mobile report QR landing submits without device credentials or hardware commands', async ({
  page,
}) => {
  let reports = 0;
  await page.route(`**/api/kiosk-support/${kiosk}/device`, (route) => {
    reports++;
    expect(route.request().headers()['x-kiosk-key']).toBeUndefined();
    expect(route.request().headers().authorization).toBeUndefined();
    return route.fulfill({ json: { id: 'support-ref' } });
  });
  await page.goto(`/?support=device&kiosk=${kiosk}`);
  await page
    .getByLabel('Vấn đề bạn gặp phải')
    .fill('Màn hình của tủ bị đứng và không thể thao tác.');
  await page.getByRole('button', { name: 'Gửi báo lỗi' }).click();
  await expect(page.getByRole('status')).toContainText('Đã gửi đến admin');
  expect(reports).toBe(1);
});

test('Walk-in shows the bank QR and follows server dispensing state without browser unlock commands', async ({
  page,
}) => {
  let status = 'AWAITING_PAYMENT';
  const browserUnlocks: string[] = [];
  page.on('request', (request) => {
    if (request.method() === 'POST' && /pickup|unlock|device_event/.test(request.url()))
      browserUnlocks.push(request.url());
  });
  await page.route('**/flows/kiosk_checkout', (route) =>
    route.fulfill({ json: { result: 'native-qr-checkout' } }),
  );
  await page.route('**/checkouts/native-qr-checkout', (route) =>
    route.fulfill({
      json: {
        id: 'native-qr-checkout',
        amount: 350000,
        paymentStatus: status === 'AWAITING_PAYMENT' ? 'PENDING' : 'SUCCEEDED',
        payBefore: new Date(Date.now() + 300000).toISOString(),
        orders: [
          {
            id: order,
            orderCode: 'FB-NATIVE-QR',
            amount: 350000,
            status,
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
        checkoutUrl: 'https://pay.payos.vn/web/0123456789abcdef0123456789abcdef',
        qrCode: '000201-signed-provider-bank-payload',
      },
    }),
  );
  await page.goto('/');
  await page.getByRole('button', { name: 'Mua hoa tại chỗ', exact: true }).click();
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: /^Mở giỏ hoa/ }).click();
  await page.getByRole('button', { name: 'Giữ hoa và thanh toán' }).click();
  await page.getByRole('button', { name: 'Tạo mã thanh toán' }).click();
  await expect(page.getByRole('heading', { name: 'Quét bằng ứng dụng ngân hàng' })).toBeVisible();
  await expect(
    page.getByRole('img', { name: 'Mã QR thanh toán payOS', exact: true }),
  ).toBeVisible();
  await page.screenshot({ path: 'test-results/walkin-bank-qr.png', fullPage: true });
  status = 'DISPENSING';
  await expect(page.getByRole('status').filter({ hasText: 'Tủ đang mở' })).toBeVisible();
  status = 'COMPLETED';
  await expect(page.getByRole('status').filter({ hasText: 'Đã nhận hoa' })).toBeVisible();
  expect(browserUnlocks).toEqual([]);
});

for (const qrCode of [undefined, null, '   ', 'https://pay.payos.vn/web/example'])
  test(`Walk-in refuses a checkout-link QR and allows retry: ${String(qrCode)}`, async ({
    page,
  }) => {
    let attempts = 0;
    await page.route('**/flows/kiosk_checkout', (route) =>
      route.fulfill({ json: { result: 'qr-retry' } }),
    );
    await page.route('**/checkouts/qr-retry', (route) =>
      route.fulfill({
        json: {
          id: 'qr-retry',
          amount: 350000,
          paymentStatus: 'PENDING',
          payBefore: new Date(Date.now() + 300000).toISOString(),
          orders: [],
        },
      }),
    );
    await page.route('**/payment-link', (route) => {
      attempts++;
      return route.fulfill({
        json: {
          orderCode: 123,
          amount: 350000,
          checkoutUrl: 'https://pay.payos.vn/web/0123456789abcdef0123456789abcdef',
          qrCode: attempts === 1 ? qrCode : '000201-signed-provider-bank-payload',
        },
      });
    });
    await page.goto('/');
    await page.getByRole('button', { name: 'Mua hoa tại chỗ', exact: true }).click();
    await page.getByRole('checkbox').check();
    await page.getByRole('button', { name: /^Mở giỏ hoa/ }).click();
    await page.getByRole('button', { name: 'Giữ hoa và thanh toán' }).click();
    await page.getByRole('button', { name: 'Tạo mã thanh toán' }).click();
    await expect(page.getByRole('alert')).toContainText('Chưa lấy được mã QR ngân hàng');
    await expect(page.locator('.payment-code svg')).toHaveCount(0);
    await page.getByRole('button', { name: 'Tạo mã thanh toán' }).click();
    await expect(
      page.getByRole('img', { name: 'Mã QR thanh toán payOS', exact: true }),
    ).toBeVisible();
    expect(attempts).toBe(2);
  });
