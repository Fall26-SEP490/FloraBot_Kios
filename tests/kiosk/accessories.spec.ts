import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
const item = {
  id: 'a1',
  name: 'Nơ tặng hoa',
  price: 25000,
  stockQuantity: 5,
  shopName: 'Tiệm Hoa Nhỏ',
};
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() =>
    sessionStorage.setItem(
      'florabot-device',
      JSON.stringify({ id: '40000000-0000-0000-0000-000000000001', key: 'test-accessory-key' }),
    ),
  );
  await page.route('**/catalog/items', (route) =>
    route.fulfill({
      json: [
        {
          bouquetId: 'b1',
          name: 'Bó cúc',
          price: 150000,
          slotCode: 'A01',
          shopName: 'Tiệm Hoa Nhỏ',
        },
      ],
    }),
  );
});

for (const width of [390, 1024])
  test(`Mixed basket accessory quantities and accessibility ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.route('**/catalog/accessories', (route) => route.fulfill({ json: [item] }));
    await page.route('**/flows/kiosk_checkout', (route) => {
      expect(route.request().postDataJSON()).toEqual({
        p_bouquets: ['b1'],
        p_accessories: [{ id: 'a1', qty: 2 }],
      });
      return route.fulfill({ json: { result: 'mixed-checkout' } });
    });
    await page.route('**/checkouts/mixed-checkout', (route) =>
      route.fulfill({
        json: {
          id: 'mixed-checkout',
          paymentStatus: 'PENDING',
          amount: 200000,
          payBefore: new Date(Date.now() + 420000).toISOString(),
          orders: [],
        },
      }),
    );
    await page.goto('/');
    await page.getByRole('checkbox').check();
    await page.getByRole('button', { name: 'Xem phụ kiện tại tủ' }).click();
    const quantity = page.getByLabel('Số lượng Nơ tặng hoa');
    await expect(page.getByRole('button', { name: 'Cập nhật phụ kiện' })).toBeFocused();
    const buy = page.getByRole('button', { name: 'Giữ hoa và thanh toán' });
    for (const invalid of ['-1', '0.5', '6']) {
      await quantity.fill(invalid);
      await expect(quantity).toHaveAttribute('aria-invalid', 'true');
      await expect(buy).toBeDisabled();
    }
    await quantity.fill('2');
    await expect(buy).toBeEnabled();
    await expect(page.locator('.basket > p').first()).toContainText('200.000');
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
    await page
      .locator('.accessory-picker')
      .screenshot({ path: `.impeccable/review/accessories-${width}.png` });
    await buy.click();
    await expect(page.locator('.total')).toContainText('200.000');
    await page.getByRole('button', { name: 'Kết thúc lượt mua' }).click();
    await page.getByRole('button', { name: 'Xem phụ kiện tại tủ' }).click();
    await expect(quantity).toHaveValue('0');
  });

test('Accessory-only checkout and unavailable stock recovery', async ({ page }) => {
  let available = true;
  let posts = 0;
  await page.route('**/catalog/items', (route) => route.fulfill({ json: [] }));
  await page.route('**/catalog/accessories', (route) =>
    route.fulfill({ json: available ? [item] : [] }),
  );
  await page.route('**/flows/kiosk_checkout', (route) => {
    posts++;
    expect(route.request().postDataJSON()).toEqual({
      p_bouquets: [],
      p_accessories: [{ id: 'a1', qty: 2 }],
    });
    available = false;
    return route.fulfill({ status: 409, json: { detail: 'Phụ kiện vừa hết tồn kho.' } });
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Xem phụ kiện tại tủ' }).click();
  await page.getByLabel('Số lượng Nơ tặng hoa').fill('2');
  const buy = page.getByRole('button', { name: 'Giữ hoa và thanh toán' });
  await expect(buy).toBeEnabled();
  await buy.click();
  await expect(page.getByText('Tủ hiện chưa có phụ kiện sẵn sàng.')).toBeVisible();
  await expect(buy).toBeDisabled();
  expect(posts).toBe(1);
  await page.getByRole('button', { name: 'Bỏ phụ kiện đã chọn' }).click();
  await expect(page.locator('.basket > p').first()).toContainText('0');
});

test('Failed optional catalog permits flowers, while unsafe price is not selectable', async ({
  page,
}) => {
  let failed = true;
  await page.route('**/catalog/accessories', (route) =>
    route.fulfill({
      status: failed ? 503 : 200,
      json: failed ? {} : [{ ...item, price: '9007199254740993' }],
    }),
  );
  await page.goto('/');
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Xem phụ kiện tại tủ' }).click();
  await expect(page.getByRole('alert')).toContainText('Chưa lấy được danh sách phụ kiện');
  await expect(page.getByRole('button', { name: 'Giữ hoa và thanh toán' })).toBeEnabled();
  failed = false;
  await page.getByRole('button', { name: 'Tải lại phụ kiện' }).click();
  await expect(page.getByLabel('Số lượng Nơ tặng hoa')).toBeDisabled();
  await expect(page.getByText('Chưa hiển thị được giá chính xác', { exact: false })).toBeVisible();
});
