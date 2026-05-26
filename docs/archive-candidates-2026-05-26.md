# docs/archive 候補一覧 2026-05-26

このメモは、`docs/archive/` に移動してよさそうな文書の候補を整理するための一覧です。

まだ移動はしていません。
まずは「今も参照する中心資料」と「保管寄りの資料」を分けています。

## いま残したい資料

- `docs/overview-now-next-2026-05-26.html`
  - いまの全体像を一番わかりやすく説明する入口資料
- `docs/project-status-2026-05-26.html`
  - 現状確認の詳細版
- `docs/development/current-focus-audit-2026-05-26.md`
  - 現在の方針整理メモ
- `docs/development/adding-dataset.md`
  - データセット追加の共通手順
- `docs/development/adding-prefecture.md`
  - 都道府県データ追加の具体手順
- `docs/planning/question-transition-spec.md`
  - 直近のUI/演出検討メモ

## archive 候補

### 1. 引き継ぎ・日次メモ系

- `docs/development/handoff-2026-05-24-claude-code.md`
  - 特定日時の引き継ぎメモで、役目が限定的
- `docs/development/changes-2026-05-24.md`
  - 当日の変更メモ。履歴としては有用だが常設の主資料ではない
- `docs/development/changes-2026-05-23.md`
  - 当日の変更メモ。履歴としては有用だが常設の主資料ではない
- `docs/development/map-display-fix-2026-05-23.md`
  - 特定不具合対応の記録で、常に前面に置く必要は薄い

### 2. AIレビュー履歴系

- `docs/reviews/gemini-review-request.md`
  - レビュー依頼文。参照頻度は低そう
- `docs/reviews/gemini-review-2026-05-19.md`
  - 過去レビュー結果の保管向け
- `docs/reviews/gemini-follow-2026-05-19.md`
  - 過去レビュー追跡の保管向け

### 3. 将来再検討向けの計画資料

- `docs/vectorgrid-migration-plan.md`
  - `japan_all` 前提の色が強く、現状の優先順位とは少しずれている
- `docs/development/tokyo-mvp-plan.md`
  - プロジェクト初期寄りの計画に見えるため、現行方針の前面資料ではなさそう

## いったん保留にしたい資料

- `docs/planning/start-flow-spec.md`
- `docs/planning/end-flow-spec.md`
- `docs/planning/analysis-screen-spec.md`
- `docs/planning/improvement-roadmap.md`
- `docs/planning/product-proposal.md`
- `docs/planning/font-role-spec.md`

これらは古い可能性もありますが、UI改善や画面整理の参考としてまだ使う余地があります。
すぐ archive へ入れるより、現行画面との整合性を一度見てから判断するのが安全です。

## 最初の移動候補として無難な範囲

まずは次のものから `docs/archive/` に移すのが無難です。

- `docs/development/handoff-2026-05-24-claude-code.md`
- `docs/development/changes-2026-05-24.md`
- `docs/development/changes-2026-05-23.md`
- `docs/development/map-display-fix-2026-05-23.md`
- `docs/reviews/gemini-review-request.md`
- `docs/reviews/gemini-review-2026-05-19.md`
- `docs/reviews/gemini-follow-2026-05-19.md`

## 次の一手

1. `docs/archive/` フォルダを作る
2. 上の「最初の移動候補」を先に移す
3. `vectorgrid-migration-plan.md` と `tokyo-mvp-plan.md` はあとで再判定する

## 実施メモ

- 2026-05-26: `changes-*`、`map-display-fix-*`、`reviews/*` を `docs/archive/` へ移動
- 2026-05-26: `vectorgrid-migration-plan.md` と `tokyo-mvp-plan.md` も誤解防止のため `docs/archive/` へ移動
- 2026-05-26: `css/# GeoQuiz 今後の改善アイデアまとめ.txt` は不要と判断して削除
