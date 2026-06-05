window.GEOQUIZ_CATALOG_V2 = {
  version: "0.1.0",
  quizModes: [
    { id: "municipality", label: "通常", description: "地図から対象を当てる標準モード" },
    { id: "confirm", label: "確認", description: "全体を見ながら位置関係を確認するモード" },
    { id: "ma", label: "Area Code", description: "番号からエリアを当てるモード" },
    { id: "confirm_ma", label: "Area Code確認", description: "市外局番エリアを一覧で確認するモード" },
    { id: "municipality_th", label: "タイ語名", description: "タイ語の正式名称で当てるモード" },
    { id: "municipality_th_abbr", label: "タイ語略称", description: "タイ語の略称で当てるモード" },
    { id: "puzzle", label: "パズル", description: "位置を戻して覚えるモード" }
  ],
  regions: [
    { id: "japan", label: "日本", countries: ["japan"] },
    { id: "north_america", label: "北米", countries: ["usa"] },
    { id: "south_america", label: "南米", countries: ["brazil"] },
    { id: "africa", label: "アフリカ", countries: ["nigeria"] },
    { id: "east_asia", label: "東アジア", countries: ["thailand", "philippines", "malaysia", "indonesia"] },
    { id: "europe", label: "欧州", countries: ["spain", "france", "poland", "ukraine", "germany"] }
  ],
  countries: [
    {
      id: "japan",
      label: "Japan",
      summary: "Regional Sets",
      region: "japan",
      defaultDatasetId: "kanto_all",
      layers: [
        {
          id: "hokkaido",
          label: "北海道",
          kind: "region_set",
          kindLabel: "地域セット",
          enabledQuizModes: ["municipality", "ma", "confirm", "confirm_ma"],
          defaultDatasetId: "hokkaido_all",
          datasets: [
            { id: "hokkaido_all", label: "全域", coverage: "region" },
            { id: "hokkaido_doo", label: "道央", coverage: "subregion" },
            { id: "hokkaido_donan", label: "道南", coverage: "subregion" },
            { id: "hokkaido_dohoku", label: "道北", coverage: "subregion" },
            { id: "hokkaido_doto", label: "道東", coverage: "subregion" }
          ]
        },
        {
          id: "tohoku",
          label: "東北",
          kind: "region_set",
          kindLabel: "地域セット",
          enabledQuizModes: ["municipality", "ma", "confirm", "confirm_ma"],
          defaultDatasetId: "tohoku_all",
          datasets: [
            { id: "tohoku_all", label: "全域", coverage: "region" },
            { id: "aomori", label: "青森", coverage: "prefecture" },
            { id: "iwate", label: "岩手", coverage: "prefecture" },
            { id: "miyagi", label: "宮城", coverage: "prefecture" },
            { id: "akita", label: "秋田", coverage: "prefecture" },
            { id: "yamagata", label: "山形", coverage: "prefecture" },
            { id: "fukushima", label: "福島", coverage: "prefecture" }
          ]
        },
        {
          id: "kanto",
          label: "関東",
          kind: "region_set",
          kindLabel: "地域セット",
          enabledQuizModes: ["municipality", "ma", "confirm", "confirm_ma"],
          defaultDatasetId: "kanto_all",
          datasets: [
            { id: "kanto_all", label: "全域", coverage: "region" },
            { id: "tokyo", label: "東京23区", coverage: "subregion" },
            { id: "tokyo_all", label: "東京都全域", coverage: "prefecture" },
            { id: "tokyo_islands", label: "東京諸島", coverage: "subregion" },
            { id: "saitama", label: "埼玉", coverage: "prefecture" },
            { id: "chiba", label: "千葉", coverage: "prefecture" },
            { id: "kanagawa", label: "神奈川", coverage: "prefecture" },
            { id: "ibaraki", label: "茨城", coverage: "prefecture" },
            { id: "gunma", label: "群馬", coverage: "prefecture" },
            { id: "tochigi", label: "栃木", coverage: "prefecture" }
          ]
        },
        {
          id: "chubu",
          label: "中部",
          kind: "region_set",
          kindLabel: "地域セット",
          enabledQuizModes: ["municipality", "ma", "confirm", "confirm_ma"],
          defaultDatasetId: "chubu_all",
          datasets: [
            { id: "chubu_all", label: "全域", coverage: "region" },
            { id: "niigata", label: "新潟", coverage: "prefecture" },
            { id: "toyama", label: "富山", coverage: "prefecture" },
            { id: "ishikawa", label: "石川", coverage: "prefecture" },
            { id: "fukui", label: "福井", coverage: "prefecture" },
            { id: "yamanashi", label: "山梨", coverage: "prefecture" },
            { id: "nagano", label: "長野", coverage: "prefecture" },
            { id: "gifu", label: "岐阜", coverage: "prefecture" },
            { id: "shizuoka", label: "静岡", coverage: "prefecture" },
            { id: "aichi", label: "愛知", coverage: "prefecture" }
          ]
        },
        {
          id: "kinki",
          label: "近畿",
          kind: "region_set",
          kindLabel: "地域セット",
          enabledQuizModes: ["municipality", "ma", "confirm", "confirm_ma"],
          defaultDatasetId: "kinki_all",
          datasets: [
            { id: "kinki_all", label: "全域", coverage: "region" },
            { id: "mie", label: "三重", coverage: "prefecture" },
            { id: "shiga", label: "滋賀", coverage: "prefecture" },
            { id: "kyoto", label: "京都", coverage: "prefecture" },
            { id: "osaka", label: "大阪", coverage: "prefecture" },
            { id: "hyogo", label: "兵庫", coverage: "prefecture" },
            { id: "nara", label: "奈良", coverage: "prefecture" },
            { id: "wakayama", label: "和歌山", coverage: "prefecture" }
          ]
        },
        {
          id: "chugoku",
          label: "中国",
          kind: "region_set",
          kindLabel: "地域セット",
          enabledQuizModes: ["municipality", "ma", "confirm", "confirm_ma"],
          defaultDatasetId: "chugoku_all",
          datasets: [
            { id: "chugoku_all", label: "全域", coverage: "region" },
            { id: "tottori", label: "鳥取", coverage: "prefecture" },
            { id: "shimane", label: "島根", coverage: "prefecture" },
            { id: "okayama", label: "岡山", coverage: "prefecture" },
            { id: "hiroshima", label: "広島", coverage: "prefecture" },
            { id: "yamaguchi", label: "山口", coverage: "prefecture" }
          ]
        },
        {
          id: "shikoku",
          label: "四国",
          kind: "region_set",
          kindLabel: "地域セット",
          enabledQuizModes: ["municipality", "ma", "confirm", "confirm_ma"],
          defaultDatasetId: "shikoku_all",
          datasets: [
            { id: "shikoku_all", label: "全域", coverage: "region" },
            { id: "tokushima", label: "徳島", coverage: "prefecture" },
            { id: "kagawa", label: "香川", coverage: "prefecture" },
            { id: "ehime", label: "愛媛", coverage: "prefecture" },
            { id: "kochi", label: "高知", coverage: "prefecture" }
          ]
        },
        {
          id: "kyushu",
          label: "九州",
          kind: "region_set",
          kindLabel: "地域セット",
          enabledQuizModes: ["municipality", "ma", "confirm", "confirm_ma"],
          defaultDatasetId: "kyushu_all",
          datasets: [
            { id: "kyushu_all", label: "全域", coverage: "region" },
            { id: "fukuoka", label: "福岡", coverage: "prefecture" },
            { id: "saga", label: "佐賀", coverage: "prefecture" },
            { id: "nagasaki", label: "長崎", coverage: "prefecture" },
            { id: "kumamoto", label: "熊本", coverage: "prefecture" },
            { id: "oita", label: "大分", coverage: "prefecture" },
            { id: "miyazaki", label: "宮崎", coverage: "prefecture" },
            { id: "kagoshima", label: "鹿児島", coverage: "prefecture" }
          ]
        },
        {
          id: "okinawa",
          label: "沖縄",
          kind: "region_set",
          kindLabel: "地域セット",
          enabledQuizModes: ["municipality", "ma", "confirm", "confirm_ma"],
          datasetId: "okinawa",
          datasets: [
            { id: "okinawa", label: "沖縄", coverage: "prefecture" }
          ]
        }
      ]
    },
    {
      id: "usa",
      label: "USA",
      summary: "State / Area Code",
      region: "north_america",
      defaultDatasetId: "usa",
      layers: [
        {
          id: "admin1",
          label: "State",
          kind: "admin",
          kindLabel: "州",
          datasetId: "usa",
          enabledQuizModes: ["municipality", "confirm"]
        },
        {
          id: "area_code",
          label: "Area Code",
          kind: "area_code",
          kindLabel: "Area Code",
          defaultDatasetId: "usa_area_codes",
          enabledQuizModes: ["municipality", "confirm"],
          datasets: [
            { id: "usa_area_codes", label: "全米", coverage: "country" },
            { id: "usa_area_codes_west", label: "西部", coverage: "subregion" },
            { id: "usa_area_codes_midwest", label: "中西部", coverage: "subregion" },
            { id: "usa_area_codes_south", label: "南部", coverage: "subregion" },
            { id: "usa_area_codes_northeast", label: "北東部", coverage: "subregion" },
            { id: "usa_area_codes_california", label: "California", coverage: "state" }
          ]
        }
      ]
    },
    {
      id: "brazil",
      label: "Brazil",
      summary: "State / Area Code",
      region: "south_america",
      defaultDatasetId: "brazil",
      layers: [
        {
          id: "admin1",
          label: "State",
          kind: "admin",
          kindLabel: "州",
          datasetId: "brazil",
          enabledQuizModes: ["municipality", "confirm"]
        },
        {
          id: "area_code",
          label: "Area Code",
          kind: "area_code",
          kindLabel: "Area Code",
          datasetId: "brazil_area_codes",
          enabledQuizModes: ["municipality", "confirm"]
        }
      ]
    },
    {
      id: "spain",
      label: "Spain",
      summary: "自治州 / 県 / Area Code",
      region: "europe",
      defaultDatasetId: "spain",
      layers: [
        {
          id: "admin1",
          label: "自治州",
          kind: "admin",
          kindLabel: "自治州",
          datasetId: "spain",
          enabledQuizModes: ["municipality", "confirm"]
        },
        {
          id: "admin2",
          label: "Province",
          kind: "admin",
          kindLabel: "県",
          datasetId: "spain_provinces",
          enabledQuizModes: ["municipality", "confirm"]
        },
        {
          id: "area_code",
          label: "Area Code",
          kind: "area_code",
          kindLabel: "Area Code",
          datasetId: "spain_area_codes",
          enabledQuizModes: ["municipality", "confirm"]
        }
      ]
    },
    {
      id: "france",
      label: "France",
      summary: "地域圏 / 県 / Area Code",
      region: "europe",
      defaultDatasetId: "france",
      layers: [
        {
          id: "admin1",
          label: "地域圏",
          kind: "admin",
          kindLabel: "地域圏",
          datasetId: "france",
          enabledQuizModes: ["municipality", "confirm"]
        },
        {
          id: "admin2",
          label: "Department",
          kind: "admin",
          kindLabel: "県",
          datasetId: "france_departments",
          enabledQuizModes: ["municipality", "confirm"]
        },
        {
          id: "area_code",
          label: "Area Code",
          kind: "area_code",
          kindLabel: "Area Code",
          datasetId: "france_area_codes",
          enabledQuizModes: ["municipality", "confirm"]
        }
      ]
    },
    {
      id: "poland",
      label: "Poland",
      summary: "State / Area Code",
      region: "europe",
      defaultDatasetId: "poland",
      layers: [
        {
          id: "admin1",
          label: "State",
          kind: "admin",
          kindLabel: "州",
          datasetId: "poland",
          enabledQuizModes: ["municipality", "confirm"]
        },
        {
          id: "area_code",
          label: "Area Code",
          kind: "area_code",
          kindLabel: "Area Code",
          datasetId: "poland_area_codes",
          enabledQuizModes: ["municipality", "confirm"]
        }
      ]
    },
    {
      id: "ukraine",
      label: "Ukraine",
      summary: "Area Code",
      region: "europe",
      defaultDatasetId: "ukraine_area_codes",
      layers: [
        {
          id: "area_code",
          label: "Area Code",
          kind: "area_code",
          kindLabel: "Area Code",
          datasetId: "ukraine_area_codes",
          enabledQuizModes: ["municipality", "confirm"]
        }
      ]
    },
    {
      id: "germany",
      label: "Germany",
      summary: "State / Landkreis",
      region: "europe",
      defaultDatasetId: "germany",
      layers: [
        {
          id: "admin1",
          label: "State",
          kind: "admin",
          kindLabel: "州",
          datasetId: "germany",
          enabledQuizModes: ["municipality", "confirm"]
        },
        {
          id: "landkreise",
          label: "Landkreis",
          kind: "admin",
          kindLabel: "Landkreis",
          defaultDatasetId: "germany_landkreise_baden_wurttemberg",
          enabledQuizModes: ["municipality", "confirm"],
          datasets: [
            { id: "germany_landkreise_baden_wurttemberg", label: "Baden-Württemberg", coverage: "state" },
            { id: "germany_landkreise_bayern", label: "Bayern", coverage: "state" },
            { id: "germany_landkreise_berlin", label: "Berlin", coverage: "state" },
            { id: "germany_landkreise_brandenburg", label: "Brandenburg", coverage: "state" },
            { id: "germany_landkreise_bremen", label: "Bremen", coverage: "state" },
            { id: "germany_landkreise_hamburg", label: "Hamburg", coverage: "state" },
            { id: "germany_landkreise_hessen", label: "Hessen", coverage: "state" },
            { id: "germany_landkreise_mecklenburg_vorpommern", label: "Mecklenburg-Vorpommern", coverage: "state" },
            { id: "germany_landkreise_niedersachsen", label: "Niedersachsen", coverage: "state" },
            { id: "germany_landkreise_nordrhein_westfalen", label: "Nordrhein-Westfalen", coverage: "state" },
            { id: "germany_landkreise_rheinland_pfalz", label: "Rheinland-Pfalz", coverage: "state" },
            { id: "germany_landkreise_saarland", label: "Saarland", coverage: "state" },
            { id: "germany_landkreise_sachsen", label: "Sachsen", coverage: "state" },
            { id: "germany_landkreise_sachsen_anhalt", label: "Sachsen-Anhalt", coverage: "state" },
            { id: "germany_landkreise_schleswig_holstein", label: "Schleswig-Holstein", coverage: "state" },
            { id: "germany_landkreise_thuringen", label: "Thüringen", coverage: "state" }
          ]
        }
      ]
    },
    {
      id: "indonesia",
      label: "Indonesia",
      summary: "State / Kabupaten",
      region: "east_asia",
      defaultDatasetId: "indonesia",
      layers: [
        {
          id: "admin1",
          label: "State",
          kind: "admin",
          kindLabel: "州",
          datasetId: "indonesia",
          enabledQuizModes: ["municipality", "confirm"]
        },
        {
          id: "kabupaten",
          label: "Kabupaten",
          kind: "admin",
          kindLabel: "Kabupaten",
          defaultDatasetId: "indonesia_kabupaten_java",
          enabledQuizModes: ["municipality", "confirm"],
          datasets: [
            { id: "indonesia_kabupaten_java", label: "Java", coverage: "subregion" },
            { id: "indonesia_kabupaten_sumatra", label: "Sumatra", coverage: "subregion" },
            { id: "indonesia_kabupaten_kalimantan", label: "Kalimantan", coverage: "subregion" },
            { id: "indonesia_kabupaten_sulawesi", label: "Sulawesi", coverage: "subregion" },
            { id: "indonesia_kabupaten_nusa_tenggara", label: "Nusa Tenggara", coverage: "subregion" },
            { id: "indonesia_kabupaten_maluku", label: "Maluku", coverage: "subregion" },
            { id: "indonesia_kabupaten_papua", label: "Papua", coverage: "subregion" },
            { id: "indonesia_kabupaten_aceh", label: "Aceh", coverage: "state" },
            { id: "indonesia_kabupaten_bali", label: "Bali", coverage: "state" },
            { id: "indonesia_kabupaten_bangka_belitung", label: "Bangka-Belitung", coverage: "state" },
            { id: "indonesia_kabupaten_banten", label: "Banten", coverage: "state" },
            { id: "indonesia_kabupaten_bengkulu", label: "Bengkulu", coverage: "state" },
            { id: "indonesia_kabupaten_gorontalo", label: "Gorontalo", coverage: "state" },
            { id: "indonesia_kabupaten_papua_barat", label: "Papua Barat", coverage: "state" },
            { id: "indonesia_kabupaten_jakarta_raya", label: "Jakarta Raya", coverage: "state" },
            { id: "indonesia_kabupaten_jambi", label: "Jambi", coverage: "state" },
            { id: "indonesia_kabupaten_jawa_barat", label: "Jawa Barat", coverage: "state" },
            { id: "indonesia_kabupaten_jawa_tengah", label: "Jawa Tengah", coverage: "state" },
            { id: "indonesia_kabupaten_jawa_timur", label: "Jawa Timur", coverage: "state" },
            { id: "indonesia_kabupaten_kalimantan_barat", label: "Kalimantan Barat", coverage: "state" },
            { id: "indonesia_kabupaten_kalimantan_selatan", label: "Kalimantan Selatan", coverage: "state" },
            { id: "indonesia_kabupaten_kalimantan_tengah", label: "Kalimantan Tengah", coverage: "state" },
            { id: "indonesia_kabupaten_kalimantan_timur", label: "Kalimantan Timur", coverage: "state" },
            { id: "indonesia_kabupaten_kalimantan_utara", label: "Kalimantan Utara", coverage: "state" },
            { id: "indonesia_kabupaten_kepulauan_riau", label: "Kepulauan Riau", coverage: "state" },
            { id: "indonesia_kabupaten_lampung", label: "Lampung", coverage: "state" },
            { id: "indonesia_kabupaten_maluku", label: "Maluku", coverage: "state" },
            { id: "indonesia_kabupaten_maluku_utara", label: "Maluku Utara", coverage: "state" },
            { id: "indonesia_kabupaten_nusa_tenggara_barat", label: "Nusa Tenggara Barat", coverage: "state" },
            { id: "indonesia_kabupaten_nusa_tenggara_timur", label: "Nusa Tenggara Timur", coverage: "state" },
            { id: "indonesia_kabupaten_papua", label: "Papua", coverage: "state" },
            { id: "indonesia_kabupaten_riau", label: "Riau", coverage: "state" },
            { id: "indonesia_kabupaten_sulawesi_barat", label: "Sulawesi Barat", coverage: "state" },
            { id: "indonesia_kabupaten_sulawesi_selatan", label: "Sulawesi Selatan", coverage: "state" },
            { id: "indonesia_kabupaten_sulawesi_tengah", label: "Sulawesi Tengah", coverage: "state" },
            { id: "indonesia_kabupaten_sulawesi_tenggara", label: "Sulawesi Tenggara", coverage: "state" },
            { id: "indonesia_kabupaten_sulawesi_utara", label: "Sulawesi Utara", coverage: "state" },
            { id: "indonesia_kabupaten_sumatera_barat", label: "Sumatera Barat", coverage: "state" },
            { id: "indonesia_kabupaten_sumatera_selatan", label: "Sumatera Selatan", coverage: "state" },
            { id: "indonesia_kabupaten_sumatera_utara", label: "Sumatera Utara", coverage: "state" },
            { id: "indonesia_kabupaten_yogyakarta", label: "Yogyakarta", coverage: "state" }
          ]
        }
      ]
    },
    {
      id: "nigeria",
      label: "Nigeria",
      summary: "State",
      region: "africa",
      defaultDatasetId: "nigeria",
      layers: [
        {
          id: "admin1",
          label: "State",
          kind: "admin",
          kindLabel: "州",
          datasetId: "nigeria",
          enabledQuizModes: ["municipality", "confirm"]
        }
      ]
    },
    {
      id: "thailand",
      label: "Thailand",
      summary: "Province",
      region: "east_asia",
      defaultDatasetId: "thailand",
      layers: [
        {
          id: "admin1",
          label: "Province",
          kind: "admin",
          kindLabel: "県",
          datasetId: "thailand",
          enabledQuizModes: ["municipality", "municipality_th", "municipality_th_abbr", "confirm"]
        }
      ]
    },
    {
      id: "philippines",
      label: "Philippines",
      summary: "Province",
      region: "east_asia",
      defaultDatasetId: "philippines",
      layers: [
        {
          id: "admin1",
          label: "Province",
          kind: "admin",
          kindLabel: "州",
          datasetId: "philippines",
          enabledQuizModes: ["municipality", "confirm"]
        }
      ]
    },
    {
      id: "malaysia",
      label: "Malaysia",
      summary: "State",
      region: "east_asia",
      defaultDatasetId: "malaysia",
      layers: [
        {
          id: "admin1",
          label: "State",
          kind: "admin",
          kindLabel: "州",
          datasetId: "malaysia",
          enabledQuizModes: ["municipality", "confirm"]
        }
      ]
    }
  ]
};
