# Speech Readings Guide

海外データセットの読み上げは、原則として各 dataset ごとの `speech-readings.js` にまとめています。

## 配置ルール

- dataset の `id` が `spain` なら: `data/spain/speech-readings.js`
- dataset の `id` が `spain_provinces` なら: `data/spain-provinces/speech-readings.js`
- dataset の `id` が `france_departments` なら: `data/france-departments/speech-readings.js`
- dataset の `id` が `germany` なら: `data/germany/speech-readings.js`
- dataset の `id` が `poland` なら: `data/poland/speech-readings.js`
- dataset の `id` が `ukraine` なら: `data/ukraine/speech-readings.js`

`catalog.js` の各 dataset エントリで `speechReadingsGlobal` を指定し、`js/data-loader.js` が
`data/<hyphen-id>/speech-readings.js` を読み込みます。

## remote dataset でも同じ

`remoteGeoJsonUrl` を使う dataset でも、読み上げファイルの置き場所は同じです。

- `germany`
- `spain_provinces`
- `france_departments`
- `poland`
- `ukraine`

などは、GeoJSON 本体はリモート取得ですが、読み上げはローカルの `data/<dataset>/speech-readings.js`
で上書きしています。

## 調整方針

- 基本は Google マップの日本語表記に寄せる
- 地名系の読みはテンポ優先で、原則として行政区分の語尾を付けない
- 数字系の読みは各 `Area Code` dataset 側で個別管理する

## よく触るファイル

- `data/catalog.js`
- `js/data-loader.js`
- `data/spain/speech-readings.js`
- `data/spain-provinces/speech-readings.js`
- `data/france/speech-readings.js`
- `data/france-departments/speech-readings.js`
- `data/germany/speech-readings.js`
- `data/poland/speech-readings.js`
- `data/ukraine/speech-readings.js`
- `data/indonesia/speech-readings.js`
