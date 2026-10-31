import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() =>
    sessionStorage.setItem(
      'florabot-device',
      JSON.stringify({
        id: '40000000-0000-0000-0000-000000000001',
        key: 'test-accessory-key',
      }),
    ),
  );
  await page.route('**/catalog/items', (route) =>
    route.fulfill({
      json: [
        {
          bouquetId: 'b1',
          name: 'Bó cúc lụa',
          price: 150000,
          slotCode: 'A01',
          shopName: 'Tiệm Hoa Nhỏ',
        },
      ],
    }),
  );
});

for (const width of [390, 1024]) {
  test(`Walk-in buys bouquets only; accessories remain preorder-only ${width}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1000 });
    let accessoryReads = 0;
    let checkoutBody: unknown;
    // Even an available legacy accessory API cannot expose an unsupported purchase flow.
    await page.route('**/catalog/accessories', (route) => {
      accessoryReads++;
      return route.fulfill({
        json: [{ id: 'a1', name: 'Nơ tặng hoa', price: 25000, stockQuantity: 5 }],
      });
    });
    await page.route('**/flows/kiosk_checkout', (route) => {
      checkoutBody = route.request().postDataJSON();
      return route.fulfill({ json: { result: 'flower-checkout' } });
    });
    await page.route('**/checkouts/flower-checkout', (route) =>
      route.fulfill({
        json: {
          id: 'flower-checkout',
          paymentStatus: 'PENDING',
          amount: 150000,
          payBefore: new Date(Date.now() + 420000).toISOString(),
          orders: [],
        },
      }),
    );
    await page.goto('/');
    await page.getByRole('button', { name: 'Mua hoa tại chỗ', exact: true }).click();
    await expect(
      page.getByText(
        'Bó hoa mua tại chỗ đã được chuẩn bị sẵn. Phụ kiện đi kèm chỉ áp dụng cho đơn đặt trước.',
      ),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'Xem phụ kiện tại tủ' })).toHaveCount(0);
    await page.getByRole('checkbox').check();
    const buy = page.getByRole('button', { name: 'Giữ hoa và thanh toán' });
    await expect(buy).toBeEnabled();
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
    await buy.click();
    await expect(page.locator('.total')).toContainText('150.000');
    expect(checkoutBody).toEqual({ p_bouquets: ['b1'] });
    expect(accessoryReads).toBe(0);
    await page.getByRole('button', { name: 'Kết thúc lượt mua' }).click();
    await expect(page.getByRole('button', { name: 'Xem phụ kiện tại tủ' })).toHaveCount(0);
  });
}

test('Empty bouquet catalogue cannot become an accessory-only checkout', async ({ page }) => {
  let posts = 0;
  await page.route('**/catalog/items', (route) => route.fulfill({ json: [] }));
  await page.route('**/flows/kiosk_checkout', (route) => {
    posts++;
    return route.abort();
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Mua hoa tại chỗ', exact: true }).click();
  await expect(
    page.getByText(
      'Bó hoa mua tại chỗ đã được chuẩn bị sẵn. Phụ kiện đi kèm chỉ áp dụng cho đơn đặt trước.',
    ),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Giữ hoa và thanh toán' })).toBeDisabled();
  await expect(page.getByRole('spinbutton')).toHaveCount(0);
  expect(posts).toBe(0);
});

test('Legacy accessory API failure never blocks bouquet selection or causes hidden requests', async ({
  page,
}) => {
  let accessoryReads = 0;
  await page.route('**/catalog/accessories', (route) => {
    accessoryReads++;
    return route.fulfill({ status: 503, json: {} });
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Mua hoa tại chỗ', exact: true }).click();
  await page.getByRole('checkbox').check();
  await expect(page.getByRole('button', { name: 'Giữ hoa và thanh toán' })).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Tải lại phụ kiện' })).toHaveCount(0);
  expect(accessoryReads).toBe(0);
});
