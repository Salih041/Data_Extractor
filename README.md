# Table Data Extractor & AI Assistant

A Chrome Extension (Manifest V3) that extracts tabular data from web pages, exports it as JSON, and analyzes records with an integrated Groq AI assistant.

---

## Features

- **Table Detection**: Automatically identifies tables on the active web page and lists available columns.
- **Custom Selection**: Select or deselect specific columns and rows before exporting.
- **JSON Export**: Preview extracted data directly in the popup, copy it to the clipboard, or download it as a `.json` file.
- **AI Assistant**: Query Groq Cloud models (`openai/gpt-oss-120b`) with table context to generate summaries, risk assessments, or mechanism analyses.
- **Configurable Backend**: Easily switch backend endpoints between local development (`http://localhost:3000`) and remote servers directly from the popup UI.

---

## Installation

1. Clone or download this repository.
2. Open Google Chrome and navigate to `chrome://extensions`.
3. Enable **Developer mode** using the toggle in the top-right corner.
4. Click **Load unpacked** in the top-left corner.
5. Select this `extension` directory.

---

## Backend Configuration

By default, the extension connects to `http://localhost:3000`.

- To point the extension to your custom backend server, open the extension popup and click **Target: Edit**.
- Type your backend URL and click **Save**.
- The URL is saved in `chrome.storage.local` and persists across browser sessions.

---

## Project Structure

```text
extension/
├── icons/             # Extension icons (16px, 32px, 48px, 128px)
├── popup/             # Popup user interface (HTML, CSS, JS)
├── scripts/
│   ├── background.js  # Service worker for network communication
│   └── content.js     # Content script for table DOM inspection
├── manifest.json      # Chrome Manifest V3 configuration
├── .gitignore         # Git ignore rules
└── README.md          # Extension documentation
```
