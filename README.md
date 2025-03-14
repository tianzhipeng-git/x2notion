[English](./README.md) | [中文](./README_cn.md)

# X2Notion Chrome Extension

X2Notion Chrome browser extension that saves Twitter/X posts to a Notion Database

## Installation

### Developer Mode Installation

1. Download or clone this repository to your local machine
2. Open Chrome browser and go to the extensions page (chrome://extensions/)
3. Enable "Developer mode"
4. Click "Load unpacked extension"
5. Select the folder of this project

## How to Use

1. Create a new integration in Notion
   - Visit [Notion Integrations page](https://www.notion.so/my-integrations)
   - Create a new integration and get the API key

2. Create a new database in Notion with the following properties:
   - Name (Title, default)
   - URL (URL)
   - Type (Text)
   - Sender (Text)
   - PostDate (Date)
   - SaveDate (Date)

3. Share the database with your integration
   - Open the database in Notion
   - Click the "Share" button in the top right corner
   - Add your integration

4. Configure the extension
   - Click the X2Notion icon in the Chrome toolbar
   - Click the "Settings" button
   - Enter your Notion API key and database ID
   - Click "Save Settings"

5. Use the extension
   - Browse any webpage
   - Click the X2Notion icon in the Chrome toolbar
   - Choose "Save entire page" or "Save selection"

![](demo.png)