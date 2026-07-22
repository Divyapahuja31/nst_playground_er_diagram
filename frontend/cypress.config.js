import { defineConfig } from 'cypress';

export default defineConfig({
  e2e: {
    baseUrl: 'http://localhost:5173',
    supportFile: false,
    viewportWidth: 1280,
    viewportHeight: 720,
    defaultCommandTimeout: 8000,
  },

  component: {
    devServer: {
      framework: 'react',
      bundler: 'vite',
    },
    indexHtmlFile: 'cypress/support/component-index.html',
    supportFile: 'cypress/support/component.jsx',
    specPattern: 'cypress/component/**/*.cy.{js,jsx,ts,tsx}',
  },
});
