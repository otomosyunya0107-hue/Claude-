/** 40_Templates/ — reusable document templates (minutes / proposal / email). */

export const meetingMinutesTemplate = `# 議事録テンプレート

> 会議ごとにこのテンプレを複製して使う。Claude が穴埋めできる雛形。

- 日時：YYYY-MM-DD HH:MM
- 参加者：
- 関連顧客：[[10_Clients/_template]]

## アジェンダ
-

## 決定事項
-

## 宿題・ネクストアクション
- [ ] <内容> ／ 担当： ／ 期日：

## メモ
-
`;

export const proposalTemplate = `# 提案書テンプレート

- 宛先：
- 日付：YYYY-MM-DD
- 作成者：

## 背景・課題

## ご提案内容

## スコープ／進め方

## 費用

## スケジュール
`;

export const followupEmailTemplate = `# フォローアップメールテンプレート

件名：

<宛名> 様

<!-- 打ち合わせのお礼 → 決定事項の確認 → ネクストアクション の順で -->

本日はお時間をいただきありがとうございました。
本日の決定事項は以下のとおりです。

-

引き続きどうぞよろしくお願いいたします。
`;
