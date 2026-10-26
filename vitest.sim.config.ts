import { defineConfig } from 'vitest/config';

// The battle simulator (npm run sim): headless battles in Node, outside the app's own tests.
export default defineConfig({
  test: {
    include: ['sim/**/*.sim.ts'],
    environment: 'node',
    disableConsoleIntercept: true,
  },
});
