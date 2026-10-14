// Configuração dos testes automatizados do ACE GAMER AND COACH.
const { defineConfig } = require('@playwright/test');
module.exports = defineConfig({
  testDir: './tests',
  timeout: 60000,
  workers: 1,
  reporter: [['list']],
  use: {
    browserName: 'chromium',
    viewport: { width: 1600, height: 1000 },
    // permite usar um Chromium já instalado na máquina (opcional)
    launchOptions: process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}
  }
});
