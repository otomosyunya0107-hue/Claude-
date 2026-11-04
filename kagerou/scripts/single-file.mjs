// dist-single/ のビルド結果を 1 枚の HTML 断片（CSS/JS インライン）にまとめる。
// claude.ai Artifact など、外部ファイルを置けない環境での体験版用。
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
const dir = new URL('../dist-single/assets/', import.meta.url);
const files = readdirSync(dir);
// フォントは woff2 を data URI で埋め込み、woff の代替指定は落とす（外部ファイルを置けないため）
const css = files.filter((f) => f.endsWith('.css')).map((f) => readFileSync(new URL(f, dir), 'utf8')).join('\n')
  .replace(/,\s*url\(\.\/[^)]+\.woff\)\s*format\("woff"\)/g, '')
  .replace(/url\(\.\/([^)]+\.woff2)\)/g, (_, f) => `url(data:font/woff2;base64,${readFileSync(new URL(f, dir)).toString('base64')})`);
const js = files.filter((f) => f.endsWith('.js')).map((f) => readFileSync(new URL(f, dir), 'utf8')).join('\n')
  .replace(/<\/script/gi, '<\\/script');
const html = `<title>Kagerou カゲロウ</title>
<meta name="theme-color" content="#0B0C0E">
<style>${css}</style>
<div id="root"></div>
<script type="module">${js}</script>
`;
const out = new URL('../dist-single/kagerou.html', import.meta.url);
writeFileSync(out, html);
console.log(`wrote ${out.pathname} (${(html.length / 1024).toFixed(0)} KB)`);
