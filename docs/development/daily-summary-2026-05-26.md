# 日次まとめ 2026-05-26

## 今日やったこと

- プロジェクトの現状整理を実施
- 現在の優先順位と今後の方針を言語化
- スマホ横向きUIの一部調整
- 文書の整理と archive ルールづくり
- 試作用ブランチと preview 公開URLの用意

## 方針として整理できたこと

### 1. 現在の主作業

- いまの中心作業は新機能追加より `UI改善`
- 優先順は以下
  - スマホ横向き UI
  - PC / タブレット UI
  - その後に他プレイヤーによる通し確認

### 2. 全国版について

- `japan_all` は未着手ではなく、仮実装したが重すぎて現状外している
- `hokkaido_all` など地方全域版はプレイ可能
- INP の目安
  - `hokkaido_all`: 120ms 以下
  - `japan_all`: 900ms 台
- 将来全国版をやるなら順番は以下
  - 都道府県を当てるモード
  - 市区町村を当てるモード
  - 市外局番を当てるモード

### 3. 市外局番モードについて

- 3桁広域市外局番専用モードは採用しない方針
- 現在は 5桁側の通常モードを主役にする考え

### 4. 機能面の次候補

- まずサドンデスの仕様整理
  - 地図ありを選べてしまう状態を見直し
  - 地図なし固定へ寄せたい
- 次に画像モード
  - USA の州旗
  - 州道標識
  - ナンバープレート
  - 将来的にブラー版

### 5. データセット作成方針

- Codex / Claude Code / Gemini CLI など、どの AI で作っても同じ完成形へ持っていける形が理想

## UIまわりで今日やったこと

- 準備オーバーレイの `バー位置` で、スマホ横向き時に `上 / 下` を出さない方向を確認
- 影響範囲をスマホ横向きに限定するため、CSS のメディアクエリ条件を調整
- 調整内容
  - `orientation: landscape`
  - `max-height: 460px`
  - `max-width: 950px`

## 作成・更新した文書

### 新規作成

- `docs/overview-now-next-2026-05-26.html`
- `docs/project-status-2026-05-26.html`
- `docs/development/current-focus-audit-2026-05-26.md`
- `docs/planning/question-transition-spec.md`
- `docs/archive-candidates-2026-05-26.md`
- `docs/development/daily-summary-2026-05-26.md`

### 更新

- `README.md`
- `CHANGELOG.md`
- `css/style.css`

## docs 整理でやったこと

- `docs/archive/` を作成
- 古い変更メモ、review系、再検討向け旧計画資料を `docs/archive/` へ移動

### archive に移したもの

- `docs/archive/development/changes-2026-05-23.md`
- `docs/archive/development/changes-2026-05-24.md`
- `docs/archive/development/map-display-fix-2026-05-23.md`
- `docs/archive/reviews/gemini-review-request.md`
- `docs/archive/reviews/gemini-review-2026-05-19.md`
- `docs/archive/reviews/gemini-follow-2026-05-19.md`
- `docs/archive/planning/vectorgrid-migration-plan.md`
- `docs/archive/planning/tokyo-mvp-plan.md`

### 削除したもの

- `css/# GeoQuiz 今後の改善アイデアまとめ.txt`

## Git / 公開まわりでやったこと

### 作成したブランチ

- `codex/ui-landscape-check`

### 試作用ブランチ

- GitHub 上の確認先:
  - `https://github.com/sakrainari/geoquiz/tree/codex/ui-landscape-check`

### preview 公開URL

- 本番URL
  - `https://sakrainari.github.io/geoquiz/`
- 試作用URL
  - `https://sakrainari.github.io/geoquiz/preview/`

## 次にやるとよさそうなこと

1. `preview` URL でスマホ横向きUIを実機確認
2. 準備オーバーレイの見た目と押しやすさを再確認
3. 必要ならスマホ横向き UI をさらに微調整
4. その後 PC / タブレット UI へ進む
