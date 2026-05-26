# 都道府県データ追加手順

このメモは、GeoQuiz に都道府県データを追加する時の現行フローです。  
2026-05-24 時点では、以下のデータセットを整備済みです。  

- `tokyo`
- `tokyo_all`
- `tokyo_islands`
- `saitama`
- `chiba`
- `kanagawa`
- `ibaraki`
- `gunma`
- `tochigi`
- `hokkaido_doo`
- `hokkaido_donan`
- `hokkaido_dohoku`
- `hokkaido_doto`
- `hokkaido_all`
- `kagawa`
- `tokushima`
- `ehime`
- `kochi`
- `shikoku_all`
- `tottori`
- `shimane`
- `okayama`
- `hiroshima`
- `yamaguchi`
- `chugoku_all`
- `fukuoka`
- `saga`
- `nagasaki`
- `kumamoto`
- `oita`
- `miyazaki`
- `kagoshima`
- `kyushu_all`
- `okinawa`

## 広域区分の方針

広域データセットは、今後は次の区分で揃えていきます。

- `hokkaido`: 北海道 `1道`
- `tohoku`: 東北 `6県`
- `kanto`: 関東 `7都県`
- `koshinetsu`: 甲信越 `3県` (`山梨・長野・新潟`)
- `hokuriku`: 北陸 `3県` (`富山・石川・福井`)
- `tokai`: 東海 `4県` (`静岡・愛知・岐阜・三重`)
- `kinki`: 近畿 `7府県`
- `chugoku`: 中国 `5県`
- `shikoku`: 四国 `4県`
- `kyushu`: 九州 `7県`
- `okinawa`: 沖縄 `1県`

細分版が必要な地域だけ、広域版とは別に派生データセットを持つ方針です。

- `tokyo / tokyo_all / tokyo_islands`
- `hokkaido_doo / hokkaido_donan / hokkaido_dohoku / hokkaido_doto`

## 方針

- 生成元は `geolonia/japanese-admins` を使う
- 各都道府県ごとに `tools/build-{dataset-id}-data.mjs` を持つ
- 生成時に `mapshaper` でトポロジーを保った簡略化をかける
- 簡略化後に `labelPoint` を再計算する
- `label-overrides` と `speech-readings` を都道府県ごとに分ける
- `data/catalog.js` と `index.html` への登録までを追加作業の範囲とする

## 1. 依存関係

簡略化処理は `mapshaper` に寄せています。

```powershell
npm install
```

`package.json` の現行依存関係:

```json
{
  "dependencies": {
    "mapshaper": "^0.7.19"
  }
}
```

## 2. 追加するファイル

新しい都道府県を追加する時は、最低限以下を作ります。

- `tools/build-{dataset-id}-data.mjs`
- `data/prefectures/{dataset-id}.js`
- `data/{dataset-id}/label-overrides.js`
- `data/{dataset-id}/speech-readings.js`

## 3. ビルドスクリプトの役割

`tools/build-{dataset-id}-data.mjs` では次を行います。

1. 自治体メタデータ配列 `admins` を定義する
2. `geolonia/japanese-admins` から自治体ごとの境界を取得する
3. `features` をアプリ形式に整形する
4. `simplifyFeatureCollectionWithMapshaper()` で簡略化する
5. 簡略化後に `labelPoint` を再計算する
6. `window.GLOBAL_NAME = { ... };` 形式で `data/prefectures/` に出力する

共通簡略化処理は `tools/lib/simplify-with-mapshaper.mjs` に寄せています。

## 4. municipalities に必要な項目

各自治体データには最低限以下を入れます。

- `id`
- `name`
- `area_code`
- `ma_name`
- `region`
- `tags`

必要に応じて政令指定都市は `codes` で複数行政コードを束ねます。  
単独自治体は `code` を使います。

## 5. features に必要な項目

各 GeoJSON Feature の `properties` には最低限以下を入れます。

- `id`
- `name`
- `area_code`
- `ma_name`
- `region`
- `tags`
- `sourceCode`
- `labelPoint`
- `labelAngle`
- `labelSize`

`labelPoint` は現行データでは `[lat, lng]` 形式で持たせています。  
`labelAngle` は現状、名称長に応じて `-18` または `-25` を入れる運用です。

## 6. mapshaper の現行設定

現状の標準設定は次です。

```js
{
  interval: "35m",
  weighting: 0.75,
  minIslandArea: "1500m2",
  minSliverArea: "1500m2",
  sliverControl: 0.85
}
```

意図は以下です。

- `weighted` simplification で海岸線や境界を自然に軽くする
- `filter-islands` で細かい孤立片を落とす
- `filter-slivers` で橋上や埋立地の細片を減らす
- `clean` で出力を安定化する

県ごとに細片が残る場合だけ、`minIslandArea` と `minSliverArea` を少し強めます。

## 7. 出力データ形式

出力ファイルは次の形です。

```js
window.TOCHIGI_MUNICIPALITIES = {
  type: "FeatureCollection",
  source: "geolonia/japanese-admins, derived from MLIT National Land Numerical Information administrative boundary data",
  prefecture: {
    id: "tochigi",
    name: "栃木県",
    code: "09"
  },
  generatedAt: "2026-05-23T00:00:00.000Z",
  municipalities: [...],
  features: [...]
};
```

`prefecture`, `municipalities`, `features` は必須です。

## 8. カタログへ登録する

`data/catalog.js` にデータセット設定を追加します。

```js
{
  id: "tochigi",
  name: "栃木県",
  shortName: "栃木",
  title: "GeoQuiz",
  subtitle: "市区町村クイズ",
  dataGlobal: "TOCHIGI_MUNICIPALITIES",
  ghostGlobal: "KANTO_GHOST",
  labelOverridesGlobal: "TOCHIGI_LABEL_OVERRIDES",
  speechReadingsGlobal: "TOCHIGI_SPEECH_READINGS",
  defaultMode: "municipality",
  enabledModes: ["municipality", "ma", "confirm", "confirm_ma"],
  center: [36.57, 139.88],
  version: "0.1.0"
}
```

`index.html` にも以下 3 本を追加します。

- `data/prefectures/{dataset-id}.js`
- `data/{dataset-id}/label-overrides.js`
- `data/{dataset-id}/speech-readings.js`

## 9. 市外局番と MA の決め方

現状は次の優先順位で決めています。

1. 都道府県公式の市町村一覧で対象自治体を確定する
2. `data/area-code-master.js` と総務省の市外局番資料で代表的な局番を確認する
3. NTT 東日本の単位料金区域一覧で MA 名を合わせる
4. 読みづらい自治体名だけ `speech-readings.js` に追加する

主な参照先:

- 都道府県公式の市町村一覧
- `data/area-code-master.js`
- [総務省 市外局番の一覧 PDF](https://www.soumu.go.jp/main_content/001072440.pdf)
- [NTT東日本 単位料金区域別市外局番等一覧表](https://www.ntt-east.co.jp/info-st/mutial/suburbs/numlist/)
- [NTT東日本 単位料金区域一覧表 PDF](https://www.ntt-east.co.jp/tariff/pdf/e41.pdf)

## 10. 検証する

任意ファイルを検証:

```powershell
node tools\validate-data.mjs data\prefectures\tochigi.js --global=TOCHIGI_MUNICIPALITIES
```

グローバル名をファイル先頭から推定:

```powershell
node tools\validate-data.mjs data\prefectures\tochigi.js --infer-global
```

クイズエンジンの簡易確認:

```powershell
node tools\test-quiz-engine.mjs
```

## 11. ブラウザ確認

- `?dataset={dataset-id}` で対象県が読める
- 市区町村モードで問題が出る
- 市外局番モードで塗り分けが出る
- ラベル位置が極端にズレていない
- 海岸線や橋上の細片が目立ちすぎない
- 正解後や結果画面で既存 UI が壊れない

## 12. 今後の運用メモ

- 新規県はこの `mapshaper` フローを標準にする
- まず全県を同じ品質で揃え、その後に県別の見た目調整を行う
- 細片除去の閾値は共通設定を基本にし、例外県だけ個別調整する
- MA 割り当ては初回追加時に一旦通し、違和感が出た県だけ再確認する
