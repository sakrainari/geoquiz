/**
 * js/data-loader.js
 *
 * URL パラメータ ?dataset=xxx に対応するデータセットのファイルを
 * 動的に読み込み、完了後に js/app.js を起動する。
 *
 * 前提: window.GEOQUIZ_DATASETS (data/catalog.js) がすでにロード済みであること。
 *
 * 読み込み順:
 *   1. data/prefectures/<hyphen-id>.js
 *   2. data/<hyphen-id>/precomputed.js
 *   3. data/<hyphen-id>/label-overrides.js
 *   4. data/<hyphen-id>/speech-readings.js
 *   5. data/ghost/kanto-ghost.js         （ghostGlobal がある場合のみ）
 *   6. data/image-questions/<hyphen-id>.js （imageQuestionsGlobal がある場合のみ）
 *   7. js/app.js                         （全ファイル完了後）
 */
(function () {
  'use strict';

  // ─── ローディングオーバーレイを生成 ──────────────────────────────
  var overlay = document.createElement('div');
  overlay.id = 'dataLoadingOverlay';
  overlay.style.cssText = [
    'position:fixed',
    'inset:0',
    'z-index:9999',
    'display:flex',
    'align-items:center',
    'justify-content:center',
    'flex-direction:column',
    'gap:12px',
    'background:rgba(16,20,26,0.93)',
    'color:#9ca3af',
    'font-family:"Zen Kaku Gothic New",sans-serif',
    'font-size:13px',
    'letter-spacing:.06em'
  ].join(';');

  var spinner = document.createElement('div');
  spinner.style.cssText = [
    'width:28px',
    'height:28px',
    'border:3px solid rgba(255,255,255,0.15)',
    'border-top-color:#4fb7a5',
    'border-radius:50%',
    'animation:dlSpin .7s linear infinite'
  ].join(';');

  var style = document.createElement('style');
  style.textContent = '@keyframes dlSpin{to{transform:rotate(360deg)}}';
  document.head.appendChild(style);

  var label = document.createElement('span');
  label.textContent = 'データを読み込んでいます…';

  overlay.appendChild(spinner);
  overlay.appendChild(label);
  document.body.appendChild(overlay);

  // ─── URL パラメータからデータセット ID を取得 ────────────────────
  var params = new URLSearchParams(location.search);
  var datasetId = params.get('dataset') || params.get('id') || 'saitama';

  // ─── catalog から該当エントリを探す ─────────────────────────────
  var catalog = window.GEOQUIZ_DATASETS || [];
  var config = null;
  for (var i = 0; i < catalog.length; i++) {
    if (catalog[i].id === datasetId) { config = catalog[i]; break; }
  }
  if (!config) config = catalog[0];

  if (!config) {
    label.textContent = 'カタログが見つかりません。ページを再読み込みしてください。';
    return;
  }

  // ─── ID をハイフン形式に変換（アンダースコア → ハイフン）────────
  function toHyphen(id) {
    return id.replace(/_/g, '-');
  }

  var hyphenId = toHyphen(config.id);

  // ─── 読み込むファイルリストを構築 ───────────────────────────────
  var files = [
    'data/prefectures/' + hyphenId + '.js',
    'data/' + hyphenId + '/precomputed.js',
    'data/' + hyphenId + '/label-overrides.js',
    'data/' + hyphenId + '/speech-readings.js'
  ];

  if (config.ghostGlobal) {
    files.push('data/ghost/kanto-ghost.js');
  }

  if (config.imageQuestionsGlobal) {
    files.push('data/image-questions/' + hyphenId + '.js');
  }

  // アプリ本体は必ず最後
  files.push('js/app.js');

  // ─── スクリプトを順次読み込む ────────────────────────────────────
  function loadNext(index) {
    if (index >= files.length) {
      // 全ファイル完了 → オーバーレイを非表示
      overlay.style.display = 'none';
      return;
    }

    var src = files[index];
    var script = document.createElement('script');
    script.src = src;

    script.onload = function () {
      loadNext(index + 1);
    };

    script.onerror = function () {
      // 存在しないファイル（tokorozawa など未ビルド時）はスキップして続行
      console.warn('[data-loader] 読み込みスキップ: ' + src);
      loadNext(index + 1);
    };

    document.head.appendChild(script);
  }

  loadNext(0);
})();
