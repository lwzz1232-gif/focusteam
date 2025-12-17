import { test, expect } from '@playwright/test';

test('login screen UI', async ({ page }) => {
  await page.goto('http://localhost:5173');

  // Wait for the splash screen to disappear
  await page.waitForSelector('text=Find a Partner', { timeout: 10000 });

  // On the landing page, click the "Find a Partner" button
  await page.click('text=Find a Partner');

  // Verify that the login form is visible
  await page.waitForSelector('text=Welcome Back', { timeout: 10000 });

  // Check for the email and password fields
  await expect(page.locator('input[type="email"]')).toBeVisible();
  await expect(page.locator('input[type="password"]')).toBeVisible();

  // Check for the login button
  await expect(page.locator('button:has-text("Login")')).toBeVisible();

  // Click the "Sign Up" link
  await page.click('text=Don\'t have an account? Sign Up');

  // Verify that the registration form is visible
  await page.waitForSelector('text=Create Account', { timeout: 10000 });

  // Check for the name, email, password, and confirm password fields
  await expect(page.locator('input[type="text"]')).toBeVisible();
  await expect(page.locator('input[type="email"]')).toBeVisible();
  await expect(page.locator('input[type="password"]').first()).toBeVisible();
  await expect(page.locator('input[type="password"]').last()).toBeVisible();

  // Check for the "Sign Up" button
  await expect(page.locator('button:has-text("Sign Up")')).toBeVisible();
});
