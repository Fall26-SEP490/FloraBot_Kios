import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
const order = '30000000-0000-0000-0000-000000000099';
const command = '50000000-0000-0000-0000-000000000099';
async function open(page: Page) {
  await page.addInitScript(() =>
    sessionStorage.setItem(
      'florabot-device',
      JSON.stringify({ id: '40000000-0000-0000-0000-000000000001', key: 'pickup-device-key' }),
    ),
  );
  await page.route('**/catalog/items', (route) => route.fulfill({ json: [] }));
  await page.goto('/');
  await page.getByRole('button', { name: 'Đã thanh toán nhưng chưa nhận hoa?' }).click();
}
async function review(page: Page) {
  await page.getByLabel('ID biên nhận', { exact: true }).fill(order);
  await page.getByLabel('Mã biên nhận (8 ký tự)').fill(' abcd2345 ');
  await page.getByRole('button', { name: 'Kiểm tra thông tin' }).click();
  await expect(page.getByRole('heading', { name: 'Yêu cầu mở lại ô nhận hoa?' })).toBeFocused();
}
for (const width of [390, 1024])
  test(`Explicit pickup request, focus and accessibility ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    let posts = 0;
    await page.route('**/flows/request_pickup', (route) => {
      posts++;
      expect(route.request().headers()['x-kiosk-key']).toBe('pickup-device-key');
      expect(route.request().postDataJSON()).toEqual({ p_order: order, p_tracking: 'ABCD2345' });
      return route.fulfill({ json: { result: command } });
    });
    await open(page);
    await expect(page.getByRole('heading', { name: 'Nhận tiếp bó hoa của bạn' })).toBeFocused();
    await page.getByRole('button', { name: 'Kiểm tra thông tin' }).click();
    await expect(page.getByLabel('ID biên nhận', { exact: true })).toBeFocused();
    await review(page);
    expect(posts).toBe(0);
    await page.getByRole('button', { name: 'Sửa thông tin' }).click();
    await expect(page.getByLabel('ID biên nhận', { exact: true })).toBeFocused();
    await page.getByRole('button', { name: 'Kiểm tra thông tin' }).click();
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
    await page.screenshot({ path: `.impeccable/review/pickup-${width}.png`, fullPage: true });
    await page.getByRole('button', { name: 'Yêu cầu mở ô nhận hoa' }).click();
    await expect(page.getByRole('status')).toContainText('Đã tiếp nhận yêu cầu mở ô');
    await expect(page.getByRole('status')).toBeFocused();
    await expect(page.getByRole('status')).toContainText('chưa xác nhận bạn đã nhận hoa');
    expect(posts).toBe(1);
    await expect(page.getByRole('button', { name: 'Yêu cầu mở ô nhận hoa' })).toHaveCount(0);
    expect(
      await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage })),
    ).not.toContain('ABCD2345');
    await page.getByRole('button', { name: 'Trở lại chọn hoa' }).click();
    await expect(
      page.getByRole('button', { name: 'Đã thanh toán nhưng chưa nhận hoa?' }),
    ).toBeFocused();
    await page.getByRole('button', { name: 'Đã thanh toán nhưng chưa nhận hoa?' }).click();
    await expect(page.getByLabel('ID biên nhận', { exact: true })).toHaveValue('');
  });

test('Null result rejects code, conflict permits correction, lost response never retries', async ({
  page,
}) => {
  let posts = 0;
  await page.route('**/flows/request_pickup', (route) => {
    posts++;
    return posts === 1
      ? route.fulfill({ json: { result: null } })
      : posts === 2
        ? route.fulfill({ status: 409, json: { detail: 'Hết thời gian giữ hàng tại tủ' } })
        : route.abort();
  });
  await open(page);
  await review(page);
  await page.getByRole('button', { name: 'Yêu cầu mở ô nhận hoa' }).click();
  await expect(page.getByRole('alert')).toContainText('Mã biên nhận chưa đúng');
  await expect(page.getByLabel('Mã biên nhận (8 ký tự)')).toBeFocused();
  await page.getByRole('button', { name: 'Kiểm tra thông tin' }).click();
  await page.getByRole('button', { name: 'Yêu cầu mở ô nhận hoa' }).click();
  await expect(page.getByRole('alert')).toContainText('Hết thời gian giữ hàng');
  await page.getByRole('button', { name: 'Kiểm tra thông tin' }).click();
  await page.getByRole('button', { name: 'Yêu cầu mở ô nhận hoa' }).click();
  await expect(page.getByRole('alert')).toContainText('Màn hình không tự gửi lại');
  await expect(page.getByRole('button', { name: 'Yêu cầu mở ô nhận hoa' })).toHaveCount(0);
  expect(posts).toBe(3);
});

test('Offline and hidden-tab recovery do not send or resurrect a request', async ({
  page,
  context,
}) => {
  let release: (() => void) | undefined;
  let posts = 0;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/flows/request_pickup', async (route) => {
    posts++;
    await gate;
    await route.fulfill({ json: { result: command } });
  });
  await open(page);
  await review(page);
  await context.setOffline(true);
  await expect(page.getByRole('button', { name: 'Yêu cầu mở ô nhận hoa' })).toBeDisabled();
  expect(posts).toBe(0);
  await context.setOffline(false);
  await page.getByRole('button', { name: 'Yêu cầu mở ô nhận hoa' }).click();
  await expect(page.getByRole('button', { name: 'Đang gửi yêu cầu…' })).toBeDisabled();
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  release?.();
  await expect(page.locator('.pickup-recovery')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Một bó hoa, một ngày vui.' })).toBeVisible();
  await expect(page.getByText('Đã tiếp nhận yêu cầu mở ô', { exact: false })).toHaveCount(0);
  expect(posts).toBe(1);
});
