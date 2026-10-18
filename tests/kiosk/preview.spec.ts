import { expect, test } from '@playwright/test';

test('Tablet setup only exposes the isolated 3D preview and returns without contacting devices', async ({
  page,
}) => {
  const calls: string[] = [];
  await page.route('**/api/**', async (route) => {
    calls.push(route.request().url());
    await route.abort();
  });

  await page.goto('/?setup=1');
  await expect(
    page.getByRole('button', { name: 'Xem mẫu và danh mục website', exact: true }),
  ).toHaveCount(0);
  await page.getByRole('button', { name: 'Xem giao diện mẫu', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Tủ hoa thông minh FloraBot', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Thoát xem mẫu', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Kết nối tủ FloraBot', exact: true }),
  ).toBeVisible();
  expect(calls).toEqual([]);
});
