/** 50_Transcripts/_template.md — naming-convention guide for stored transcripts. */
export const transcriptTemplate = `# 文字起こし保管庫について

> 会議の文字起こしテキストを日付付きで積む場所。
> ファイル名の命名規則：\`YYYY-MM-DD_クライアント名_種別.md\`
> 例：2026-05-24_クライアントA_定例.md
>
> 議事録ツール（Notta / tl;dv 等）の出力をここに保存し、
> Claude に「該当する 10_Clients/ 配下のファイルに要約・決定事項・宿題を追記して」と依頼する運用を想定。
> （自動取り込みは将来拡張。MVP では手動保存でよい）
`;
