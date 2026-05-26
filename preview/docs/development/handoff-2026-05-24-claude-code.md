# Claude Code 引き継ぎメモ 2026-05-24

## 今回の到達点

- 関東広域データを追加
  - `kanto_all`
- 北海道4分割と全域を追加
  - `hokkaido_doo`
  - `hokkaido_donan`
  - `hokkaido_dohoku`
  - `hokkaido_doto`
  - `hokkaido_all`
- 四国4県と全域を追加
  - `kagawa`
  - `tokushima`
  - `ehime`
  - `kochi`
  - `shikoku_all`
- 中国5県と全域を追加
  - `tottori`
  - `shimane`
  - `okayama`
  - `hiroshima`
  - `yamaguchi`
  - `chugoku_all`
- 九州7県と全域を追加
  - `fukuoka`
  - `saga`
  - `nagasaki`
  - `kumamoto`
  - `oita`
  - `miyazaki`
  - `kagoshima`
  - `kyushu_all`

## UI / ロジック変更

- `イージー` モードを追加
  - 開始前のみ選択可
  - ゲーム中は `ノーマル / サドンデス / イージー` を切り替え不可
- 市外局番モードで地名を薄く常時表示
- 市外局番 `イージー` では市外局番ラベルも最初から表示
- 市外局番モードの `一発正解` 集計を自治体単位ではなく設問単位へ修正
- `ma-union.js` 側で union 由来の極小スリバーを除去

## データ生成方針

- 県別ビルダーは `geolonia/japanese-admins` を取得元に使用
- 生成時の簡略化は `mapshaper` ベース
- `label-overrides.js` と `speech-readings.js` は県ごとに分離
- 市外局番は `data/area-code-master.js` を優先して参照
- MA 名は NTT 東日本 / 西日本の県別資料で補正

## 九州の実装メモ

- 新規追加
  - `tools/lib/kyushu-source.mjs`
  - `tools/lib/build-kyushu-dataset.mjs`
  - `tools/build-fukuoka-data.mjs`
  - `tools/build-saga-data.mjs`
  - `tools/build-nagasaki-data.mjs`
  - `tools/build-kumamoto-data.mjs`
  - `tools/build-oita-data.mjs`
  - `tools/build-miyazaki-data.mjs`
  - `tools/build-kagoshima-data.mjs`
  - `tools/build-kyushu-all-data.mjs`
- `kyushu_all` は県別生成後にさらに二段目の簡略化をかける構成
- 九州は島が多いので、長崎・鹿児島を中心に簡略化を強めている

## 九州の最新簡略化結果

- `fukuoka`
  - `111 -> 105 feature`
  - 頂点数 `295,967 -> 9,408`
- `saga`
  - `47 -> 42 feature`
  - 頂点数 `86,398 -> 4,385`
- `nagasaki`
  - `341 -> 262 feature`
  - 頂点数 `985,452 -> 7,928`
- `kumamoto`
  - `146 -> 134 feature`
  - 頂点数 `262,478 -> 10,965`
- `oita`
  - `67 -> 55 feature`
  - 頂点数 `209,181 -> 7,400`
- `miyazaki`
  - `82 -> 66 feature`
  - 頂点数 `310,143 -> 8,025`
- `kagoshima`
  - `150 -> 133 feature`
  - 頂点数 `745,298 -> 9,205`
- `kyushu_all`
  - `944 -> 664 feature`
  - 頂点数 `57,316 -> 34,381`

## 最新の検証結果

- `node tools\validate-data.mjs data/prefectures/fukuoka.js --global=FUKUOKA_MUNICIPALITIES`
  - `60 municipalities / 105 features / 12 areaCodes / 13 maNames`
- `node tools\validate-data.mjs data/prefectures/saga.js --global=SAGA_MUNICIPALITIES`
  - `20 / 42 / 4 / 7`
- `node tools\validate-data.mjs data/prefectures/nagasaki.js --global=NAGASAKI_MUNICIPALITIES`
  - `21 / 262 / 7 / 16`
- `node tools\validate-data.mjs data/prefectures/kumamoto.js --global=KUMAMOTO_MUNICIPALITIES`
  - `45 / 134 / 7 / 13`
- `node tools\validate-data.mjs data/prefectures/oita.js --global=OITA_MUNICIPALITIES`
  - `18 / 55 / 7 / 14`
- `node tools\validate-data.mjs data/prefectures/miyazaki.js --global=MIYAZAKI_MUNICIPALITIES`
  - `26 / 66 / 6 / 8`
- `node tools\validate-data.mjs data/prefectures/kagoshima.js --global=KAGOSHIMA_MUNICIPALITIES`
  - `43 / 133 / 9 / 16`
- `node tools\validate-data.mjs data/prefectures/kyushu-all.js --global=KYUSHU_ALL_MUNICIPALITIES`
  - `233 / 664 / 48 / 86`
- `node tools\test-quiz-engine.mjs`
  - `status: ok`

## 未確認 / 次にやること

1. `kyushu_all` をブラウザで確認
   - パン
   - ズームイン / ズームアウト
   - 市外局番モードの体感
2. 長崎・鹿児島でまだ重ければ、県別ではなく `all-region` 専用の追加簡略化をさらに強める
3. 将来の `japan_all` に向けて、`shikoku_all / chugoku_all / kyushu_all / hokkaido_all / kanto_all` の広域ビルダーを同じ二段階簡略化パターンへ寄せる
4. 次の広域候補
   - `tohoku`
   - `koshinetsu`
   - `hokuriku`
   - `tokai`
   - `kinki`
   - `okinawa`

## 作業ツリーの注意

- かなり大きい未コミット差分が残っている
- 既存の変更と今回の変更が混ざっているので、Claude Code 側では最初に `git status` を見てから触るのが安全
- 主な変更対象
  - `css/style.css`
  - `js/app.js`
  - `js/map-renderer.js`
  - `js/ma-union.js`
  - `js/quiz-engine.js`
  - `js/result-analytics.js`
  - `js/progress-store.js`
  - `data/catalog.js`
  - `index.html`
  - `docs/development/adding-prefecture.md`

## 補足

- 今回は push / commit していない
- ブラウザ体感の確認までは途中
- 引き継ぎ先では、まず `kyushu_all` を開いて軽さを見るのが最優先
