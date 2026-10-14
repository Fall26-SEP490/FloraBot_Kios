import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('Kiosk Tablet UI and Preview Mode Isolation', () => {
  test.beforeEach(async ({ page }) => {
    // Clear device session so we start on the Setup screen by default
    await page.addInitScript(() => {
      sessionStorage.removeItem('florabot-device');
    });
  });

  test('Setup screen displays branded two-column layout with staff-only notice and preview CTA', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1024, height: 768 });
    await page.goto('/');

    // Verify branded welcome column
    await expect(
      page.getByRole('heading', { name: 'Hệ thống Tủ Hoa Thông Minh FloraBot' }),
    ).toBeVisible();
    await expect(page.getByText('100% Hoa nhân tạo cao cấp')).toBeVisible();

    // Verify staff-only badge and setup form
    await expect(page.getByText('Dành riêng cho nhân viên kỹ thuật')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Kết nối tủ FloraBot' })).toBeVisible();
    await expect(page.getByLabel('Mã kiosk')).toBeVisible();
    await expect(page.getByLabel('Khóa thiết bị')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Kết nối tủ' })).toBeVisible();

    // Verify preview button
    const previewBtn = page.getByRole('button', { name: 'Xem giao diện mẫu' });
    await expect(previewBtn).toBeVisible();

    // Verify touch target >= 44px
    const btnBox = await previewBtn.boundingBox();
    expect(btnBox).not.toBeNull();
    expect(btnBox!.height).toBeGreaterThanOrEqual(44);
    expect(btnBox!.width).toBeGreaterThanOrEqual(44);

    // Axe accessibility
    const axe = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(axe.violations).toEqual([]);

    // No overflow
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );

    await page.screenshot({
      path: '.impeccable/review/kiosk-setup-1024.png',
      fullPage: true,
    });
  });

  test('Preview mode runs with complete network isolation (0 API calls), persistent banner, and clean exit', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1024, height: 768 });

    let apiCallCount = 0;
    // Monitor and intercept any API or payOS calls
    await page.route('**/api/**', (route) => {
      apiCallCount++;
      return route.abort();
    });
    await page.route('**/*payos*/**', (route) => {
      apiCallCount++;
      return route.abort();
    });

    await page.goto('/');

    // Click preview button
    await page.getByRole('button', { name: 'Xem giao diện mẫu' }).click();

    // Verify persistent ribbon
    await expect(page.getByText('DỮ LIỆU MINH HỌA')).toBeVisible();
    await expect(page.getByText(/Không thanh toán thật, không mở khóa tủ thật/)).toBeVisible();

    // Verify invariant: One seller leases whole kiosk (shared shop name)
    const shopPills = page.locator('.card-shop');
    const count = await shopPills.count();
    expect(count).toBe(4);
    for (let i = 0; i < count; i++) {
      await expect(shopPills.nth(i)).toContainText('Hoa Sài Gòn (Minh họa)');
    }

    // Verify all 4 demo bouquets are displayed with artificial flower labels and slot codes
    await expect(page.getByText('Bó hồng lụa dịu dàng')).toBeVisible();
    await expect(page.getByText('Tulip vải pastel cao cấp')).toBeVisible();
    await expect(page.getByText('Hướng dương lụa rực rỡ')).toBeVisible();
    await expect(page.getByText('Bó hồng lụa mini để bàn')).toBeVisible();

    // Verify illustration notices
    const notices = page.locator('.card-illustration-notice');
    expect(await notices.count()).toBe(4);

    // Verify slot codes A01, A02, B01, B02
    await expect(page.getByText('Ô A01', { exact: true })).toBeVisible();
    await expect(page.getByText('Ô A02', { exact: true })).toBeVisible();
    await expect(page.getByText('Ô B01', { exact: true })).toBeVisible();
    await expect(page.getByText('Ô B02', { exact: true })).toBeVisible();

    // Test selection and simulated checkout
    const firstCheckbox = page.getByLabel('Chọn Bó hồng lụa dịu dàng tại ô A01');
    await firstCheckbox.check();

    const checkoutBtn = page.getByRole('button', { name: /Thử nghiệm đặt hoa/ });
    await expect(checkoutBtn).toBeEnabled();
    await checkoutBtn.click();

    // Verify simulated checkout view
    await expect(
      page.getByRole('heading', { name: 'Mô phỏng quy trình thanh toán' }),
    ).toBeVisible();
    await expect(page.getByText('MÔ PHỎNG: DỮ LIỆU MINH HỌA')).toBeVisible();
    await expect(page.getByText('MÃ MINH HỌA - KHÔNG QUÉT THANH TOÁN')).toBeVisible();

    // Click simulate payment success
    await page
      .getByRole('button', { name: 'Mô phỏng thanh toán thành công (Thử nghiệm giao diện)' })
      .click();
    await expect(page.getByText('✓ MÔ PHỎNG: THANH TOÁN THÀNH CÔNG')).toBeVisible();
    await expect(page.getByText(/TỦ THẬT KHÔNG MỞ CHỐT KHÓA/)).toBeVisible();

    // Finish checkout preview
    await page.getByRole('button', { name: 'Hoàn tất lượt xem mẫu' }).click();

    // Switch to Pre-order Pickup tab
    await page.getByRole('tab', { name: /Nhận đơn đặt trước/ }).click();
    await expect(
      page.getByRole('heading', { name: 'Nhận đơn đặt trước tại tủ (Mô phỏng)' }),
    ).toBeVisible();
    await expect(page.getByText('Camera trên kiosk không tự động kích hoạt')).toBeVisible();

    // Use quick demo pin chip
    await page.getByRole('button', { name: 'PRE26101 (Hồng lụa + thiệp)' }).click();
    await page.getByRole('button', { name: 'Kiểm tra mã đơn' }).click();

    // Verify simulated pickup outcome
    await expect(page.locator('.pickup-result-card')).toBeVisible();
    await expect(page.getByText('FB-PREORDER-26101')).toBeVisible();
    await expect(page.getByText('Ô PRE-01')).toBeVisible();
    await page.getByRole('button', { name: 'Mô phỏng mở ô nhận hoa' }).click();
    await expect(
      page.getByText('MÔ PHỎNG: Lệnh mở ô tủ PRE-01 đã hoàn tất trên giao diện.'),
    ).toBeVisible();

    // Test Exit Preview Mode returns to Setup
    await page.getByRole('button', { name: 'Thoát xem mẫu' }).click();
    await expect(page.getByRole('heading', { name: 'Kết nối tủ FloraBot' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Xem giao diện mẫu' })).toBeVisible();

    // CRITICAL: Assert zero network API calls were made during the entire preview!
    expect(apiCallCount).toBe(0);
  });

  for (const [name, width, height] of [
    ['Tablet Portrait 768x1024', 768, 1024],
    ['Tablet Landscape 1024x768', 1024, 768],
    ['Tablet Widescreen 1280x800', 1280, 800],
  ] as const) {
    test(`Tablet layout responsiveness, touch targets, and above-the-fold visibility at ${name}`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height });
      await page.goto('/');

      // Launch Preview
      await page.getByRole('button', { name: 'Xem giao diện mẫu' }).click();
      await expect(page.getByText('DỮ LIỆU MINH HỌA')).toBeVisible();
      await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
      await expect(page.getByRole('button', { name: 'Thoát xem mẫu' })).toBeInViewport();

      // Check no horizontal overflow
      const noOverflow = await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      );
      expect(noOverflow).toBe(true);

      // Verify touch targets >= 44px
      const tabBtn = page.getByRole('tab', { name: /Mua hoa tại chỗ/ });
      const tabBox = await tabBtn.boundingBox();
      expect(tabBox).not.toBeNull();
      expect(tabBox!.height).toBeGreaterThanOrEqual(44);
      expect(tabBox!.width).toBeGreaterThanOrEqual(44);

      const exitBtn = page.getByRole('button', { name: 'Thoát xem mẫu' });
      const exitBox = await exitBtn.boundingBox();
      expect(exitBox).not.toBeNull();
      expect(exitBox!.height).toBeGreaterThanOrEqual(44);
      expect(exitBox!.width).toBeGreaterThanOrEqual(44);

      // BOUNDING BOX REGRESSION: At 1024x768 landscape, first row card name, price, and select control
      // MUST be completely visible within the 768px viewport without scrolling
      if (width === 1024 && height === 768) {
        const firstCard = page.locator('.preview-bouquet-card').first();
        const cardTitle = firstCard.locator('.card-title');
        const cardPrice = firstCard.locator('.card-price');
        const cardSelect = firstCard.locator('input[type="checkbox"]');

        const titleBox = await cardTitle.boundingBox();
        const priceBox = await cardPrice.boundingBox();
        const selectBox = await cardSelect.boundingBox();

        expect(titleBox).not.toBeNull();
        expect(priceBox).not.toBeNull();
        expect(selectBox).not.toBeNull();

        // Must be visible above the 768px fold without scrolling
        expect(titleBox!.y).toBeGreaterThanOrEqual(0);
        expect(priceBox!.y).toBeGreaterThanOrEqual(0);
        expect(selectBox!.y).toBeGreaterThanOrEqual(0);
        expect(titleBox!.y + titleBox!.height).toBeLessThanOrEqual(768);
        expect(priceBox!.y + priceBox!.height).toBeLessThanOrEqual(768);
        expect(selectBox!.y + selectBox!.height).toBeLessThanOrEqual(768);
      }

      // Axe accessibility check
      const axe = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
        .analyze();
      expect(axe.violations).toEqual([]);

      // Screenshot above the fold
      await page.screenshot({
        path: `.impeccable/review/kiosk-preview-${width}.png`,
      });

      // Also verify checkout and pickup screenshots at 1024
      if (width === 1024) {
        await page.getByLabel('Chọn Bó hồng lụa dịu dàng tại ô A01').check();
        await page.getByRole('button', { name: /Thử nghiệm đặt hoa/ }).click();
        await expect(
          page.getByRole('heading', { name: 'Mô phỏng quy trình thanh toán' }),
        ).toBeVisible();

        await page.screenshot({
          path: '.impeccable/review/kiosk-preview-checkout-1024.png',
        });

        // Switch to pickup and capture screenshot
        await page.getByRole('button', { name: 'Quay lại chọn hoa' }).click();
        await page.getByRole('tab', { name: /Nhận đơn đặt trước/ }).click();
        await page.getByRole('button', { name: 'PRE26101 (Hồng lụa + thiệp)' }).click();
        await page.getByRole('button', { name: 'Kiểm tra mã đơn' }).click();

        await page.screenshot({
          path: '.impeccable/review/kiosk-preview-pickup-1024.png',
        });
      }
    });
  }

  test('Real provisioned mode connects via API and never falls back to mock on API error', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1024, height: 768 });

    // Mock API failure on device connection
    await page.route('**/catalog/items', (route) => {
      return route.fulfill({
        status: 503,
        json: { detail: 'Hệ thống tủ đang bảo trì, vui lòng thử lại sau.' },
      });
    });

    await page.goto('/');
    await page.getByLabel('Mã kiosk').fill('40000000-0000-0000-0000-000000000001');
    await page.getByLabel('Khóa thiết bị').fill('secret-kiosk-key');
    await page.getByRole('button', { name: 'Kết nối tủ' }).click();

    // Verify that it shows the genuine error and does NOT fallback to mock
    await expect(page.getByRole('alert')).toContainText('Hệ thống tủ đang bảo trì');
    // Ensure we are STILL on the setup page with real controls, not in mock preview
    await expect(page.getByRole('heading', { name: 'Kết nối tủ FloraBot' })).toBeVisible();
    await expect(page.locator('.preview-ribbon')).toHaveCount(0);
  });

  test('Setup error 401 returns actionable help distinguishing display code from secret API key and never leaks credential', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1024, height: 768 });

    // Mock API 401 response with generic problem title and sensitive backend detail
    await page.route('**/catalog/items', (route) => {
      return route.fulfill({
        status: 401,
        json: {
          title: 'Unauthorized',
          status: 401,
          detail: 'Invalid credential provided for K-DEMO-SIM: internal-raw-secret-key',
        },
      });
    });

    await page.goto('/');
    // Staff enters UUID and accidentally uses display code K-DEMO-SIM as key
    await page.getByLabel('Mã kiosk').fill('40000000-0000-0000-0000-000000000001');
    await page.getByLabel('Khóa thiết bị').fill('K-DEMO-SIM');
    await page.getByRole('button', { name: 'Kết nối tủ' }).click();

    // Verify actionable local-safe 401 error message
    const alert = page.getByRole('alert');
    await expect(alert).toBeVisible();
    await expect(alert).toContainText('Mã kiosk (UUID) hoặc khóa thiết bị (API key) chưa chính xác');
    await expect(alert).toContainText('K-DEMO-SIM chỉ là nhãn tủ, không phải khóa bí mật');

    // CRITICAL: Ensure raw backend detail containing internal secret/credential is NEVER echoed in alert
    await expect(alert).not.toContainText('internal-raw-secret-key');

    // Ensure we remain safely on Setup screen without fallback to mock
    await expect(page.getByRole('heading', { name: 'Kết nối tủ FloraBot' })).toBeVisible();
    await expect(page.locator('.preview-ribbon')).toHaveCount(0);
  });

  test('Setup handles network failure with distinct connection error message', async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 768 });

    // Mock network failure
    await page.route('**/catalog/items', (route) => route.abort('failed'));

    await page.goto('/');
    await page.getByLabel('Mã kiosk').fill('40000000-0000-0000-0000-000000000001');
    await page.getByLabel('Khóa thiết bị').fill('secret-kiosk-key');
    await page.getByRole('button', { name: 'Kết nối tủ' }).click();

    // Verify distinct network error message
    const alert = page.getByRole('alert');
    await expect(alert).toBeVisible();
    await expect(alert).toContainText('Không thể kết nối đến máy chủ. Vui lòng kiểm tra đường truyền mạng');

    // Remains on setup screen
    await expect(page.getByRole('heading', { name: 'Kết nối tủ FloraBot' })).toBeVisible();
    await expect(page.locator('.preview-ribbon')).toHaveCount(0);
  });

  test('Setup handles rate limit 429 with distinct rate limit message', async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 768 });

    // Mock 429 Too Many Requests
    await page.route('**/catalog/items', (route) => {
      return route.fulfill({
        status: 429,
        json: { title: 'Too Many Requests', status: 429 },
      });
    });

    await page.goto('/');
    await page.getByLabel('Mã kiosk').fill('40000000-0000-0000-0000-000000000001');
    await page.getByLabel('Khóa thiết bị').fill('secret-kiosk-key');
    await page.getByRole('button', { name: 'Kết nối tủ' }).click();

    // Verify distinct 429 message
    const alert = page.getByRole('alert');
    await expect(alert).toBeVisible();
    await expect(alert).toContainText('429');
    await expect(alert).toContainText('giới hạn số lần kết nối');

    // Remains on setup screen
    await expect(page.getByRole('heading', { name: 'Kết nối tủ FloraBot' })).toBeVisible();
    await expect(page.locator('.preview-ribbon')).toHaveCount(0);
  });

  test('Setup trims accidental surrounding whitespace from UUID and secret key before API request and session save', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1024, height: 768 });

    let requestedUrl = '';
    let sentKeyHeader = '';

    await page.route('**/catalog/items', (route) => {
      requestedUrl = route.request().url();
      sentKeyHeader = route.request().headers()['x-kiosk-key'] || '';
      return route.fulfill({ json: [] });
    });

    await page.goto('/');
    // Enter UUID and key with leading and trailing whitespace
    await page.getByLabel('Mã kiosk').fill('   40000000-0000-0000-0000-000000000001   ');
    await page.getByLabel('Khóa thiết bị').fill('   trimmed-api-key-12345   ');
    await page.getByRole('button', { name: 'Kết nối tủ' }).click();

    // Verify that the API was called with trimmed values
    await expect.poll(() => requestedUrl).toContain('/api/kiosks/40000000-0000-0000-0000-000000000001/catalog/items');
    expect(requestedUrl).not.toContain('%20');
    expect(sentKeyHeader).toBe('trimmed-api-key-12345');

    // Verify sessionStorage has trimmed values without spaces
    const saved = await page.evaluate(() => sessionStorage.getItem('florabot-device'));
    expect(saved).not.toBeNull();
    const parsed = JSON.parse(saved!);
    expect(parsed.id).toBe('40000000-0000-0000-0000-000000000001');
    expect(parsed.key).toBe('trimmed-api-key-12345');

    // Real mode entered
    await expect(page.getByRole('heading', { name: 'Một bó hoa, một ngày vui.' })).toBeVisible();
  });

  test('Setup with successful real API empty catalogue saves device session and enters real shopping mode with truthful no-inventory status', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1024, height: 768 });

    await page.route('**/catalog/items', (route) => {
      expect(route.request().headers()['x-kiosk-key']).toBe('valid-secret-kiosk-key');
      return route.fulfill({ json: [] });
    });

    await page.goto('/');
    await page.getByLabel('Mã kiosk').fill('40000000-0000-0000-0000-000000000001');
    await page.getByLabel('Khóa thiết bị').fill('valid-secret-kiosk-key');
    await page.getByRole('button', { name: 'Kết nối tủ' }).click();

    // Verify sessionStorage was populated
    const saved = await page.evaluate(() => sessionStorage.getItem('florabot-device'));
    expect(saved).not.toBeNull();

    // Real mode is active
    await expect(page.getByRole('heading', { name: 'Một bó hoa, một ngày vui.' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Kết thúc lượt mua' })).toBeVisible();

    // Truthful no-inventory message is displayed
    await expect(page.getByText('Tủ chưa có hoa sẵn sàng. Bạn ghé lại sau nhé.')).toBeVisible();

    // No fake mock preview ribbon
    await expect(page.locator('.preview-ribbon')).toHaveCount(0);

    // Buy button is disabled because there are no flowers in the catalogue
    await expect(page.getByRole('button', { name: 'Giữ hoa và thanh toán' })).toBeDisabled();
  });

  test('BouquetImage gracefully displays inline SVG fallback on error and recovers when src changes', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1024, height: 768 });

    // Provide a provisioned device session
    await page.addInitScript(() => {
      sessionStorage.setItem(
        'florabot-device',
        JSON.stringify({ id: '40000000-0000-0000-0000-000000000001', key: 'test-device-key' }),
      );
    });

    let returnBadImage = true;
    // Intercept image request
    await page.route('**/images/demo-*.png', (route) => {
      if (returnBadImage) {
        return route.abort();
      }
      return route.continue();
    });

    await page.route('**/catalog/items', (route) => {
      return route.fulfill({
        json: [
          {
            bouquetId: 'b1',
            name: returnBadImage ? 'Hoa hỏng ảnh mẫu' : 'Bó hồng lụa dịu dàng',
            price: 350000,
            slotCode: 'A01',
            shopName: 'Hoa Sài Gòn',
          },
        ],
      });
    });

    await page.goto('/');

    // Initially with aborted image request, SVG fallback is shown in flowers list
    await expect(page.locator('.flowers .flower-svg-fallback')).toBeVisible();

    // Now update catalog so bouquet gets a new valid src and refetch
    returnBadImage = false;
    await page.evaluate(() => window.dispatchEvent(new Event('online')));

    // Re-navigating or updating with working route displays img
    await page.goto('/');
    await expect(page.locator('.flower-thumb-image')).toBeVisible();
  });
});
