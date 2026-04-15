# Fund Manager — AI-Powered Mutual Fund Portfolio Assistant

A full-stack web application for managing and analyzing personal mutual fund portfolios, featuring a rule-based quantitative decision engine, Claude AI chat advisor, and an OCR import pipeline that extracts holdings from screenshots.

![Tech Stack](https://img.shields.io/badge/React-19-61dafb?logo=react) ![Vite](https://img.shields.io/badge/Vite-5-646cff?logo=vite) ![Express](https://img.shields.io/badge/Express-5-000000?logo=express) ![Claude](https://img.shields.io/badge/Claude-Sonnet_4.6-d97706) ![Tesseract](https://img.shields.io/badge/Tesseract.js-7-green)

---

## Features

### Decision Engine
A 3-layer rule-based signal system that automatically categorizes every holding into one of four action pools:

| Pool | Signal | Recommendation |
|------|--------|---------------|
| **Hold** | Stable position, neutral market | No action needed |
| **Trade-T** | Sideways market + volatility | High-sell / low-buy within position |
| **Reduce** | High profit or bull+strong sector | Take partial profit |
| **Risk** | Deep loss or bear+weak sector | Set stop-loss |

Each recommendation includes plain-language reasoning and a risk note in Chinese.

### AI Investment Advisor
A streaming chat interface powered by `claude-sonnet-4-6`. The AI receives your live portfolio data, market sentiment, and decision-engine output as context — so every answer is grounded in your actual holdings, not generic advice.

### OCR Import Pipeline
Upload screenshots from your mobile banking app. Claude's vision API extracts fund name, code, amount, return rate, and sector automatically. Includes client-side image compression, per-image progress tracking, fuzzy-match deduplication, and a human-in-the-loop confirmation step before anything is written.

### Dashboard
- Live market sentiment panel (bull / sideways / bear)
- Portfolio overview: total value, weighted return, P&L
- Sector allocation pie chart
- Portfolio radar chart (return vs. risk vs. weight)
- Decision summary feed with AI-suggested actions

### Other
- Bilingual UI (Chinese / English)
- localStorage persistence — no database required
- Live NAV lookup via East Money API
- Manual fund entry as fallback to OCR

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, Vite 5, React Router 7, Chart.js 4 |
| Backend | Node.js, Express 5 |
| AI | Anthropic Claude SDK (`claude-sonnet-4-6`) |
| OCR | Claude Vision API (primary), Tesseract.js (fallback) |
| Styling | CSS custom properties design system, DM Mono + Outfit fonts |
| Persistence | Browser localStorage |

---

## Project Structure

```
fund/
├── app/
│   ├── server.js              # Express backend — /api/chat, /api/ocr-image, /api/fund-nav
│   ├── src/
│   │   ├── engine/
│   │   │   └── decisionEngine.js   # 3-layer quant decision engine
│   │   ├── pages/
│   │   │   ├── Dashboard.jsx       # Main portfolio overview
│   │   │   ├── OcrImport.jsx       # OCR import pipeline (5-state machine)
│   │   │   ├── Agent.jsx           # AI chat advisor
│   │   │   └── DecisionEngine.jsx  # Decision table page
│   │   ├── components/
│   │   │   ├── FundCard.jsx        # Individual fund card
│   │   │   ├── FundDetailModal.jsx # Fund detail + AI analysis modal
│   │   │   ├── FundEditModal.jsx   # Edit fund data modal
│   │   │   ├── FundPools.jsx       # Pool-grouped fund list
│   │   │   ├── SectorChart.jsx     # Sector pie chart
│   │   │   ├── RadarChart.jsx      # Portfolio radar chart
│   │   │   ├── MarketPanel.jsx     # Market sentiment panel
│   │   │   └── SuggestionsPanel.jsx # Quick action suggestions
│   │   ├── context/
│   │   │   ├── PortfolioContext.jsx # Global portfolio state + localStorage
│   │   │   └── LangContext.jsx     # i18n context
│   │   └── index.css              # Design token system (CSS custom properties)
│   └── package.json
└── doc/
    └── ocr-pipeline.md            # OCR pipeline technical documentation
```

---

## Getting Started

### Prerequisites

- Node.js 18+
- An [Anthropic API key](https://console.anthropic.com/)

### Installation

```bash
# Clone the repository
git clone https://github.com/your-username/fund-manager.git
cd fund-manager/app

# Install dependencies
npm install
```

### Configuration

Create a `.env` file in the `app/` directory:

```env
ANTHROPIC_API_KEY=sk-ant-...
```

### Running

```bash
# Start both frontend and backend with one command
cd app
npm run dev
```

Then open [http://localhost:5173](http://localhost:5173).

Alternatively, run them separately:

```bash
# Terminal 1 — backend (port 3001)
node app/server.js

# Terminal 2 — frontend (port 5173)
cd app && npm run dev:ui
```

### Build for Production

```bash
cd app
npm run build
```

---

## How It Works

### Decision Engine (3 Layers)

```
Layer 1: Market Signal     strong→bull | mid→sideways | weak→bear
         ↓
Layer 2: Sector Signal     hotSectors→strong | riskSectors→weak | else→neutral
         ↓
Layer 3: Position Signal   ≥15%→highProfit | ≥8%→profit | ≥-5%→flat | ≥-12%→loss | <-12%→deepLoss
         ↓
Decision Matrix  →  pool: hold | t | reduce | risk
```

### AI Chat — Context Injection

Every chat message sent to Claude includes a system prompt built from your live portfolio:

```
Current holdings: [fund list with returns]
Market: bull/sideways/bear, hot sectors, risk sectors
Decision engine output: [per-fund recommendations]
```

This means the AI can answer questions like *"Should I add to my tech position?"* with awareness of your current exposure and the market environment.

### OCR Pipeline

```
Upload image → Browser compression (Canvas, ≤1200px JPEG)
            → POST /api/ocr-image
            → Claude Vision extracts JSON
            → Deduplicate (within batch + against portfolio)
            → Human review & edit
            → Merge into portfolio
```

See [doc/ocr-pipeline.md](doc/ocr-pipeline.md) for full technical details.

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/chat` | Streaming AI chat (SSE), portfolio-aware |
| `POST` | `/api/ocr-image` | Extract fund data from image via Claude Vision |
| `POST` | `/api/fund-nav` | Fetch live NAV from East Money (with 10-min cache) |

---

## Design System

The UI uses a dark "Obsidian Quant" aesthetic built on CSS custom properties:

```css
--bg, --surface, --surface2, --surface3    /* Dark layer hierarchy */
--gold, --gold-dim, --gold-glow            /* Primary accent — gold */
--teal, --teal-dim                         /* Secondary accent — teal */
--up: #e05c5c   /* Gains (Chinese market: red = up) */
--down: #3dbf82 /* Losses (Chinese market: green = down) */
```

Numbers use `DM Mono` (tabular figures); UI text uses `Outfit`.

---

## License

MIT
