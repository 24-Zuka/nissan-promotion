import { expect, test } from '@playwright/test';

function todayInTokyoForDateInput(): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

test('static CRM flow persists data, supports undo, backup and restore', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle('My Dealer CRM');

  for (const key of ['1', '2', '0', '6']) {
    await page.getByRole('button', { name: key, exact: true }).click();
  }
  await page.getByRole('button', { name: 'ログイン', exact: true }).click();
  await expect(page.getByRole('heading', { name: '今日のフォロー' })).toBeVisible();

  await page.getByRole('link', { name: '顧客', exact: true }).click();
  await page.getByRole('button', { name: '新規顧客' }).click();
  await page.getByLabel('氏名*').fill('E2E テスト顧客');
  await page.getByRole('button', { name: '登録', exact: true }).click();
  await page.getByRole('link', { name: /E2E テスト顧客/ }).click();

  await page.getByRole('button', { name: '車両追加' }).click();
  await page.getByLabel('車名*').fill('セレナ e-POWER');
  await page.getByLabel('納車日').fill(todayInTokyoForDateInput());
  await page.getByRole('button', { name: '登録', exact: true }).click();
  await expect(page.getByText('セレナ e-POWER', { exact: false })).toBeVisible();

  await page.goto('/');
  const laterToggle = page.getByRole('button', { name: /それ以降/ });
  await expect(laterToggle).toBeVisible();
  await laterToggle.click();
  const completeButtons = page.getByRole('button', { name: '完了にする' });
  await expect(completeButtons.first()).toBeVisible();
  const before = await completeButtons.count();
  expect(before).toBeGreaterThan(0);
  await completeButtons.first().click();
  await expect(page.getByText('タスクを完了しました。')).toBeVisible();
  await page.getByRole('button', { name: '元に戻す' }).click();
  await expect(completeButtons).toHaveCount(before);

  await page.reload();
  await expect(page.getByRole('heading', { name: '今日のフォロー' })).toBeVisible();

  await page.getByRole('link', { name: '設定', exact: true }).click();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'JSONを保存' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^my-dealer-crm-backup-.*\.json$/);
  const backupPath = await download.path();
  expect(backupPath).not.toBeNull();

  await page.locator('input[type="file"]').setInputFiles(backupPath!);
  await expect(page.getByRole('dialog', { name: 'バックアップを復元' })).toBeVisible();
  await page.getByRole('button', { name: '復元する' }).click();
  await expect(page.getByText(/件のデータを復元しました/)).toBeVisible();

  await page.getByRole('link', { name: '顧客', exact: true }).click();
  await expect(page.getByRole('link', { name: /E2E テスト顧客/ })).toBeVisible();
});
