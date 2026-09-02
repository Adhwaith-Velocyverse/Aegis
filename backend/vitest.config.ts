import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.spec.ts', 'src/reporting/**/*.test.ts', 'src/reporting/**/*.spec.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/services/emailSecurity*.ts'],
    },
  },
});
