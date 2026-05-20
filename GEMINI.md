# Gemini CLI 作業指示

このフォルダは `G:\geoquiz-main\geoquiz-main` です。Gemini CLI は、このフォルダ内だけで作業してください。

## 最重要ルール

- GitHub へ push しない。
- GitHub Pages / `gh-pages` へ upload しない。
- `git push`、`git pull`、`git reset --hard`、`git checkout --`、`git clean` は実行しない。
- GitHub Desktop の操作を前提にしない。
- このフォルダ外のファイルを編集しない。
- 画像クイズ本体はロードマップのPhase通りに扱い、勝手に前倒し実装しない。
- デザインは現行UIを維持する。見た目の大幅変更はしない。

## Gemini の役割

Gemini は、Codex の利用可能量制限を補うための実装・調査担当です。
ただし、公開作業と最終反映は Codex / ユーザー側で行います。

Gemini が行ってよいこと:

- `G:\geoquiz-main\geoquiz-main` 内のコード調査
- バグ修正案の作成
- 小さく分離された実装
- README / docs の下書き更新
- データ構造の検証
- ローカルで完結するテストや静的確認

Gemini が行ってはいけないこと:

- GitHubへのpush
- GitHub Pages公開ブランチへの反映
- 外部サービスへのupload
- 大規模なUI刷新
- React / Vue / Vite / Webpack などへの移行
- npm必須構成への変更
- 画像素材を権利確認なしで追加すること

## 作業方針

このアプリは、GeoGuessr向け地域認識トレーニングツールです。
現時点の優先は、ロードマップに沿って段階的に進めることです。

現在の重要方針:

- Phaseは勝手に進めない。進める場合はREADMEに進捗を残す。
- 市区町村 / 市外局番モードの安定性を優先する。
- 複数県・全国対応では、同名地域対策として「問題文 + 参照ポリゴン」の出題UIを検討する。
- 画像クイズはPhase 6以降。国内画像クイズは将来的にマンホールを候補とし、自治体・関連団体への利用申請後に扱う。

## 作業後の報告形式

作業後は、以下を `GEMINI_REPORT.md` またはチャット出力にまとめてください。

- 何を変更したか
- 変更したファイル一覧
- 実行した確認コマンド
- 未確認・不安な点
- GitHubにはpushしていないことの確認

例:

```md
## Gemini 作業報告

### 変更内容
- ...

### 変更ファイル
- js/example.js
- README.md

### 確認
- node --check ... OK

### 注意点
- ...

### 公開作業
- GitHub push: 未実施
- gh-pages upload: 未実施
```
