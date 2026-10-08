import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/kiosk',
  outputDir: './test-results/kiosk',
  use: { baseURL: 'http://127.0.0.1:5174', trace: 'retain-on-failure' },
  webServer: {
    command: 'pnpm --filter @florabot/kiosk preview',
    url: 'http://127.0.0.1:5174',
    reuseExistingServer: false,
  },
});
