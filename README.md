# GeoQuiz

GeoGuessr向けの地域認識トレーニングツール。白地図をクリックして市区町村・市外局番の位置を覚える静的Webアプリ。

**公開URL:** https://sakrainari.github.io/geoquiz/

---

## 起動方法

`index.html` をブラウザで開くだけで起動します。Node.js・npm・サーバー起動は不要です。

- Chrome / Edge 推奨
- Leaflet / Turf.js は `vendor/` にローカル同梱
- GitHub Pages: `main / root` で公開

---

## 技術構成

| 項目 | 内容 |
|------|------|
| フロントエンド | バニラJS・CSS（React / Vue / Vite 不使用） |
| 地図ライブラリ | Leaflet（`vendor/leaflet/`） |
| GeoJSON処理 | Turf.js（`vendor/turf/`） |
| データ配信 | GitHub Pages（静的ファイルのみ） |
| 成績保存 | localStorage |

### ファイル構成

```
index.html                      ← エントリポイント
css/style.css                   ← スタイル
js/
  app.js                        ← メインロジック
  map-renderer.js               ← Leaflet 地図描画
  quiz-engine.js                ← 問題生成・正誤判定
  quiz-modes.js                 ← モード共通スキーマ
  ma-union.js                   ← 市外局番エリア結合
  result-analytics.js           ← リザルト集計
  progress-store.js             ← localStorage 累積成績
  data-loader.js                ← データセット動的読み込み
data/
  catalog.js                    ← データセットカタログ
  prefectures/<id>.js           ← 都道府県GeoJSONデータ
  <id>/precomputed.js           ← 事前計算済みポリゴン
  <id>/label-overrides.js       ← ラベル位置補正
  <id>/speech-readings.js       ← 読み仮名
  ghost/kanto-ghost.js          ← 隣接県ゴースト表示
tools/
  precompute-geo.mjs            ← ポリゴン事前計算スクリプト
vendor/
  leaflet/                      ← Leaflet ローカル同梱
  turf/                         ← Turf.js ローカル同梱
```

---

## 対応データセット

現在63データセットに対応。地方別タブで切り替え可能。

| 地方 | データセット |
|------|------------|
| 北海道 | 道央・道南・道北・道東・全域 |
| 東北 | 青森・岩手・宮城・秋田・山形・福島・全域 |
| 関東 | 東京・東京全域・東京島しょ・埼玉・千葉・神奈川・茨城・群馬・栃木・全域 |
| 中部 | 新潟・富山・石川・福井・山梨・長野・岐阜・静岡・愛知・全域 |
| 近畿 | 三重・滋賀・京都・大阪・兵庫・奈良・和歌山・全域 |
| 中国 | 鳥取・島根・岡山・広島・山口・全域 |
| 四国 | 徳島・香川・愛媛・高知・全域 |
| 九州 | 福岡・佐賀・長崎・熊本・大分・宮崎・鹿児島・全域 |
| 沖縄 | 沖縄 |
| 特集 | 所沢市（町字）・藤沢市（町字） |

---

## 機能一覧

### クイズモード
| モード | 内容 |
|--------|------|
| 市区町村 | 市町村名から地図上の位置を当てる |
| 市外局番 | 局番からエリアを当てる（4〜5桁対応） |
| 市外局番（広域） | 2〜3桁の広域番号を当てる |
| パズル | ずれたポリゴンを正しい位置へドラッグ |
| 確認マップ | 全エリアを表示して確認（クイズなし） |

### ルール
| ルール | 内容 |
|--------|------|
| イージー | ヒントラベルあり・位置を覚える学習モード |
| ノーマル | ミスOK・最後まで完走する練習モード |
| サドンデス | ミス1回でゲームオーバー・知識総動員モード |

### その他機能
- 累積成績の保存・ランキング（苦手・正答率・平均時間）
- 苦手再出題・前回ミス再出題・未正解再出題
- 成績JSONエクスポート / インポート
- ミス時の音声読み上げ（Web Speech API）
- ラベル調整モード（`?edit=labels`）
- スマホ向け Lite Mode

---

## 新データセット追加手順

1. `data/prefectures/<id>.js` にGeoJSONデータを追加
2. `data/<id>/label-overrides.js` と `data/<id>/speech-readings.js` を追加
3. `data/catalog.js` にエントリを追加
4. ポリゴンを事前計算する

```
node tools/precompute-geo.mjs <id>
```

5. `index.html` の `REGIONS` 配列に追加
6. コミット・プッシュ

詳細: [都道府県データ追加手順](docs/development/adding-prefecture.md)

---

## パフォーマンス設計

### ポリゴン事前計算（`tools/precompute-geo.mjs`）

`turf.union()` によるポリゴン結合処理をブラウザ上でリアルタイム実行すると重くなるため、開発時に1回だけ実行して結果をファイルに保存する方式を採用。

```
node tools/precompute-geo.mjs --all   # 全データセット一括
node tools/precompute-geo.mjs saitama # 特定データセットのみ
```

生成される `data/<id>/precomputed.js` には以下が含まれる：
- `municipalityFeatures` — さいたま市区など複数ポリゴンを結合済みの市区町村フィーチャー
- `maFeatures` — 市外局番エリア単位で結合済みのフィーチャー
- `maBroadFeatures` — 広域市外局番エリアのフィーチャー

### データ動的読み込み（`js/data-loader.js`）

URLパラメータ `?dataset=<id>` を見て、選択されたデータセットのファイルだけを動的に読み込む。全データセットを一括読み込みする必要がなく、初回転送量を大幅に削減。

---

## ロードマップ

### 直近
- [ ] 全国モード（japan_all）のパフォーマンス改善
- [ ] スマホ操作の安定化

### 中期
- [ ] 都道府県クイズモード
- [ ] 苦手分析ヒートマップの改善
- [ ] GeoGuessr用JSON出力

### 将来
- [ ] 画像判別クイズ（旗・標識・ナンバープレート）
- [ ] 海外データセット（北米・イギリスなど）

---

## データ出典

境界データは [Geolonia `japanese-admins`](https://geolonia.github.io/japanese-admins/) の公開GeoJSONを使用。国土交通省「国土数値情報（行政区域データ）」を加工して作成されています。
