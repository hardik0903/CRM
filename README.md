# AI-Powered CSV Importer for GrowEasy CRM

An AI-powered CSV import tool that accepts CSV files with different column names, layouts, and structures, then maps lead data into the GrowEasy CRM format using Google Gemini.

## Features

- Upload CSV files with drag and drop or file picker
- Preview parsed CSV data before any AI processing
- Confirm import before calling the backend
- Extract GrowEasy CRM records with Gemini
- Batch AI processing with retries
- Skip invalid rows that have no valid email or mobile number
- Display imported and skipped records in responsive tables
- Export parsed CRM records as CSV
- Dark and light mode
- Docker setup
- Backend unit tests

## Tech Stack

| Layer | Technology |
| --- | --- |
| Frontend | Next.js, React, TypeScript |
| Backend | Node.js, Express, TypeScript |
| CSV parsing | PapaParse |
| AI | Google Gemini |
| Uploads | Multer |
| Testing | Jest |
| Containerization | Docker, Docker Compose |

## CRM Fields

The importer extracts the following fields when available:

- `created_at`
- `name`
- `email`
- `country_code`
- `mobile_without_country_code`
- `company`
- `city`
- `state`
- `country`
- `lead_owner`
- `crm_status`
- `crm_note`
- `data_source`
- `possession_time`
- `description`

Allowed `crm_status` values:

- `GOOD_LEAD_FOLLOW_UP`
- `DID_NOT_CONNECT`
- `BAD_LEAD`
- `SALE_DONE`

Allowed `data_source` values:

- `leads_on_demand`
- `meridian_tower`
- `eden_park`
- `varah_swamy`
- `sarjapur_plots`

## How It Works

1. Upload a CSV file.
2. The frontend parses the CSV locally and shows a preview table.
3. Click **Confirm Import** to send the file to the backend.
4. The backend parses the CSV and sends records to Gemini in batches.
5. Gemini maps fields into the GrowEasy CRM schema.
6. The backend validates and sanitizes AI output.
7. The frontend displays imported records, skipped records, and totals.

Rows with neither a valid email nor a valid mobile number are skipped.

## Prerequisites

- Node.js 18 or newer
- npm 9 or newer
- Google Gemini API key

Create a Gemini API key from Google AI Studio:

https://aistudio.google.com/apikey

## Local Setup

### Backend

```bash
cd backend
npm install
```

Create `backend/.env`:

```env
GEMINI_API_KEY=your_gemini_api_key_here
PORT=3001
FRONTEND_URL=http://localhost:3000
```

Start the backend:

```bash
npm run dev
```

The backend runs at:

```text
http://localhost:3001
```

### Frontend

```bash
cd frontend
npm install
```

Create `frontend/.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:3001/api
```

Start the frontend:

```bash
npm run dev
```

The frontend runs at:

```text
http://localhost:3000
```

## Docker Setup

Set your Gemini API key and start both services:

```bash
GEMINI_API_KEY=your_gemini_api_key_here docker-compose up --build
```

Frontend:

```text
http://localhost:3000
```

Backend:

```text
http://localhost:3001
```

## API

### `POST /api/import`

Accepts a CSV file upload using form-data field `file`.

Response:

```json
{
  "records": [],
  "skipped": [],
  "totalImported": 0,
  "totalSkipped": 0
}
```

## Tests and Checks

Backend tests:

```bash
cd backend
npm test
```

Backend typecheck:

```bash
cd backend
npm run typecheck
```

Frontend lint:

```bash
cd frontend
npm run lint
```

Frontend production build:

```bash
cd frontend
npm run build
```

## Project Structure

```text
backend/
  src/
    routes/
      import.ts
    services/
      aiExtractor.ts
      csvParser.ts
    types/
      crm.ts
    utils/
      prompt.ts
frontend/
  src/
    app/
    components/
    lib/
    types/
test-data/
docker-compose.yml
README.md
```

## Test Data

The `test-data` folder includes sample CSV files for:

- Standard clean CRM data
- Facebook lead exports
- Google Ads exports
- Real estate CRM exports
- Messy manually created spreadsheets

These files are useful for checking AI mapping behavior across different layouts.
