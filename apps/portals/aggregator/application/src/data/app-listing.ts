import { IAppListingSearchRecordDto } from "../../../libs/features/listing/search/models/app-listing-search-record-dto.interface";


export const appListingSearchRecordsV2 = {
  "itemsNumber": 10,
  "groups": [
    {
      "id": 1,
      "name": "Group A",
      "entries": [
        {
          "id": 1,
          "groupId": 1,
          "name": "Entry 1A",
          "description": "This is the description for Entry 1A"
        },
        {
          "id": 2,
          "groupId": 1,
          "name": "Entry 2A",
          "description": "This is the description for Entry 2A"
        }
      ]
    },
    {
      "id": 2,
      "name": "Group B",
      "entries": [
        {
          "id": 3,
          "groupId": 2,
          "name": "Entry 1B",
          "description": "This is the description for Entry 1B"
        },
        {
          "id": 4,
          "groupId": 2,
          "name": "Entry 2B",
          "description": "This is the description for Entry 2B"
        },
        {
          "id": 5,
          "groupId": 2,
          "name": "Entry 3B",
          "description": "This is the description for Entry 3B"
        }
      ]
    },
    {
      "id": 3,
      "name": "Group C",
      "entries": [
        {
          "id": 6,
          "groupId": 3,
          "name": "Entry 1C",
          "description": "This is the description for Entry 1C"
        }
      ]
    }
  ]
}















export const appListingSearchRecords: any[] = [
  {
    id: 1,
    name: "LaserBeam Pro",
    description: "A powerful laser cutting tool for industrial use, offering precision and versatility.",
    rating: 4.5,
    tagIds: [
      { id: 1, name: "Precision" },
      { id: 2, name: "Industrial" }
    ],
    platformIds: [1, 3], // e.g., [1: "Windows", 3: "Linux"]
    deviceIds: [2, 4], // e.g., [2: "Desktop", 4: "Server"]
    associatedSuites: [
      { id: "101", name: "LaserSuite 1.0" },
      { id: "102", name: "LaserSuite Advanced" }
    ],
    groupId: 1
  },
  {
    id: 2,
    name: "SmartHouse AI",
    description: "Smart home system powered by AI, automating lighting, security, and temperature.",
    rating: 4.8,
    tagIds: [
      { id: 3, name: "SmartHome" },
      { id: 4, name: "AI" }
    ],
    platformIds: [2], // e.g., [2: "iOS"]
    deviceIds: [1, 3], // e.g., [1: "Mobile", 3: "Tablet"]
    associatedSuites: [
      { id: "103", name: "SmartHouse Hub" }
    ],
    groupId: 1
  },
  {
    id: 3,
    name: "GameMaster",
    description: "A gaming platform with multiple games, from adventure to strategy.",
    rating: 3.9,
    tagIds: [
      { id: 5, name: "Gaming" },
      { id: 6, name: "Multiplayer" }
    ],
    platformIds: [3, 4], // e.g., [3: "Linux", 4: "Windows"]
    deviceIds: [1, 2], // e.g., [1: "Mobile", 2: "Desktop"]
    associatedSuites: [
      { id: "104", name: "GameSuite 2025" }
    ],
    groupId: 1
  },
  {
    id: 4,
    name: "PhotoPro Editor",
    description: "Advanced photo editing software for professionals, offering wide range of features.",
    rating: 4.2,
    tagIds: [
      { id: 7, name: "Photography" },
      { id: 8, name: "Editing" }
    ],
    platformIds: [1], // e.g., [1: "Windows"]
    deviceIds: [2], // e.g., [2: "Desktop"]
    associatedSuites: [
      { id: "105", name: "PhotoPro Suite" }
    ]
  },
  {
    id: 5,
    name: "WeatherMaster",
    description: "Weather forecasting app that provides real-time and future forecasts for locations worldwide.",
    rating: 4.3,
    tagIds: [
      { id: 9, name: "Weather" },
      { id: 10, name: "Forecast" }
    ],
    platformIds: [2], // e.g., [2: "iOS"]
    deviceIds: [1, 3], // e.g., [1: "Mobile", 3: "Tablet"]
    associatedSuites: [
      { id: "106", name: "WeatherMaster Suite" }
    ],
    groupId: 1
  }
];
