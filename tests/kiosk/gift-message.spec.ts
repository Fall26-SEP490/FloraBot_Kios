import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() =>
    sessionStorage.setItem(
      'florabot-device',
      JSON.stringify({ id: '40000000-0000-0000-0000-000000000001', key: 'test-device-key' }),
    ),
  );
  await page.route('**/catalog/items', (route) =>
    route.fulfill({
      json: [{ bouquetId: 'b1', name: 'Bó cúc', price: 150000, slotCode: 'A01', shopName: 'Shop' }],
    }),
  );
});

for (const width of [390, 1024])
  test(`Gift note code-point limit and escaped content ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    let submitted: unknown;
    await page.route('**/flows/kiosk_checkout', (route) => {
      submitted = route.request().postDataJSON();
      return route.fulfill({ json: { result: 'checkout-note' } });
    });
    await page.route('**/checkouts/checkout-note', (route) =>
      route.fulfill({
        json: {
          id: 'checkout-note',
          paymentStatus: 'PENDING',
          amount: 150000,
          payBefore: new Date(Date.now() + 420000).toISOString(),
          orders: [],
        },
      }),
    );
    await page.goto('/');
    await page.getByRole('checkbox').check();
    const note = page.getByLabel('Lời nhắn tặng hoa (không bắt buộc)');
    const buy = page.getByRole('button', { name: 'Giữ hoa và thanh toán' });
    await note.fill('🌼'.repeat(151));
    await expect(note).toHaveAttribute('aria-invalid', 'true');
    await expect(buy).toBeDisabled();
    await expect(page.locator('#ecard-error')).toContainText('Rút gọn thêm 1 ký tự');
    await note.fill('🌼'.repeat(150));
    await expect(page.locator('#ecard-count')).toHaveText('150/150 ký tự');
    await expect(buy).toBeEnabled();
    const message = 'Mong mẹ luôn vui 🌼\n<script>alert(1)</script>';
    await note.fill(message);
    await expect(page.locator('#ecard-count')).toHaveText(
      `${Array.from(message).length}/150 ký tự`,
    );
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
      .locator('.gift-message-editor')
      .screenshot({ path: `.impeccable/review/gift-message-${width}.png` });
    expect(
      await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage })),
    ).not.toContain(message);
    await buy.click();
    await expect(
      page.getByRole('heading', { name: 'Một chút nữa là hoa đến tay bạn.' }),
    ).toBeVisible();
    expect(submitted).toEqual({ p_bouquets: ['b1'], p_ecard: message });
    await page.getByRole('button', { name: 'Kết thúc lượt mua' }).click();
    await expect(note).toHaveValue('');
  });

test('Hidden tab clears unsent gift note; known rejection preserves it for correction', async ({
  page,
}) => {
  await page.route('**/flows/kiosk_checkout', (route) =>
    route.fulfill({ status: 409, json: { detail: 'Giỏ hoa cần được kiểm tra lại.' } }),
  );
  await page.goto('/');
  await page.getByRole('checkbox').check();
  const note = page.getByLabel('Lời nhắn tặng hoa (không bắt buộc)');
  await note.fill('Một lời nhắn riêng');
  await page.getByRole('button', { name: 'Giữ hoa và thanh toán' }).click();
  await expect(page.getByRole('alert')).toContainText('Giỏ hoa cần được kiểm tra lại.');
  await expect(note).toHaveValue('Một lời nhắn riêng');
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect(note).toHaveValue('');
});
