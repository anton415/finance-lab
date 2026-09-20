import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react()],
  test: {
    coverage: {
      reporter: ['text', 'json-summary', 'lcov'],
    },
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
  },
})
