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
    { id: "north_america", label: "北米", countries: ["usa"] },
    { id: "south_america", label: "南米", countries: ["brazil"] },
    { id: "africa", label: "アフリカ", countries: ["nigeria"] },
    { id: "east_asia", label: "東アジア", countries: ["thailand", "philippines", "malaysia"] }
  ],
  countries: [
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
