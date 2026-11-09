import { expect, test } from '@playwright/test';

test('Direct 3D preview returns to setup without contacting devices', async ({ page }) => {
  const calls: string[] = [];
  await page.route('**/api/**', async (route) => {
    calls.push(route.request().url());
    await route.abort();
  });

  await page.goto('/?setup=1');
  await expect(
    page.getByRole('button', { name: 'Xem mẫu và danh mục website', exact: true }),
  ).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Xem giao diện mẫu', exact: true })).toHaveCount(0);
  await page.goto('/?preview=1');
  await expect(page.getByText('Tủ hoa mẫu · Không điều khiển tủ thật')).toBeVisible();
  await expect(page.getByText('Hoa Sài Gòn (Minh họa)')).toBeVisible();
  await page.getByRole('button', { name: 'Mua hoa tại chỗ', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Hoa đang đợi bạn', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Gợi ý chọn hoa' }).click();
  const advisor = page.getByRole('dialog', { name: 'Cần một chút gợi ý để chọn hoa?' });
  await advisor.getByRole('button', { name: 'Tìm hoa phù hợp' }).click();
  await advisor.getByRole('button', { name: 'Chọn Tulip vải pastel cao cấp' }).click();
  await advisor.getByRole('button', { name: 'Đóng gợi ý' }).click();
  await expect(page.getByRole('checkbox', { name: /Chọn Tulip vải pastel/ })).toBeChecked();
  await page.getByRole('button', { name: 'Thoát xem mẫu', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Kết nối tủ FloraBot', exact: true }),
  ).toBeVisible();
  expect(calls).toEqual([]);
});
