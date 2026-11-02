// 受け入れテスト（仕様書 §8）を実ブラウザで検証する。
// 使い方: npm run build && npm run e2e   （vite preview を内部で起動）
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';

const { chromium } = createRequire(import.meta.url)('playwright');
const PORT = 4179;
const APP_URL = `http://localhost:${PORT}/?debug=1`;
const OUT = new URL('../artifacts/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });

const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'pipe' });
server.stderr.on('data', (d) => process.stderr.write(d));
process.on('exit', () => server.kill('SIGKILL'));
await new Promise((res, rej) => {
  server.stdout.on('data', (d) => String(d).includes('localhost') && res());
  server.on('exit', (c) => rej(new Error(`vite preview exited (${c}) — ポート ${PORT} が使用中の可能性`)));
});

const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok }); console.log(`${ok ? '✅' : '❌'} ${name}${detail ? ` — ${detail}` : ''}`); };

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 420, height: 900 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));

const cardText = (loc) => loc.locator('p').first().evaluate((p) => p.textContent);
const dbNotes = () => page.evaluate(() => new Promise((res) => {
  const r = indexedDB.open('kagerou');
  r.onsuccess = () => { const tx = r.result.transaction('notes'); const q = tx.objectStore('notes').getAll(); q.onsuccess = () => { res(q.result); r.result.close(); }; };
}));
const travel = async (label) => { await page.getByRole('button', { name: label, exact: true }).click(); await page.waitForTimeout(400); };
const hold = async (btn, ms) => {
  const box = await btn.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(ms);
};

try {
  await page.goto(APP_URL);
  await page.waitForSelector('[data-status]');
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${OUT}01-onboarding.png`, fullPage: true });

  // オンボーディング
  const statuses = await page.locator('article[data-status]').evaluateAll((els) => els.map((e) => e.dataset.status).sort());
  check('初回起動で 3 件のチュートリアルが投入される', JSON.stringify(statuses) === JSON.stringify(['CRITICAL', 'TOMBSTONE', 'WEATHERING']), statuses.join(','));

  // 6. 石碑化（チュートリアル 4/5）
  const reachId = (await dbNotes()).find((n) => n.polishCount === 4 && n.isTutorial)?.id;
  const reach = page.locator(`article[data-note-id="${reachId}"]`);
  if ((await reach.count()) === 0) {
    check('石碑化リーチのノートが存在する', false, '既に墓標化している');
  } else {
    await hold(reach.getByRole('button', { name: /手入れする/ }), 1700);
    await page.mouse.up();
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `${OUT}04-monument.png`, fullPage: true });
    const stone = page.locator('article[data-status="MONUMENT"]');
    check('5回目の手入れで石碑（MONUMENT）に昇格する', (await stone.count()) === 1);
    await travel('+30日');
    await travel('+30日');
    await page.screenshot({ path: `${OUT}04b-monument-after-60d.png`, fullPage: true });
    const stoneText = await page.locator('article[data-status="MONUMENT"] p.engraved').textContent();
    const stoneDb = (await dbNotes()).find((n) => n.id === reachId);
    check('石碑は +60日進めても一切風化しない', stoneText.includes('5回手入れされた言葉だけは') && stoneDb.status === 'MONUMENT' && stoneDb.content !== null);
  }
  await page.getByRole('button', { name: 'リセット' }).click();
  await page.waitForTimeout(300);

  // 1. 作成・永続化
  const TEXT = 'きょうは雨がふっていたので、図書館でKagerouの設計を考えた。風化する言葉こそ大切にしたい。';
  await page.getByLabel('メモ本文').first().fill(TEXT);
  await page.getByRole('button', { name: '刻む' }).click();
  await page.waitForTimeout(500);
  await page.reload();
  await page.waitForSelector('[data-status]');
  const mine = page.locator('article[data-status]').filter({ hasText: '図書館' });
  check('新規メモを作成し、リロード後も IndexedDB から復元される', (await mine.count()) === 1 && (await cardText(mine)) === TEXT);
  const myId = (await dbNotes()).find((n) => n.content === TEXT)?.id;

  // 2. +15日でひらがな優先の風化
  await travel('+15日');
  const myCard = () => page.locator(`article[data-note-id="${myId}"]`);
  const analyze = () => myCard().locator('p').first().evaluate((p, text) => {
    const shown = p.textContent;
    const chars = Array.from(text);
    let hiraLost = 0, hira = 0, kanjiLost = 0, kanji = 0;
    Array.from(shown).forEach((c, i) => {
      const o = chars[i];
      const lost = c !== o;
      if (/[぀-ゟ]/.test(o)) { hira++; if (lost) hiraLost++; }
      else if (/[一-鿿]/.test(o)) { kanji++; if (lost) kanjiLost++; }
    });
    const blurred = p.querySelectorAll('[class*="blur-"]').length;
    return { shown, hiraRate: hiraLost / hira, kanjiRate: kanjiLost / kanji, blurred };
  }, TEXT);
  await travel('+7日'); // 合計 +22日（風化度 73%）
  const a = await analyze();
  await page.screenshot({ path: `${OUT}02-weathering-22d.png`, fullPage: true });
  check('時間経過でひらがなから優先的に欠落する', a.hiraRate > a.kanjiRate && a.hiraRate > 0, `ひらがな欠落率 ${(a.hiraRate * 100).toFixed(0)}% / 漢字 ${(a.kanjiRate * 100).toFixed(0)}% / 滲み・かすれ要素 ${a.blurred}`);

  // 3. リロードで虫食い位置が変わらない
  await page.reload();
  await page.waitForSelector('[data-status]');
  await page.waitForTimeout(300);
  const b = await analyze();
  check('リロードしても虫食い位置が変わらない（決定論的 PRNG）', a.shown === b.shown);

  // 4. コピーで元の文章が読めない
  const copied = await myCard().locator('p').first().evaluate((p) => {
    const sel = getSelection(); const r = document.createRange(); r.selectNodeContents(p); sel.removeAllRanges(); sel.addRange(r);
    let data = null;
    const on = (e) => { data = e.clipboardData ? null : null; };
    document.addEventListener('copy', on, { once: true });
    const s = sel.toString();
    sel.removeAllRanges();
    return s;
  });
  const leaked = Array.from(TEXT).filter((c, i) => b.shown[i] !== c && /\S/.test(c)).filter((c) => copied.includes(c) && !Array.from(b.shown).includes(c));
  check('欠落部分はコピーしても元の文字が得られない', !copied.includes(TEXT) && leaked.length === 0, `コピー結果: 「${copied.slice(0, 40)}…」`);

  // 5. 長押し中にリアルタイム復元、離すと元に戻る
  const btn = myCard().getByRole('button', { name: /手入れする/ });
  await hold(btn, 900);
  const during = await cardText(myCard());
  await page.screenshot({ path: `${OUT}03-holding.png` });
  await page.mouse.up();
  await page.waitForTimeout(250);
  const after = await cardText(myCard());
  const intact = (s) => Array.from(s).filter((c, i) => c === Array.from(TEXT)[i]).length;
  check('長押し中は文字が復元され、途中で離すと元に戻る', intact(during) > intact(b.shown) && after === b.shown, `復元文字数 ${intact(b.shown)} → ${intact(during)} → 離して ${intact(after)}`);

  // 長押し完了で手入れ（風化0%）
  await hold(btn, 1700);
  await page.mouse.up();
  await page.waitForTimeout(500);
  const polished = (await dbNotes()).find((n) => n.id === myId);
  check('長押し完了で風化がリセットされ、回数が加算される（22日放置後）', (await cardText(myCard())) === TEXT && polished.polishCount === 2, `polishCount=${polished.polishCount}`);

  // 連打チート: 直後の再手入れは数えない
  await hold(myCard().getByRole('button', { name: /手入れする/ }), 1700);
  await page.mouse.up();
  await page.waitForTimeout(500);
  check('直後の再手入れは回数に数えない（クールダウン）', (await dbNotes()).find((n) => n.id === myId).polishCount === 2);

  // 7. 30日で墓標化・本文 null
  await travel('+30日');
  await page.waitForTimeout(500);
  const all = await dbNotes();
  const mineNow = all.find((n) => n.id === myId);
  check('30日経過した通常ノートは本文が null の墓標になる（IndexedDB 上でも抹消）', mineNow.status === 'TOMBSTONE' && mineNow.content === null, `status=${mineNow.status}, content=${mineNow.content}`);
  const tombText = await page.locator('article[data-status="TOMBSTONE"]').first().textContent();
  check('墓標ログが表示される', /文字の思考は、30日の時を経て砂に還りました。/.test(tombText));
  await page.screenshot({ path: `${OUT}05-after-60d.png`, fullPage: true });

  // シェア画像
  await page.getByRole('button', { name: 'リセット' }).click();
  await page.getByLabel('メモ本文').first().fill('シェア画像の確認用に書いた、少し長めの言葉です。三十日の時の流れのなかで、ひらがなから順に砂になっていく。');
  await page.getByRole('button', { name: '刻む' }).click();
  await page.waitForTimeout(400);
  await travel('+15日');
  await travel('+7日');
  const shareId = (await dbNotes()).find((n) => n.content?.startsWith('シェア画像'))?.id;
  const card = page.locator(`article[data-note-id="${shareId}"]`);
  await card.getByRole('button', { name: 'メニュー' }).click();
  await page.getByRole('button', { name: '風化状態を画像で切り取る' }).click();
  const img = page.getByAltText('生成されたシェア画像のプレビュー');
  await img.waitFor();
  const dims = await img.evaluate((i) => new Promise((r) => (i.complete ? r([i.naturalWidth, i.naturalHeight]) : (i.onload = () => r([i.naturalWidth, i.naturalHeight])))));
  await page.screenshot({ path: `${OUT}06-share-modal.png` });
  const dataUrl = await img.evaluate(async (i) => { const b = await (await fetch(i.src)).blob(); return await new Promise((r) => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(b); }); });
  const { writeFileSync } = await import('node:fs');
  writeFileSync(`${OUT}07-share-square.png`, Buffer.from(dataUrl.split(',')[1], 'base64'));
  const oldSrc = await img.getAttribute('src');
  await page.getByRole('button', { name: /縦長/ }).click();
  await page.waitForFunction((o) => { const i = document.querySelector('img[alt="生成されたシェア画像のプレビュー"]'); return i && i.src !== o && i.complete && i.naturalHeight > 0; }, oldSrc);
  await page.screenshot({ path: `${OUT}06b-share-portrait.png` });
  const dims2 = await img.evaluate((i) => new Promise((r) => (i.complete && i.naturalHeight ? r([i.naturalWidth, i.naturalHeight]) : (i.onload = () => r([i.naturalWidth, i.naturalHeight])))));
  check('シェア画像を 1080×1080 / 1080×1350 で生成できる', dims.join('x') === '1080x1080' && dims2.join('x') === '1080x1350', `${dims.join('x')}, ${dims2.join('x')}`);

  check('コンソールエラーなし', errors.length === 0, errors.slice(0, 3).join(' | '));
} catch (e) {
  console.error(e);
  check('E2E 実行', false, String(e));
} finally {
  await browser.close();
}

const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} passed. スクリーンショット: ${OUT}`);
server.kill('SIGTERM');
process.exit(failed ? 1 : 0);
