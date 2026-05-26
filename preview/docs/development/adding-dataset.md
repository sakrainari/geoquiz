# データセット追加手順

このドキュメントは GeoQuiz に新しいデータセットを追加するための総合ガイドです。  
データセットには **2 種類**あり、それぞれ使用データソース・ビルドフロー・catalog.js の書き方が異なります。

---

## データセットの種類

| 種別 | 単位 | データソース | catalog `category` |
|------|------|-------------|---------------------|
| **市区町村レベル** | 都道府県・広域ブロック | geolonia/japanese-admins | （なし・デフォルト） |
| **町字レベル** | 個別市区町村内の町字 | e-Stat 国勢調査 小地域境界 | `"special"` |

---

## 1. 市区町村レベルの追加手順

都道府県単位・広域ブロック単位のデータセットです。  
詳細は [adding-prefecture.md](./adding-prefecture.md) を参照してください。

### 概要

- データソース: [`geolonia/japanese-admins`](https://github.com/geolonia/japanese-admins)（行政区域境界）
- ビルドツール: `mapshaper`（トポロジー保持の簡略化）
- 出力形式: `window.XXXXX_MUNICIPALITIES = { ... }` 形式の JS ファイル

### 必要ファイル

```
tools/build-{dataset-id}-data.mjs      ← ビルドスクリプト
data/prefectures/{dataset-id}.js       ← 生成されるデータ
data/{dataset-id}/label-overrides.js   ← ラベル位置の手動補正
data/{dataset-id}/speech-readings.js  ← 読み方オーバーライド
```

### 出力データの必須フィールド

**municipalities 配列の各要素:**

| フィールド | 型 | 説明 |
|------------|-----|------|
| `id` | string | 一意 ID（例: `"saitama_011"`) |
| `name` | string | 自治体名（例: `"さいたま市"`) |
| `area_code` | string | 市外局番（例: `"048"`) |
| `ma_name` | string | MA 名（例: `"さいたまMA"`) |
| `region` | string | 地域区分（例: `"埼玉南部"`) |
| `tags` | string[] | タグ配列（例: `["政令指定都市"]`) |

**features 配列の各 Feature.properties:**

| フィールド | 型 | 説明 |
|------------|-----|------|
| `id` | string | municipalities の id と一致 |
| `name` | string | 自治体名 |
| `area_code` | string | 市外局番 |
| `ma_name` | string | MA 名 |
| `region` | string | 地域区分 |
| `tags` | string[] | タグ配列 |
| `sourceCode` | string | 全国地方公共団体コード |
| `labelPoint` | [lat, lng] | ラベル配置座標 |
| `labelAngle` | number | ラベル角度（`-18` または `-25`） |
| `labelSize` | number | ラベルフォントサイズ |

### 市外局番・MA の決め方

1. 都道府県公式の市町村一覧で対象自治体を確定する
2. `data/area-code-master.js` で代表局番を確認する
3. [総務省 市外局番一覧 PDF](https://www.soumu.go.jp/main_content/001072440.pdf) で補完する
4. [NTT東日本 単位料金区域別一覧](https://www.ntt-east.co.jp/info-st/mutial/suburbs/numlist/) で MA 名を合わせる

---

## 2. 町字レベルの追加手順

市区町村の内部を「町字（ちょうあざ）」単位でクイズにするデータセットです。  
藤沢市・所沢市が既存の実装例です。

### 2-1. e-Stat から Shapefile を取得する

1. [e-Stat 統計地理情報システム 境界データダウンロード](https://www.e-stat.go.jp/gis/statmap-search?type=2) を開く
2. **「小地域（町丁・字等別）」** を選択する
3. **令和2年（2020）** を選択する（最新の国勢調査年）
4. 対象都道府県 → 対象市区町村 を選択する
   - 都道府県単位でまとめてダウンロードも可能（後でフィルタする）
5. **「Shape」** 形式を選択してダウンロードする
6. ZIP を展開する

展開後のファイル名の例:

```
r2ka14.shp      ← 神奈川県全体（PREF=14）
r2ka14205.shp   ← 藤沢市のみ（PREF=14, CITY=205）
r2ka11208.shp   ← 所沢市のみ（PREF=11, CITY=208）
```

ファイル名の規則: `r2ka{都道府県コード2桁}{市区町村コード3桁}.shp`

> **市区町村コードの確認方法:** 総務省の [全国地方公共団体コード一覧](https://www.soumu.go.jp/denshijiti/code.html) を参照してください。  
> `CITY_CODE` は都道府県コード＋市区町村コード 5 桁（例: `"14205"`）で扱います。

### 2-2. ogr2ogr で GeoJSON に変換する（手動確認用）

ビルドスクリプトは内部で mapshaper を使って SHP → GeoJSON を行うため、  
通常は手動変換は不要です。ただし内容確認などに使いたい場合は以下のコマンドを使います。

```bash
# GDAL の ogr2ogr（インストール済みの場合）
ogr2ogr \
  -f GeoJSON \
  -t_srs EPSG:4326 \
  output.geojson \
  r2ka14205.shp

# または mapshaper（npm install 済みであれば）
node node_modules/mapshaper/bin/mapshaper r2ka14205.shp \
  -o format=geojson output.geojson
```

フィールドの確認（令和2年データの標準フィールド）:

| フィールド | 内容 |
|------------|------|
| `KEY_CODE` | 都道府県コード＋市区町村コード＋町丁目コード |
| `PREF` | 都道府県コード（2桁） |
| `CITY` | 市区町村コード（3桁） |
| `S_NAME` | 町丁・字等名称（例: `"本町一丁目"`, `"大字村岡"`） |

### 2-3. 丁目合体（mapshaper dissolve）

e-Stat の境界データは「丁目」単位で細かく分割されています。  
GeoQuiz では **丁目番号を除去した基本町名単位**（例: `"本町一丁目"` → `"本町"`）でポリゴンを合体します。

ビルドスクリプト内では mapshaper の `dissolve` コマンドで実装しています。

```js
// Step 1: 丁目番号を除去してグループキー（_chome）を付与する
function baseChomeName(name) {
  return name
    .replace(/^大字/, "")                              // 大字プレフィックスを除去
    .replace(/[〇一二三四五六七八九十百千\d]+丁目$/, "") // 丁目番号を除去
    .trim();
}

// Step 2: mapshaper dissolve で同名丁目を合体する
// （コマンドラインでは下記と等価）
// mapshaper pre_dissolve.geojson -dissolve _chome -filter-islands min-area=500m2 remove-empty -o dissolved.geojson
await execFile(mapshaperBin, [
  preDissolvePath,
  "-dissolve", "_chome",
  "-filter-islands", "min-area=500m2", "remove-empty",
  "-o", "format=geojson", dissolvedPath,
]);
```

**脱落救済処理:** mapshaper の dissolve がトポロジー処理で `null` geometry を生成することがあります。  
ビルドスクリプトには dissolve 前後の差分を検出して元ポリゴンを救済するロジックが含まれています。  
詳細は `tools/build-fujisawa-data.mjs` の Step 4b を参照してください。

### 2-4. build-{city-id}-data.mjs のテンプレート

既存の `tools/build-fujisawa-data.mjs` または `tools/build-tokorozawa-data.mjs` をコピーして編集します。  
変更が必要な箇所は以下の通りです。

```js
// ─── ここを書き換える ──────────────────────────────────────────────────────
const OUTPUT      = "data/prefectures/{city-id}.js";
const GLOBAL_NAME = "{CITY_ID}_MUNICIPALITIES";
const CITY_CODE   = "XXXXX"; // 5桁の全国地方公共団体コード（例: "14205"）
const AREA_CODE   = "0XXX";  // 市外局番（例: "0466"）
const MA_NAME     = "{市名}MA"; // MA 名（例: "藤沢MA"）
// ──────────────────────────────────────────────────────────────────────────

// 使い方コメントも更新する
// Usage: node tools/build-{city-id}-data.mjs --shp=path/to/r2kaXXXXX.shp
```

`isFujisawa()` 関数を対象市に合わせてリネームし、フィルタ条件の `CITY_CODE` を差し替えてください。

```js
// リネーム例: isFujisawa → isYourCity
function isYourCity(feature, fields) {
  const p = feature.properties;
  if (fields.keyCode) {
    return String(p[fields.keyCode]).slice(0, 5) === CITY_CODE;
  }
  if (fields.pref && fields.city) {
    return String(p[fields.pref]) === CITY_CODE.slice(0, 2)
      && String(p[fields.city]) === CITY_CODE.slice(2);
  }
  return false;
}
```

出力データの `city` フィールドも更新してください。

```js
city: { id: "{city-id}", name: "{市名}", code: "XXXXX", prefecture: "{県名}" }
```

### 2-5. ビルドを実行する

```powershell
# Shapefile のパスを指定して実行
node tools/build-{city-id}-data.mjs --shp=path/to/r2kaXXXXX.shp
```

成功すると以下が出力されます。

```
✅ 完了: data/prefectures/{city-id}.js
   XX 町字, 頂点数 YYYY → ZZZZ
```

### 2-6. maFeatures を事前計算する

`precompute-ma-features.mjs` は市外局番ごとのポリゴン union を事前計算して  
データファイルに埋め込みます。これにより実行時の `turf.union()` 呼び出しがなくなります。

```powershell
# 単一データセットのみ更新
node tools/precompute-ma-features.mjs --only={city-id}

# 全データセットを更新
node tools/precompute-ma-features.mjs
```

> **注意:** 町字データセットは通常 1 市 = 1 市外局番です。その場合でも  
> `maFeatures` は map-renderer が参照するため実行が必要です。

### 2-7. validate-data.mjs で検証する

```powershell
# グローバル名を自動推定して検証
node tools/validate-data.mjs data/prefectures/{city-id}.js --infer-global

# グローバル名を明示する場合
node tools/validate-data.mjs data/prefectures/{city-id}.js --global={CITY_ID}_MUNICIPALITIES
```

検証項目:
- `municipalities` と `features` の id 対応
- 必須フィールドの存在チェック
- `labelPoint` の座標範囲（日本国内かどうか）
- `maFeatures` の存在チェック

---

## 3. catalog.js への追加方法

### 通常カテゴリ（市区町村レベル）

`data/catalog.js` の配列末尾付近に追加します。

```js
{
  id: "tochigi",                           // URL の ?dataset= に使う文字列
  name: "栃木県",                           // ナビゲーションや表示名
  shortName: "栃木",                        // 地域セレクタのボタン表示
  title: "GeoQuiz",
  subtitle: "市区町村クイズ",
  description: "...",
  dataGlobal: "TOCHIGI_MUNICIPALITIES",    // data/prefectures/{id}.js の window 変数名
  ghostGlobal: "KANTO_GHOST",              // 隣接県のゴーストデータ（任意）
  labelOverridesGlobal: "TOCHIGI_LABEL_OVERRIDES",
  speechReadingsGlobal: "TOCHIGI_SPEECH_READINGS",
  defaultMode: "municipality",
  enabledModes: ["municipality", "ma", "confirm", "confirm_ma"],
  center: [36.57, 139.88],                 // 初期表示の中心座標（fitToMain のフォールバック）
  // initialView: { center: [...], zoom: N },  ← 島しょや広域データで必要な場合
  version: "0.1.0"
}
```

### Special カテゴリ（町字レベル）

```js
{
  id: "fujisawa",
  name: "藤沢市（町字）",
  shortName: "藤沢市",
  title: "GeoQuiz",
  subtitle: "町字クイズ / 藤沢市",
  description: "藤沢市の町字を当てるクイズ。e-Stat 国勢調査2020 小地域境界データを使用。",
  dataGlobal: "FUJISAWA_MUNICIPALITIES",
  labelOverridesGlobal: "FUJISAWA_LABEL_OVERRIDES",  // 必要な場合のみ
  speechReadingsGlobal: "FUJISAWA_SPEECH_READINGS",   // 必要な場合のみ
  defaultMode: "municipality",
  enabledModes: ["municipality", "confirm"],           // ma 系・puzzle は不要
  center: [35.34, 139.47],
  initialView: {
    center: [35.34, 139.47],
    zoom: 12                                           // 町字は zoom 12 前後が目安
  },
  mapMaxZoom: 18,                                      // 町字は必須
  category: "special",                                 // ← これが Special カテゴリの目印
  version: "0.1.0"
}
```

### 通常 vs Special の違い

| 項目 | 通常カテゴリ | Special カテゴリ |
|------|-------------|-----------------|
| `category` | なし（省略） | `"special"` |
| `mapMaxZoom` | 不要 | `18`（必須） |
| `initialView` | 広域のみ必要 | 必須（zoom 11〜13 推奨） |
| `enabledModes` に ma 系を含む | ○ | 通常は不要（1市1局番のため） |
| `ghostGlobal` | 必要に応じて設定 | 不要 |
| 地域セレクタへの表示 | 通常リストに表示 | Special セクションに表示 |

### catalog.js の全必須フィールド一覧

| フィールド | 必須 | 説明 |
|------------|------|------|
| `id` | ✅ | データセット ID。URL の `?dataset=` に使う |
| `name` | ✅ | 表示名（地域セレクタ等） |
| `shortName` | ✅ | 短縮表示名（ボタン等） |
| `title` | ✅ | ページタイトル（通常 `"GeoQuiz"` 固定） |
| `subtitle` | ✅ | サブタイトル |
| `description` | 推奨 | TOP 画面の説明文（省略時は自動生成） |
| `dataGlobal` | ✅ | 主データの window 変数名 |
| `ghostGlobal` | △ | 隣接県ゴーストの変数名（なければ省略） |
| `labelOverridesGlobal` | △ | ラベルオーバーライドの変数名 |
| `speechReadingsGlobal` | △ | 読み方の変数名 |
| `imageQuestionsGlobal` | △ | 画像問題データの変数名（画像モード使用時） |
| `defaultMode` | ✅ | 起動時のデフォルトモード |
| `enabledModes` | ✅ | 使用可能なモードの配列 |
| `center` | ✅ | 初期フィット時の中心座標 `[lat, lng]` |
| `initialView` | △ | 広域・島しょ・町字で明示指定が必要な場合 |
| `mapMaxZoom` | △ | 町字データでは `18` を指定する |
| `labelBehavior` | △ | 島しょ等で特別なラベル挙動が必要な場合 |
| `category` | △ | `"special"` を指定すると Special セクションに表示 |
| `version` | ✅ | データバージョン文字列 |

### index.html への追加

`<script>` タグを適切な位置に 3 本（町字は 1〜3 本）追加します。

```html
<!-- 市区町村レベルの場合 -->
<script src="data/prefectures/{dataset-id}.js"></script>
<script src="data/{dataset-id}/label-overrides.js"></script>
<script src="data/{dataset-id}/speech-readings.js"></script>

<!-- 町字レベルの場合（label-overrides と speech-readings は必要な場合のみ） -->
<script src="data/prefectures/{city-id}.js"></script>
<script src="data/{city-id}/label-overrides.js"></script>
<script src="data/{city-id}/speech-readings.js"></script>
```

> **配置場所:** 既存の同種スクリプトタグの直後（カタログ順）に追加するのが慣例です。

---

## 4. チェックリスト

### ビルド完了後の確認

- [ ] `node tools/validate-data.mjs ... --infer-global` がエラーなし
- [ ] `node tools/precompute-ma-features.mjs --only={id}` が完了
- [ ] `data/prefectures/{id}.js` に `maFeatures` キーが存在する

### ブラウザ動作確認

- [ ] `?dataset={dataset-id}` で対象データが読み込まれる
- [ ] `municipality` モードで問題が正しく出る
- [ ] `confirm` モードで全エリアが塗り分けられる
- [ ] `ma` モードで市外局番の塗り分けが出る（市区町村レベルのみ）
- [ ] ラベルの位置が極端にズレていない
- [ ] 海岸線・橋上の細片が目立ちすぎない
- [ ] 正解時・結果画面で既存 UI が壊れない
- [ ] TOP 画面の地域セレクタに新しいデータセットが表示される
- [ ] TOP 画面のミニマップ（プレビュー）に輪郭が正しく表示される

### 町字レベル特有の確認

- [ ] zoom 12〜14 でラベルが読める大きさで表示される
- [ ] 丁目合体が正しく行われている（同名町が 1 ポリゴンになっている）
- [ ] 飛び地が残っている場合、問題なくクリックできる
- [ ] `mapMaxZoom: 18` が catalog.js に設定されている

### パフォーマンス目安

- [ ] INP（Interaction to Next Paint）が **200ms 以下**
  - Chrome DevTools の Performance タブ、または [PageSpeed Insights](https://pagespeed.web.dev/) で確認
  - 頂点数が多い場合は mapshaper の `interval` を調整する（現行標準: `35m`、町字: `40m`）
- [ ] `features` の頂点数合計が **市区町村レベルで 50,000 以下** を目安にする
  - `node tools/validate-data.mjs` の出力で確認できる

---

## 5. 参照先まとめ

| 用途 | リンク |
|------|--------|
| 行政区域境界（市区町村） | [geolonia/japanese-admins](https://github.com/geolonia/japanese-admins) |
| 小地域境界（町字） | [e-Stat 境界データダウンロード](https://www.e-stat.go.jp/gis/statmap-search?type=2) |
| 市外局番マスタ | `data/area-code-master.js`（本リポジトリ） |
| 市外局番一覧 PDF | [総務省](https://www.soumu.go.jp/main_content/001072440.pdf) |
| MA 名・局番一覧 | [NTT東日本](https://www.ntt-east.co.jp/info-st/mutial/suburbs/numlist/) |
| 全国地方公共団体コード | [総務省](https://www.soumu.go.jp/denshijiti/code.html) |
| 町字の既存実装例 | `tools/build-fujisawa-data.mjs`、`tools/build-tokorozawa-data.mjs` |
| ビルド共通ライブラリ | `tools/lib/simplify-with-mapshaper.mjs` |
