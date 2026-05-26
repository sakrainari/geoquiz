# 東京MVP着手メモ

最初のゴールは、`島しょ部なし` の `東京都市区町村マップ` を GeoQuiz 上で遊べるようにすることです。

## スコープ

- 対象: 23区 + 多摩地域
- 対象外: 島しょ部
- 対応モード: `municipality`
- あれば便利: `confirm`
- 後回し:
  - `ma`
  - `ma_broad`
  - `image`
  - 地域切替ボタンUI
  - 東京向けラベル微調整

## 成功条件

- `?dataset=tokyo` で東京データが読み込まれる
- 東京の市区町村ポリゴンが地図に表示される
- 市区町村モードで問題が出る
- 正解判定と結果画面まで通る

## 既存確認メモ

- `tools/build-tokyo-data.mjs` は東京都データ生成の雛形があり、初期対象は島しょ部を除く構成
- 東京の自治体定義は 53 件
- `js/app.js` は `?dataset=...` でデータセットを切り替える仕組みを持っている
- ただし `index.html` は今のところ埼玉データしか読み込んでいない
- `data/catalog.js` も埼玉のみ登録されている

## 今回触るファイル

- `tools/build-tokyo-data.mjs`
  - 東京の市区町村データを生成する起点
- `data/prefectures/tokyo.js`
  - 生成物
- `data/catalog.js`
  - `tokyo` データセット登録
- `index.html`
  - 東京データの script 読み込み追加
- `data/tokyo/label-overrides.js`
  - まずは空でよい

## 今回は触らない想定のファイル

- `data/image-questions/tokyo.js`
  - 市区町村プレイだけなら必須ではない
- 地域切替UIまわり
  - `regionSelector` は後回し
- 島しょ部のデータ追加
- 東京の市外局番用調整

## 実装順

1. `tools/build-tokyo-data.mjs` を点検して、23区 + 多摩の 53 自治体を生成対象として確定する
2. `data/prefectures/tokyo.js` を生成する
3. `data/catalog.js` に `tokyo` を追加する
4. `index.html` に東京データと東京ラベル補正ファイルの読み込みを追加する
5. `data/tokyo/label-overrides.js` を空データで追加する
6. `node tools/validate-data.mjs data/prefectures/tokyo.js --global=TOKYO_MUNICIPALITIES` で検証する
7. `?dataset=tokyo` で起動して市区町村モードを確認する

## 実装時の判断メモ

- `enabledModes` は初回は `municipality` と `confirm` に絞る案が安全
- `imageQuestionsGlobal` は `app.js` 側で未定義でも空配列に落ちるため、MVPではなくても動作可能
- `labelOverridesGlobal` も未定義なら空オブジェクトに落ちるが、将来の調整導線を考えると空ファイルを先に置く方が扱いやすい

## 次の一手

最初の実装は `東京データ生成 -> catalog登録 -> HTML読込追加` の3点を優先する。
