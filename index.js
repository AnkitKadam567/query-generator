{
  "name": "angular-to-react-converter",
  "displayName": "Angular to React Converter",
  "description": "Convert Angular code to React using OpenAI",
  "version": "0.1.0",
  "engines": {
    "vscode": "^1.60.0"
  },
  "categories": [
    "Other"
  ],
  "main": "./extension.js",
  "contributes": {
    "commands": [
      {
        "command": "angular-to-react.convert",
        "title": "Convert Angular to React"
      }
    ],
    "viewsContainers": {
      "activitybar": [
        {
          "id": "angular-to-react-sidebar",
          "title": "Angular to React",
          "icon": "resources/icon.svg"
        }
      ]
    },
    "views": {
      "angular-to-react-sidebar": [
        {
          "id": "angular-to-react-sidebar-view",
          "name": "Converter",
          "type": "webview"
        }
      ]
    }
  },
  "scripts": {
    "lint": "eslint .",
    "pretest": "npm run lint",
    "test": "node ./test/runTest.js"
  },
  "devDependencies": {
    "@types/vscode": "^1.60.0",
    "eslint": "^8.18.0",
    "glob": "^8.0.3",
    "mocha": "^10.0.0"
  },
  "dependencies": {
    "axios": "^1.8.4"
  }
}
