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

  function slugifyRemotePart(value) {
    return String(value || '')
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
  }

  function parseRemoteAliases(value) {
    return String(value || '')
      .split('|')
      .map(function (item) { return item.trim(); })
      .filter(Boolean);
  }

  function formatRemoteNativeName(baseName, typeValue, typeMap) {
    var name = String(baseName || '').trim();
    if (!name) return '';
    if (!typeMap || !typeValue) return name;
    var template = typeMap[typeValue];
    if (!template) return name;
    if (template.indexOf('%s') >= 0) {
      return template.replace('%s', name);
    }
    return (name + ' ' + template).trim();
  }

  function readGeometryPoints(geometry, visit) {
    if (!geometry || !geometry.type || !geometry.coordinates) return;
    if (geometry.type === 'Polygon') {
      geometry.coordinates.forEach(function (ring) {
        ring.forEach(function (pt) { visit(pt[0], pt[1]); });
      });
      return;
    }
    if (geometry.type === 'MultiPolygon') {
      geometry.coordinates.forEach(function (polygon) {
        polygon.forEach(function (ring) {
          ring.forEach(function (pt) { visit(pt[0], pt[1]); });
        });
      });
    }
  }

  function geometryLabelPoint(geometry) {
    var minLng = Infinity;
    var maxLng = -Infinity;
    var minLat = Infinity;
    var maxLat = -Infinity;

    readGeometryPoints(geometry, function (lng, lat) {
      if (lng < minLng) minLng = lng;
      if (lng > maxLng) maxLng = lng;
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
    });

    if (!isFinite(minLng) || !isFinite(minLat)) return null;
    return [
      +(((minLat + maxLat) / 2).toFixed(6)),
      +(((minLng + maxLng) / 2).toFixed(6))
    ];
  }

  function buildIndonesiaKabupatenDataset(remoteConfig, geojson) {
    var sourceFeatures = Array.isArray(geojson && geojson.features) ? geojson.features.slice() : [];
    var nameCounts = {};
    var namedFeatures = sourceFeatures.map(function (feature) {
      var props = feature && feature.properties ? feature.properties : {};
      var aliases = parseRemoteAliases(props.VARNAME_2);
      var preferredAlias = aliases.find(function (alias) {
        return /^(Kabupaten|Kota)\s+/i.test(alias);
      });
      var displayName = preferredAlias || String(props.province || '').trim();
      nameCounts[displayName] = (nameCounts[displayName] || 0) + 1;
      return {
        feature: feature,
        aliases: aliases,
        displayName: displayName
      };
    });

    var duplicateIndexes = {};
    var features = [];
    var municipalities = [];

    namedFeatures.forEach(function (entry) {
      var feature = entry.feature;
      var displayName = entry.displayName;
      if (!displayName) return;

      var uniqueName = displayName;
      if (nameCounts[displayName] > 1) {
        duplicateIndexes[displayName] = (duplicateIndexes[displayName] || 0) + 1;
        uniqueName = displayName + ' ' + duplicateIndexes[displayName];
      }

      var id = remoteConfig.id + '_' + slugifyRemotePart(uniqueName);
      var labelPoint = geometryLabelPoint(feature.geometry);

      features.push({
        type: 'Feature',
        properties: {
          id: id,
          name: uniqueName,
          area_code: null,
          tags: entry.aliases,
          labelPoint: labelPoint,
          region: remoteConfig.remoteParentLabel || null
        },
        geometry: feature.geometry
      });

      municipalities.push({
        id: id,
        name: uniqueName,
        region: remoteConfig.remoteParentLabel || null
      });
    });

    municipalities.sort(function (a, b) {
      return a.name.localeCompare(b.name, 'ja');
    });
    features.sort(function (a, b) {
      return String(a.properties && a.properties.name || '').localeCompare(
        String(b.properties && b.properties.name || ''),
        'ja'
      );
    });

    return {
      id: remoteConfig.id,
      features: features,
      municipalities: municipalities
    };
  }

  function buildGenericAdminDataset(remoteConfig, geojson) {
    var sourceFeatures = Array.isArray(geojson && geojson.features) ? geojson.features.slice() : [];
    var nameProp = remoteConfig.remoteNameProperty || 'NAME_1';
    var aliasProp = remoteConfig.remoteAliasProperty || '';
    var regionProp = remoteConfig.remoteRegionProperty || '';
    var nativeNameProp = remoteConfig.remoteNativeNameProperty || '';
    var nativeTypeProp = remoteConfig.remoteNativeTypeProperty || '';
    var nativeTypeMap = remoteConfig.remoteNativeTypeMap || null;
    var idPrefix = remoteConfig.remoteItemIdPrefix || (remoteConfig.id + '_');
    var filterProp = remoteConfig.remoteFilterProperty || '';
    var filterValue = remoteConfig.remoteFilterValue;
    var filterValues = Array.isArray(remoteConfig.remoteFilterValues) ? remoteConfig.remoteFilterValues : null;

    if (filterProp && filterValues && filterValues.length) {
      sourceFeatures = sourceFeatures.filter(function (feature) {
        var props = feature && feature.properties ? feature.properties : {};
        var value = String(props[filterProp] || '').trim();
        return filterValues.some(function (item) {
          return value === String(item).trim();
        });
      });
    } else if (filterProp && filterValue != null) {
      sourceFeatures = sourceFeatures.filter(function (feature) {
        var props = feature && feature.properties ? feature.properties : {};
        return String(props[filterProp] || '').trim() === String(filterValue).trim();
      });
    }

    var features = [];
    var municipalities = [];
    var nameCounts = {};
    var prepared = [];

    sourceFeatures.forEach(function (feature) {
      var props = feature && feature.properties ? feature.properties : {};
      var name = String(props[nameProp] || '').trim();
      if (!name) return;
      var aliases = aliasProp ? parseRemoteAliases(props[aliasProp]) : [];
      var regionName = regionProp ? String(props[regionProp] || '').trim() || null : null;
      var nativeNameRaw = nativeNameProp ? String(props[nativeNameProp] || '').trim() : '';
      var nativeTypeRaw = nativeTypeProp ? String(props[nativeTypeProp] || '').trim() : '';
      var nativeName = formatRemoteNativeName(nativeNameRaw, nativeTypeRaw, nativeTypeMap);
      nameCounts[name] = (nameCounts[name] || 0) + 1;
      prepared.push({
        feature: feature,
        name: name,
        aliases: aliases,
        regionName: regionName,
        nativeName: nativeName || null
      });
    });

    var duplicateIndexes = {};
    prepared.forEach(function (entry) {
      var uniqueName = entry.name;
      if (nameCounts[entry.name] > 1) {
        duplicateIndexes[entry.name] = (duplicateIndexes[entry.name] || 0) + 1;
        if (entry.regionName) {
          uniqueName = entry.name + " (" + entry.regionName + ")";
        } else {
          uniqueName = entry.name + " " + duplicateIndexes[entry.name];
        }
      }
      var labelPoint = geometryLabelPoint(entry.feature.geometry);
      var id = slugifyRemotePart(idPrefix + uniqueName);

      features.push({
        type: 'Feature',
        properties: {
          id: id,
          name: uniqueName,
          name_native: entry.nativeName,
          area_code: null,
          tags: entry.aliases,
          labelPoint: labelPoint,
          region: entry.regionName
        },
        geometry: entry.feature.geometry
      });

      municipalities.push({
        id: id,
        name: uniqueName,
        name_native: entry.nativeName,
        region: entry.regionName
      });
    });

    municipalities.sort(function (a, b) {
      return a.name.localeCompare(b.name, 'ja');
    });
    features.sort(function (a, b) {
      return String(a.properties && a.properties.name || '').localeCompare(
        String(b.properties && b.properties.name || ''),
        'ja'
      );
    });

    return {
      id: remoteConfig.id,
      features: features,
      municipalities: municipalities
    };
  }

  function buildRemoteDataset(remoteConfig, geojson) {
    if (remoteConfig.remoteDataFormat === 'indonesia-kabupaten') {
      return buildIndonesiaKabupatenDataset(remoteConfig, geojson);
    }
    if (remoteConfig.remoteDataFormat === 'gadm-admin') {
      return buildGenericAdminDataset(remoteConfig, geojson);
    }
    throw new Error('未対応の remoteDataFormat: ' + remoteConfig.remoteDataFormat);
  }

  function ensureRemoteDatasetLoaded(remoteConfig) {
    if (!remoteConfig.remoteGeoJsonUrl) return Promise.resolve();

    label.textContent = 'リモートデータを取得しています…';
    return fetch(remoteConfig.remoteGeoJsonUrl)
      .then(function (response) {
        if (!response.ok) throw new Error('HTTP ' + response.status + ' ' + response.statusText);
        return response.json();
      })
      .then(function (geojson) {
        var payload = buildRemoteDataset(remoteConfig, geojson);
        window[remoteConfig.dataGlobal] = payload;
        if (remoteConfig.labelOverridesGlobal && !window[remoteConfig.labelOverridesGlobal]) {
          window[remoteConfig.labelOverridesGlobal] = {};
        }
        if (remoteConfig.speechReadingsGlobal && !window[remoteConfig.speechReadingsGlobal]) {
          window[remoteConfig.speechReadingsGlobal] = {};
        }
        label.textContent = 'アプリを起動しています…';
      });
  }

  var hyphenId = toHyphen(config.id);

  // ─── 読み込むファイルリストを構築 ───────────────────────────────
  var files = config.remoteGeoJsonUrl
    ? [
        'data/' + hyphenId + '/label-overrides.js',
        'data/' + hyphenId + '/speech-readings.js'
      ]
    : [
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

  ensureRemoteDatasetLoaded(config)
    .then(function () {
      loadNext(0);
    })
    .catch(function (error) {
      console.error('[data-loader] リモートデータ取得失敗:', error);
      label.textContent = 'リモートデータ取得に失敗しました。通信状況を確認して再読み込みしてください。';
    });
})();
