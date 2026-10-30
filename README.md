# MONARCH Wealth Simulator

MONARCH is a browser-based financial strategy simulator for exploring how a virtual portfolio can change over time. Start with **₹10 crore** in simulated capital, allocate it across investment categories, respond to simulated market scenarios, and track your portfolio and transactions.

> **MONARCH is a simulation only.** It does not provide real investment services, execute trades, offer financial advice, or display live market prices. Nothing in the app is a recommendation to buy or sell an asset.

## Live Demo

[Open MONARCH on GitHub Pages](https://hanubalapranavh.github.io/monarch-wealth-simulator/)

## Features

- **Wealth overview:** See net worth, available cash, invested value, unrealized profit and loss, and portfolio allocation.
- **Performance history:** Review saved net-worth history and select a time period when enough history is available. The chart uses recorded simulation history; it does not invent past data.
- **Investment simulator:** Buy and sell simulated stocks, real estate, gold, and business holdings. The app checks quantities and available funds.
- **Luxury marketplace:** Browse and purchase simulated lifestyle items using available cash.
- **Daily market scenarios:** Simulated events can affect prices in relevant asset categories. These are not live market updates.
- **Wealth goal:** Choose a milestone target and track progress using current simulated net worth. The selected target is saved in the browser.
- **Activity and history:** Review recent transactions, the full transaction history, and recorded market scenarios.
- **Saved progress:** Portfolio data is stored in browser `localStorage` and persists in the same browser and site origin.
- **Confirmed reset:** Resetting the simulation requires confirmation before restoring the starting portfolio.
- **Responsive interface:** Layouts adapt for desktop, tablet, and mobile screens.

## Screenshots

Current, publication-ready screenshots are not included yet. Add updated captures here when available.

| Desktop | Tablet | Mobile |
| --- | --- | --- |
| _Desktop screenshot placeholder_ | _Tablet screenshot placeholder_ | _Mobile screenshot placeholder_ |

Suggested file locations: `docs/screenshots/desktop.png`, `docs/screenshots/tablet.png`, and `docs/screenshots/mobile.png`.

## Run Locally with VS Code Live Server

1. Clone or download the project and open its folder in Visual Studio Code.
2. Install the **Live Server** extension if you do not already have it.
3. In the Explorer, right-click `index.html` and choose **Open with Live Server**, or select **Go Live** in the VS Code status bar.
4. The app opens in your browser. No build step, package installation, or backend server is required.

The app stores progress in the browser's `localStorage`. Local progress is separate for each browser and origin, so data from a local Live Server address will not automatically appear on the GitHub Pages demo.

## Technology

- HTML5
- CSS3, including responsive layouts and CSS custom properties
- Vanilla JavaScript
- SVG for the MONARCH mark and charts
- Browser `localStorage` for simulation and goal persistence
- Google Fonts for Cormorant Garamond and DM Mono, with CSS fallbacks

The app has no backend, external market-data API, or runtime package dependencies.

## Project Structure

```text
monarch-wealth-simulator/
├── assets/
│   └── monarch-mark.svg     # App mark and favicon
├── css/
│   ├── tokens.css           # Colors, typography, and spacing tokens
│   ├── shell.css            # App shell and navigation layout
│   ├── components.css       # Dashboard and app components
│   └── mobile.css           # Tablet and mobile breakpoints
├── js/
│   ├── data.js              # Simulation assets, events, and milestones
│   ├── engine.js            # Portfolio state, transactions, and persistence
│   ├── charts.js            # SVG chart rendering and history periods
│   └── app.js               # Rendering, navigation, and interactions
├── tests/
│   └── overview.test.js     # No-dependency checks for overview features
├── index.html               # Application entry point
└── README.md
```

## Run the Targeted Checks

With Node.js installed, run:

```bash
node tests/overview.test.js
```

To check JavaScript syntax in PowerShell:

```powershell
Get-ChildItem js,tests -Filter *.js -Recurse | ForEach-Object { node --check $_.FullName }
```
