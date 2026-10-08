import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
const kiosk = '40000000-0000-0000-0000-000000000001';
const bouquet = '50000000-0000-0000-0000-000000000001';
const survey = '60000000-0000-4000-8000-000000000001';
const answer = {
  id: survey,
  source: 'FALLBACK',
  suggestions: [
    {
      bouquetId: bouquet,
      productId: '30000000-0000-0000-0000-000000000001',
      name: 'Bó hồng dịu dàng',
      price: 250000,
      reason: 'Một món quà ấm áp dành cho mẹ.',
      cardMessage: 'Chúc mẹ một ngày thật vui.',
    },
  ],
};

test.beforeEach(async ({ page }) => {
  await page.addInitScript(
    (id) =>
      sessionStorage.setItem('florabot-device', JSON.stringify({ id, key: 'test-device-key' })),
    kiosk,
  );
  await page.route('**/catalog/items', (route) =>
    route.fulfill({
      json: [
        {
          bouquetId: bouquet,
          name: 'Bó hồng dịu dàng',
          price: 250000,
          slotCode: 'A01',
          shopName: 'Tiệm Hoa Nhỏ',
        },
      ],
    }),
  );
});

for (const width of [390, 1024])
  test(`Survey selection, keyboard focus and accessibility ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.route('**/flows/ai_suggest', (route) => {
      const input = route.request().postDataJSON();
      expect(input).toMatchObject({
        p_recipient: 'MOTHER',
        p_age: '41_60',
        p_occasion: 'BIRTHDAY',
        p_tone: 'WARM',
        p_budget: 300000,
      });
      expect(Object.keys(input)).toHaveLength(6);
      expect(route.request().headers()['x-kiosk-key']).toBe('test-device-key');
      return route.fulfill({ json: { result: survey } });
    });
    await page.route('**/surveys/*', (route) => route.fulfill({ json: answer }));
    await page.goto('/');
    await page.getByText('Cần một chút gợi ý để chọn hoa?', { exact: true }).click();
    await page.getByLabel('Ngân sách tối đa (đồng)').fill('0');
    await page.getByRole('button', { name: 'Tìm hoa phù hợp', exact: true }).click();
    await expect(page.getByLabel('Ngân sách tối đa (đồng)')).toBeFocused();
    await expect(page.getByText('Ngân sách cần lớn hơn 0 đ.')).toBeVisible();
    await page.getByLabel('Ngân sách tối đa (đồng)').fill('300000');
    await page.getByRole('button', { name: 'Tìm hoa phù hợp', exact: true }).click();
    await expect(
      page.getByRole('heading', { name: 'Một chút cảm hứng cho món quà' }),
    ).toBeFocused();
    await expect(page.getByText('Gợi ý dựa trên dịp tặng', { exact: false })).toBeVisible();
    await page.getByRole('button', { name: 'Dùng lời nhắn này' }).click();
    await expect(page.getByLabel('Lời nhắn tặng hoa (không bắt buộc)')).toBeFocused();
    await expect(page.getByLabel('Lời nhắn tặng hoa (không bắt buộc)')).toHaveValue(
      answer.suggestions[0].cardMessage,
    );
    await page.getByLabel('Lời nhắn tặng hoa (không bắt buộc)').fill('Lời nhắn do khách chỉnh sửa');
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
      path: `.impeccable/review/kiosk-advisor-${width}.png`,
      fullPage: true,
    });
    await page.getByRole('button', { name: 'Chọn Bó hồng dịu dàng' }).click();
    await expect(page.getByRole('checkbox')).toBeChecked();
    await expect(page.getByLabel('Lời nhắn tặng hoa (không bắt buộc)')).toHaveValue(
      'Lời nhắn do khách chỉnh sửa',
    );
    await expect(
      page.getByRole('status').filter({ hasText: 'Đã thêm Bó hồng dịu dàng' }),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'Đã chọn bó này' })).toBeDisabled();
    await page.getByRole('button', { name: 'Kết thúc lượt mua' }).click();
    await expect(page.getByRole('heading', { name: 'Một chút cảm hứng cho món quà' })).toHaveCount(
      0,
    );
  });

test('Retry reads an existing survey, and offline blocks selection', async ({ page, context }) => {
  let posts = 0;
  let reads = 0;
  await page.route('**/flows/ai_suggest', (route) => {
    posts++;
    return route.fulfill({ json: { result: survey } });
  });
  await page.route('**/surveys/*', (route) => {
    reads++;
    return reads === 1 ? route.fulfill({ status: 503, json: {} }) : route.fulfill({ json: answer });
  });
  await page.goto('/');
  await page.getByText('Cần một chút gợi ý để chọn hoa?', { exact: true }).click();
  await page.getByRole('button', { name: 'Tìm hoa phù hợp', exact: true }).click();
  await page.getByRole('button', { name: 'Tải lại gợi ý' }).click();
  await expect(page.getByRole('button', { name: 'Chọn Bó hồng dịu dàng' })).toBeEnabled();
  expect(posts).toBe(1);
  expect(reads).toBe(2);
  await context.setOffline(true);
  await expect(page.getByRole('button', { name: 'Chọn Bó hồng dịu dàng' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Tìm hoa phù hợp', exact: true })).toBeDisabled();
});

test('Empty, stale and failed suggestions keep answers and purchase authority', async ({
  page,
}) => {
  let mode = 'failed';
  await page.route('**/flows/ai_suggest', (route) =>
    mode === 'failed'
      ? route.fulfill({ status: 429, json: { detail: 'Bạn thử quá nhiều lần. Hãy chờ một phút.' } })
      : route.fulfill({
          json: { result: mode === 'empty' ? survey : '60000000-0000-4000-8000-000000000002' },
        }),
  );
  await page.route('**/surveys/*', (route) =>
    route.fulfill({
      json: {
        ...answer,
        suggestions:
          mode === 'empty'
            ? []
            : [{ ...answer.suggestions[0], bouquetId: '50000000-0000-0000-0000-000000000099' }],
      },
    }),
  );
  await page.goto('/');
  await page.getByText('Cần một chút gợi ý để chọn hoa?', { exact: true }).click();
  await page.getByLabel('Bạn muốn tặng ai?').selectOption('FRIEND');
  await page.getByRole('button', { name: 'Tìm hoa phù hợp', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Hãy chờ một phút');
  await expect(page.getByLabel('Bạn muốn tặng ai?')).toHaveValue('FRIEND');
  mode = 'empty';
  await page.getByRole('button', { name: 'Tìm hoa phù hợp', exact: true }).click();
  await expect(page.getByText('Chưa có bó hoa phù hợp lúc này.', { exact: false })).toBeVisible();
  mode = 'stale';
  await page.getByRole('button', { name: 'Tìm hoa phù hợp', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Chọn Bó hồng dịu dàng' })).toBeDisabled();
  await expect(page.getByText('Bó này hiện không còn sẵn sàng.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Giữ hoa và thanh toán' })).toBeDisabled();
});
