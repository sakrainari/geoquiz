# 都道府県データ追加手順

このメモは、埼玉県以外の都道府県データを追加する時の作業チェックリストです。

## 1. データファイルを用意する

- `data/prefectures/{dataset-id}.js` を追加する
- ファイル形式は `window.GLOBAL_NAME = { ... };` とする
- `type` は `FeatureCollection`
- `prefecture`, `municipalities`, `features` を必ず持たせる

## 2. municipalities に必要な項目

各自治体データには最低限以下を入れます。

- `id`
- `name`
- `area_code`
- `ma_name`
- `region`
- `tags`

## 3. features に必要な項目

各GeoJSON Featureの `properties` には最低限以下を入れます。

- `id`
- `name`
- `area_code`
- `ma_name`
- `labelPoint`
- `labelAngle`
- `labelSize`

`labelPoint` は `[lat, lng]` です。Leafletの一般的な `[lat, lng]` 指定に合わせます。

## 4. カタログへ登録する

`data/catalog.js` にデータセット設定を追加します。

```js
{
  id: "tokyo",
  name: "東京都",
  shortName: "東京",
  dataGlobal: "TOKYO_MUNICIPALITIES",
  ghostGlobal: "KANTO_GHOST",
  defaultMode: "municipality",
  enabledModes: ["municipality", "ma"],
  center: [35.68, 139.76],
  version: "0.1.0"
}
```

## 5. 検証する

デフォルトの埼玉県データ検証:

```powershell
node tools\validate-data.mjs
```

任意ファイルを検証:

```powershell
node tools\validate-data.mjs data\prefectures\tokyo.js --global=TOKYO_MUNICIPALITIES
```

グローバル名をファイル先頭から推定:

```powershell
node tools\validate-data.mjs data\prefectures\tokyo.js --infer-global
```

画像問題データも合わせて検証:

```powershell
node tools\validate-data.mjs data\prefectures\tokyo.js --global=TOKYO_MUNICIPALITIES --image=data\image-questions\tokyo.js --image-global=TOKYO_IMAGE_QUESTIONS
```

## 6. クイズエンジンを確認する

```powershell
node tools\test-quiz-engine.mjs
```

## 7. ブラウザで確認する

- 市区町村モードで問題が出る
- 市外局番モードで市外局番エリアが出る
- 未回答エリアにラベルが出ない
- 正解後ラベルが左上へ飛ばない
- リザルトでヒートマップとJSON出力が動く
