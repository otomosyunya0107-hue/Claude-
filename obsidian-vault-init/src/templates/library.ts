/** 30_Library/ — the "bookshelf" of company knowledge: index + 3 files. */

export const libraryIndexTemplate = `# 30_Library（考え方の本棚）

> 自社のフレームワーク・SOP・判断軸・価格表・FAQ を置く場所。
> Claude が「自社のやり方」を参照するための知識ベース。

- [[30_Library/frameworks]]：フレームワーク・SOP
- [[30_Library/pricing]]：価格表
- [[30_Library/faq]]：よくある質問
`;

export const libraryFrameworksTemplate = `# フレームワーク・SOP

> 自社の標準的な進め方・型を記述する。

## <フレームワーク名／SOP名>
<!-- 手順や判断軸を箇条書きで -->
-
`;

export const libraryPricingTemplate = `# 価格表

> 提案・見積の基準となる価格情報。

| サービス | 単価 | 備考 |
|---|---|---|
|  |  |  |
`;

export const libraryFaqTemplate = `# よくある質問

> 顧客・社内から繰り返し聞かれることと、その標準回答。

### Q.
A.
`;
