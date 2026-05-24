# VectorGrid 導入設計メモ
> 対象: 日本全域（`japan_all`）のパフォーマンス改善  
> 方針: 全国版だけ専用 renderer に差し替え。既存都道府県は手を入れない。

---

## 1. 背景

日本全域データは軽量化後でも次の規模がある。

- `municipalities`: 約 `1741`
- `features`: 約 `2171`
- vertices: 約 `43834`

`preferCanvas`、`forceLiteMode`、ラベル削減、warmup 停止を入れても、全国版では操作後にクリック応答が鈍る。  
これはラベルの量だけでなく、**Leaflet の通常ベクタレイヤーを全件 interactive に持っていること自体**が主因と考えられる。

---

## 2. 問題の本質

現行の `L.geoJSON` は全フィーチャーを **Leaflet のインタラクティブレイヤーとして常駐** させる。  
Canvas モードでも「どこをクリックしたか」をレイヤー単位で判定するために全フィーチャーの hit-test を保持しており、`setStyle` を呼ぶと Canvas 全体を再描画する。

日本全域の 2000 超フィーチャーでは、以下が累積してボトルネックになる。

- 初期描画で全ポリゴンを一括投入する
- クリック判定の対象が常に全件
- `markCorrect` / `flashWrong` / hover で `setStyle` が走る
- パン・ズーム後に再描画コストが増える

つまり、Canvas は「SVG より軽い」だけで、**巨大 GeoJSON をそのまま interactive に持つ問題の根治にはならない**。

---

## 3. 外部調査の結論

大規模 GeoJSON に対する GitHub / 公式寄りの知見はかなり一貫している。

- 生の `L.geoJSON` で大規模ポリゴンを常時 interactive に持つのは限界がある
- Leaflet を維持するなら `Leaflet.VectorGrid` が最有力
- さらに大きなデータや将来的な拡張まで見るなら WebGL / vector tiles 系が本命

参考:

- [Leaflet.VectorGrid GitHub](https://github.com/Leaflet/Leaflet.VectorGrid)
- [Leaflet.VectorGrid API docs](https://leaflet.github.io/Leaflet.VectorGrid/vectorgrid-api-docs.html)
- [Leaflet.glify GitHub](https://github.com/robertleeplummerjr/Leaflet.glify)
- [MapLibre large-data guide](https://maplibre.org/maplibre-gl-js/docs/guides/large-data/)

---

## 4. 候補比較

| 方法 | 難易度 | 期待効果 | GeoQuiz との相性 | コメント |
|---|---|---:|---|---|
| `Leaflet.VectorGrid` | 中 | 大 | 高 | Leaflet 維持のまま全国版だけ差し替えやすい |
| `Leaflet.glify` | 高 | 最大 | 低〜中 | WebGL は強いが API 差が大きく書き直し量が多い |
| hover 専用別レイヤー | 小 | 中 | 高 | INP 改善には効くが根本解決ではない |
| MapLibre へ全国版だけ分離 | 高 | 最大 | 中 | 長期案として有力だが導入面積が広い |

---

## 5. 第一候補: Leaflet.VectorGrid

### 5-1. なぜ噛み合うか

`Leaflet.VectorGrid.Slicer` は内部で `geojson-vt` を使い、GeoJSON を**ズームレベル別タイル**に分割して描画する。

- 現在のビューポートに存在するタイルだけ描画する
- 全 `2232` フィーチャーを同時にベクタレイヤーとして保持しない
- クリック判定もタイル内に限定される
- `interactive: true` で既存のクイズ操作と接続できる
- CDN 1 ファイル追加で試せる

たとえば:

```javascript
L.vectorGrid.slicer(geojsonData, {
  rendererFactory: L.canvas.tile,
  interactive: true,
  vectorTileLayerStyles: {
    sliced: {
      color: "#6b7280",
      weight: 1,
      fillColor: "#2b3036",
      fillOpacity: 0.8
    }
  }
}).addTo(map);
```

### 5-2. 依存ライブラリ

`bundled` 版なら `geojson-vt` 同梱で追加依存なし。

```html
<script src="https://unpkg.com/leaflet.vectorgrid@1.3.0/dist/Leaflet.VectorGrid.bundled.min.js"></script>
```

---

## 6. 第二候補: Leaflet.glify

`Leaflet.glify` は WebGL ベースで、数十万〜数百万件クラスでも強い。  
ただし GeoQuiz の現在の `MapRenderer` は Leaflet の通常ベクタ API にかなり依存しているため、全国版だけでも差し替えコストは大きい。

想定される課題:

- `L.geoJSON` 前提のイベント設計を作り直す必要がある
- `markCorrect` / `flashWrong` / heatmap を別設計にする必要がある
- ラベル連携を個別に組み直す必要がある

結論として、**すぐ試す候補ではなく中長期案**。

---

## 7. 軽量改修案: hover 専用別レイヤー

現行アーキテクチャに一番近い改善案。

- メインレイヤーは静的に描画したまま
- hover / flash だけ別の小さなレイヤーに 1 フィーチャーを重ね描きする
- `setStyle` による全体再描画を避ける

これは数十行〜小規模改修で入りうるが、**全国版の根本問題である全件 interactive 保持は残る**。  
そのため、本命ではなく補助策。

---

## 8. 推奨方針

### 推奨順

1. `Leaflet.VectorGrid` を第一候補にする
2. `ma_broad` 全国版で最小検証する
3. 成功したら `municipality` 全国版へ拡張する
4. それでも足りなければ `glify` / MapLibre を再検討する

### なぜ `ma_broad` から始めるか

- フィーチャー数が最小
- 3桁広域局番は dissolve 済みで形が単純
- クイズ UI はそのままで性能差を見やすい
- `municipality` よりラベル・当たり判定の論点が少ない

---

## 9. フェーズ分割

### Phase 1 — `japan_all + ma_broad` 限定で検証

差し替え範囲:

```text
現行: _renderAreaCodeLayer(features)   → L.geoJSON(...)
新規: _renderAreaCodeLayerVG(features) → L.vectorGrid.slicer(...)
```

全国版かつ `ma_broad` モードのときだけ新しいパスを通す。  
他データセットや他モードは一切変更しない。

### Phase 2 — `japan_all + municipality`

`VectorGrid` でイベントやスタイル更新の勝ち筋が見えたら `municipality` に広げる。

ここでは次を要検討:

- easy 時の主要自治体ラベルだけ表示
- zoom に応じたクリック対象の段階解放
- `markCorrect` / `flashWrong` の再スタイル方法

### Phase 3 — 全国版全体の最適化

- `ma_broad` を完全専用データ化
- zoom レベルでデータの詳細度を切り替える
- 必要なら MapLibre / WebGL へ再評価

---

## 10. 技術論点

### 論点 1 — クリック時に `feature.properties` をどう拾うか

現行:

```javascript
layer.on("click", () => {
  this.onFeatureClick && this.onFeatureClick(feature, layer);
});
```

VectorGrid:

```javascript
vectorGridLayer.on("click", (e) => {
  const props = e.layer.properties;
});
```

`e.layer.properties` から `id`, `area_code` などは取得できる。  
ただし通常の Leaflet layer オブジェクトほど多機能ではないので、既存の click 後処理が layer 自体に依存していないか確認が必要。

### 論点 2 — `markCorrect` / `flashWrong` をどう寄せるか

現行は `layer.setStyle(...)` 前提。  
VectorGrid は `getFeatureId` を与えることで `setFeatureStyle` ベースの運用ができる可能性がある。

例:

```javascript
L.vectorGrid.slicer(data, {
  getFeatureId: (feature) => feature.properties.id
});
```

その上で:

```javascript
vectorGridLayer.setFeatureStyle(featureId, {
  fillColor: "#4fb7a5",
  fillOpacity: 0.9
});
```

ただし Canvas タイル上での期待挙動は実機確認が必要。

### 論点 3 — ラベルはどうするか

GeoQuiz のラベルは既に `L.marker + bindTooltip` で別レイヤー化されている。  
つまり **ポリゴン描画を VectorGrid に変えても、ラベル設計は基本そのまま維持できる**。

これは導入上かなり有利。

---

## 11. 追加で考えられる運用案

### 案 A — 全国版は最初からフル 1741 問にしない

初版を次のどれかに寄せる。

- 県庁所在地 + 政令指定都市版
- 主要都市版
- 3桁広域局番版

### 案 B — zoom 依存で段階表示

- 低 zoom: 主要都市だけラベル・クリック
- 中 zoom: 中核市などを追加
- 高 zoom: 詳細自治体を解放

### 案 C — 全国版だけ lazy load 的に扱う

見た目は全国地図を出しつつ、詳細操作対象は地域単位で後読みする。

---

## 12. 結論

現時点の最有力は **`Leaflet.VectorGrid` を全国版だけに導入する案**。

理由:

- Leaflet ベースを維持できる
- 今の GeoQuiz へ段階的に組み込みやすい
- クリック判定と描画対象をタイル単位にできる
- `ma_broad` から小さく試せる

したがって、次の実装着手単位は次がよい。

- `japan_all + ma_broad` のみ `VectorGrid` で置換する最小実験

---

## 13. 実装前チェックリスト

- [ ] `Phase 1` の対象を `japan_all + ma_broad` のみに固定する
- [ ] `onFeatureClick` / `onAreaCodeClick` が layer オブジェクトへ依存していないか確認する
- [ ] `setFeatureStyle` が期待通り使えるか簡易デモで確認する
- [ ] CDN 読み込みで試すか、ローカル同梱にするか決める
- [ ] `municipality` は別フェーズとして切り分ける

