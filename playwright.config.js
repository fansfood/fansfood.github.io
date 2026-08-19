const { defineConfig } = require('@playwright/test');
module.exports = defineConfig({
  testDir:'./tests',
  timeout:45000,
  retries:1,
  reporter:[['line'],['html',{outputFolder:'playwright-report',open:'never'}]],
  use:{baseURL:'http://127.0.0.1:4173',browserName:'chromium',trace:'retain-on-failure',screenshot:'only-on-failure'}
});
