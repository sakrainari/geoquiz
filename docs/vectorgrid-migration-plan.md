# VectorGrid 導入設計メモ
> 対象: 日本全域（japan_all）のパフォーマンス改善
> 方針: 全国版だけ専用 renderer に差し替え。既存都道府県は手を入れない。

---

## 問題の本質

現行の `L.geoJSON` は全フィーチャーを **Leaflet のインタラクティブレイヤーとして常駐** させる。
Canvas モードでも「どこをクリックしたか」をレイヤー単位で判定するために全フィーチャーの hit-test を保持しており、
`setStyle` を呼ぶと Canvas 全体を再描画する。日本全域の 2,232 フィーチャーではこれが根本的なボトルネック。

`preferCanvas + forceLiteMode` で INP 952ms → 848ms まで下げたが、
クリック判定コスト・初期描画コストは根本的には解決されていない。

---

## VectorGrid が噛み合う理由

`Leaflet.VectorGrid.Slicer` は内部で `geojson-vt` を使い、GeoJSON を**ズームレベル別タイル**に分割する。
描画は「現在のビューポートに存在するタイルだけ」で行われる。

- ズーム5（全国俯瞰）でも描画対象は画面内のタイルのみ
- タイルは Canvas 単位で独立して描画 → `setStyle` 相当の更新も1タイルの再描画で済む
- クリック判定もタイル内に限定される

---

## フェーズ分割

### Phase 1 — ma_broad（広域局番）限定で検証

**なぜ ma_broad から始めるか**
- フィーチャー数が最小（全国で約 50 件）
- シェイプが単純（広域エリアを dissolve した大きなポリゴン）
- 現行の `_renderAreaCodeLayer` を VectorGrid 版に差し替えるだけで済む
- クイズとしての正解/不正解 UX（flash, markCorrect）を最小規模で検証できる

**差し替え範囲**
```
現行: _renderAreaCodeLayer(features)  →  L.geoJSON(...)
新規: _renderAreaCodeLayerVG(features) →  L.vectorGrid.slicer(...)
```
japan_all かつ ma_broad モード のときだけ新しいパスを通す。
他のデータセット・モードは一切変更しない。

---

### Phase 2 — ma（市外局番）全国版

Phase 1 で VectorGrid のイベントモデルが確認できたら ma（377件）に拡張。

---

### Phase 3 — municipality（市区町村）全国版

最も複雑。ラベルの出し分け（easy/answered/subtle）、puzzle、labelEdit は
現行レイヤーに強く依存しているため、設計の詰めが必要。

---

## 3つの技術論点

### 論点 1 — クリック時に feature.properties をどう拾うか

現行:
```javascript
layer.on("click", () => {
  this.onFeatureClick && this.onFeatureClick(feature, layer);
});
```

VectorGrid:
```javascript
vectorGridLayer.on("click", (e) => {
  const props = e.layer.properties;  // ← VectorGrid が渡す
  // props.id / props.area_code など現行と同じキーが取れる
});
```

`e.layer.properties` に元の GeoJSON の `feature.properties` が入ってくる。
ただし **ジオメトリ（座標）は渡されない**。
現行コードで `layer` オブジェクトのメソッド（`getBounds()` など）を使っている箇所は調整が必要。

→ **調査ポイント**: `onFeatureClick` と `onAreaCodeClick` でレイヤーオブジェクトを何に使っているか。

---

### 論点 2 — markCorrect / flashWrong を VectorGrid 流にどう寄せるか

現行は `layer.setStyle(...)` で個別フィーチャーのスタイルを変える。
VectorGrid にはネイティブな `setFeatureStyle` は存在しないが、
**`setFeatureStyle(id, style)` API が VectorGrid 1.x に存在する**（`L.VectorGrid.Slicer` のみ）。

```javascript
vectorGridLayer.setFeatureStyle(featureId, {
  fillColor: "#4fb7a5",
  fillOpacity: 0.9
});
```

ただしキーは GeoJSON の `feature.id` か `options.getFeatureId` で指定したプロパティ。
設計時に `getFeatureId: (f) => f.properties.id` を渡しておく必要がある。

→ **確認事項**: `setFeatureStyle` の動作が Canvas タイル上で期待通り動くか実機検証が必要。

---

### 論点 3 — ラベルを現行のまま別レイヤーで維持するか

VectorGrid はラベルを扱わない（テキスト描画は Canvas タイルに含まれない）。
現行の `showLabel` / `showAreaCodeLabel` は `L.marker + bindTooltip` で labelPane に描画しており、
**メインレイヤーとは独立した別レイヤー** になっている。

→ ラベル部分は変更不要。VectorGrid 差し替えの影響を受けない。
→ これは設計上の大きなメリット。Phase 1 から安心して進められる。

---

## 依存ライブラリ

| ライブラリ | 用途 | 取得方法 |
|---|---|---|
| `Leaflet.VectorGrid` | タイル分割描画 | CDN 1ファイル（bundled 版に geojson-vt 同梱） |

```html
<script src="https://unpkg.com/leaflet.vectorgrid@1.3.0/dist/Leaflet.VectorGrid.bundled.min.js"></script>
```

geojson-vt は Leaflet.VectorGrid.bundled に同梱されているため追加不要。

---

## リスクと注意点

| リスク | 対策 |
|---|---|
| `setFeatureStyle` が Canvas タイルで動かない | Phase 1 で早期に実機確認 |
| タイル境界でポリゴンが分断される見た目 | `vectorTileLayerStyles` の `weight` を細めに設定 |
| ズームアウト時のポリゴン消失（geojson-vt の simplification） | `tolerance: 0` / `maxZoom: 14` オプションで抑制 |
| flash アニメーションのタイミングずれ | `setFeatureStyle` → setTimeout → `resetFeatureStyle` のパターンで検証 |

---

## 実装開始の前提条件

- [ ] Phase 1 スコープの確認（japan_all + ma_broad のみ）
- [ ] `onFeatureClick` / `onAreaCodeClick` のコールサイト調査（layer オブジェクトの使われ方）
- [ ] `setFeatureStyle` の動作を簡易デモで確認
- [ ] CDN ファイルをローカルに落とすか unpkg のまま使うか決定
