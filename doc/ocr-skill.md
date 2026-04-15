# OCR Import Pipeline — Technical Documentation

## Overview

The OCR Import Pipeline allows users to import mutual fund holdings by photographing or screenshotting their mobile banking app. It eliminates manual data entry by using **Claude's vision API** to extract structured financial data directly from images.

---

## Architecture

```
User drops image(s)
        │
        ▼
┌───────────────────────┐
│  1. Image Compression │  Canvas API — resize to ≤1200px, encode as JPEG base64
└──────────┬────────────┘
           │
           ▼
┌───────────────────────┐
│  2. POST /api/ocr-image│  Express endpoint — receives base64 payload
└──────────┬────────────┘
           │
           ▼
┌───────────────────────┐
│  3. Claude Vision API │  claude-sonnet-4-6 — structured JSON extraction
└──────────┬────────────┘
           │
           ▼
┌───────────────────────┐
│  4. Parse & Deduplicate│  Strip markdown, match JSON array, dedupe by name+code
└──────────┬────────────┘
           │
           ▼
┌───────────────────────┐
│  5. Conflict Detection│  Skip funds already in portfolio (fuzzy name match)
└──────────┬────────────┘
           │
           ▼
┌───────────────────────┐
│  6. Confirm & Edit    │  User reviews/edits rows, then merges into portfolio
└───────────────────────┘
```

---

## Step-by-Step Details

### Step 1 — Client-Side Image Compression

**File:** `app/src/pages/OcrImport.jsx` — `compressImage()`

Before sending to the server, each image is compressed in the browser using the Canvas API:

- Scale down to max 1200px on the longest edge
- Re-encode as JPEG at 85% quality
- Return `{ base64, mediaType }` (no file upload, just base64 string)

**Why:** Reduces payload size from several MB to ~200–400 KB per image, keeping API latency low.

```js
function compressImage(file, maxPx = 1200, quality = 0.85) {
  // draws onto canvas → exports as JPEG base64
}
```

---

### Step 2 — Staged File Queue

Users can upload up to **10 images** at once. Before processing, images enter a staging view where they can:
- Preview thumbnails
- Remove individual images
- Add more images

On confirmation, each image is processed **sequentially** (not in parallel) to avoid rate-limit issues with the Claude API.

---

### Step 3 — Claude Vision API Call

**File:** `app/server.js` — `POST /api/ocr-image`

The backend sends the compressed image to Claude with a structured extraction prompt:

**Model:** `claude-sonnet-4-6`  
**Input:** base64 image + text prompt  
**Output:** raw JSON array (no markdown, no commentary)

**Prompt instructs Claude to extract per fund:**

| Field       | Type    | Description                        |
|-------------|---------|------------------------------------|
| `name`      | string  | Fund name in Chinese               |
| `code`      | string  | 6-digit fund code (if visible)     |
| `amount`    | number  | Holdings in CNY (positive)         |
| `returnPct` | number  | Return rate %, e.g. `5.23`         |
| `returnAbs` | number  | Absolute return in CNY             |
| `sector`    | string  | One of: 科技/新能源/消费/医疗/金融/其他 |

```js
const msg = await anthropic.messages.create({
  model: 'claude-sonnet-4-6',
  max_tokens: 2048,
  messages: [{
    role: 'user',
    content: [
      { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } },
      { type: 'text',  text: prompt },
    ],
  }],
})
```

---

### Step 4 — Response Parsing

Claude returns a raw text response. The server extracts the JSON array using a regex (`/\[[\s\S]*\]/`) to handle any surrounding whitespace or unexpected wrapping:

```js
const raw       = msg.content[0].text.trim()
const jsonMatch = raw.match(/\[[\s\S]*\]/)
const funds     = jsonMatch ? JSON.parse(jsonMatch[0]) : []
```

Each fund object is then sanitized on the client side — null-safe, all numeric fields coerced to strings for controlled form input.

---

### Step 5 — Deduplication & Conflict Detection

Two deduplication passes run on the client:

**Pass 1 — Within-batch deduplication:**  
When processing multiple images that may show the same fund, deduplicate by `(name + code).toLowerCase()`.

**Pass 2 — Against existing portfolio:**  
For each extracted fund, check if it already exists in the portfolio:
- Exact match on `code` (if both non-empty), OR
- Fuzzy name match after normalizing brackets and whitespace

Funds that already exist are moved to a `skipped` list and shown in a warning banner — they are not silently overwritten.

```js
const normName = s => s
  .replace(/（/g, '(').replace(/）/g, ')')
  .replace(/\s+/g, '')
  .toLowerCase()
```

---

### Step 6 — Confirm & Edit UI

Before any data is written to state, users see a **confirmation table** with all extracted rows:

- Every field is editable inline
- Required fields (`name`, `amount`) are highlighted if empty
- Users can delete rows or add blank rows manually
- Sector can be adjusted via dropdown

On confirm, new records are appended and existing records (matched by code or name) are overwritten — a safe upsert into the portfolio.

---

## State Machine

The import flow is driven by a 5-state machine:

```
UPLOAD → STAGING → PROCESSING → CONFIRM → DONE
   ↑___________________________|  (reset at any point)
```

| State        | What happens                                       |
|--------------|----------------------------------------------------|
| `UPLOAD`     | Drop zone or manual entry tab                      |
| `STAGING`    | Preview images, add/remove before sending          |
| `PROCESSING` | Sequential API calls with per-image progress bars  |
| `CONFIRM`    | Review/edit extracted rows, handle skipped/errors  |
| `DONE`       | Success screen, navigate to Dashboard              |

---

## Error Handling

| Scenario                        | Behavior                                          |
|---------------------------------|---------------------------------------------------|
| Non-image file uploaded         | Client-side rejection with error banner           |
| Network / server error          | Per-image error status, pipeline continues        |
| Claude returns no JSON          | Empty array parsed, user sees "no data" warning   |
| Image unreadable / not a fund   | Claude returns `[]`, user prompted to re-upload   |
| Missing required fields         | Confirm button disabled until `name` + `amount` filled |

---

## Key Design Decisions

1. **Browser-side compression** — avoids uploading raw high-res photos; keeps server payload small.
2. **Sequential processing** — one image at a time prevents Claude API rate limiting when batch-uploading.
3. **JSON-only prompt** — instructing Claude to return bare JSON (no markdown) simplifies parsing and avoids wrapping artifacts.
4. **Fuzzy name deduplication** — full-width/half-width bracket normalization handles differences between what the screenshot shows and what the user previously typed.
5. **Always confirm before write** — no data is persisted until the user explicitly reviews and clicks "Confirm Import", reducing the risk of bad OCR silently corrupting portfolio data.

---

## Files Involved

| File | Role |
|------|------|
| `app/src/pages/OcrImport.jsx` | Full frontend pipeline: upload → staging → processing → confirm → done |
| `app/server.js` (`POST /api/ocr-image`) | Backend: receives base64, calls Claude Vision API, returns parsed funds |
| `app/src/context/PortfolioContext.jsx` | Persists final merged portfolio to localStorage |
