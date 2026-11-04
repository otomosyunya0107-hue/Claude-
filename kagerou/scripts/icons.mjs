// public/icon.svg から PNG（Web 用 192/512、ネイティブ用 1024 の元画像）を生成する
import { createRequire } from 'node:module';
import { readFileSync, mkdirSync } from 'node:fs';
// Playwright は環境にプリインストールされたものを CJS 解決で使う（package.json には含めない）
const { chromium } = createRequire(import.meta.url)('playwright');
const svg = readFileSync(new URL('../public/icon.svg', import.meta.url), 'utf8');
mkdirSync(new URL('../assets/', import.meta.url), { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage();
const shot = async (size, path) => {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<style>html,body{margin:0}</style>${svg.replace('<svg ', `<svg width="${size}" height="${size}" `)}`);
  await page.screenshot({ path: new URL(path, import.meta.url).pathname });
};
await shot(192, '../public/icon-192.png');
await shot(512, '../public/icon-512.png');
await shot(1024, '../assets/icon.png');
// スプラッシュは無地の墨（2732 角）
await page.setViewportSize({ width: 2732, height: 2732 });
await page.setContent('<style>html,body{margin:0;background:#151311}</style>');
await page.screenshot({ path: new URL('../assets/splash.png', import.meta.url).pathname });
await page.screenshot({ path: new URL('../assets/splash-dark.png', import.meta.url).pathname });
await browser.close();
