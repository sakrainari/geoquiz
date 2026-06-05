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
    { id: "east_asia", label: "東アジア", countries: ["thailand", "philippines", "malaysia"] }
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
