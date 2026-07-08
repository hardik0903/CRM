# AI-Powered CSV Importer for GrowEasy CRM

An intelligent CSV import tool that uses AI (Google Gemini) to automatically map and extract CRM lead information from any CSV format — regardless of column names, layouts, or structures.

![Tech Stack](https://img.shields.io/badge/Frontend-Next.js-black?style=for-the-badge&logo=next.js)
![Tech Stack](https://img.shields.io/badge/Backend-Express.js-000000?style=for-the-badge&logo=express)
![Tech Stack](https://img.shields.io/badge/AI-Google%20Gemini-4285F4?style=for-the-badge&logo=google)
![Tech Stack](https://img.shields.io/badge/Language-TypeScript-3178C6?style=for-the-badge&logo=typescript)

## ✨ Features

- **Universal CSV Import** — Works with any CSV format (Facebook Leads, Google Ads, Excel exports, custom spreadsheets)
- **AI-Powered Mapping** — Uses Google Gemini to intelligently map arbitrary columns to CRM fields
- **Drag & Drop Upload** — Beautiful drag-and-drop interface with file validation
- **Live CSV Preview** — Responsive table with sticky headers and scrolling
- **Batch Processing** — Processes large CSVs in batches of 50 records
- **Retry Mechanism** — Automatic retry with exponential backoff for failed AI batches
- **Dark Mode** — Premium dark/light mode toggle
- **Responsive Design** — Works beautifully on desktop, tablet, and mobile
- **Export Results** — Download extracted CRM records as CSV

## 🛠 Tech Stack

| Layer       | Technology                        |
|-------------|-----------------------------------|
| Frontend    | Next.js 15 (App Router), TypeScript |
| Backend     | Node.js, Express.js, TypeScript   |
| CSV Parsing | PapaParse                         |
| AI          | Google Gemini (gemini-3.1-flash-lite)  |
| File Upload | Multer (server), HTML5 Drag & Drop |
| Container   | Docker + Docker Compose           |

## 📋 Prerequisites

- **Node.js** >= 18.x
- **npm** >= 9.x
- **Google Gemini API Key** — Get one free at [Google AI Studio](https://aistudio.google.com/apikey)

## 🚀 Quick Start

### 1. Clone the Repository

```bash
git clone https://github.com/YOUR_USERNAME/csv-importer.git
cd csv-importer
```

### 2. Setup Backend

```bash
cd backend
npm install
```

Create a `.env` file:

```env
GEMINI_API_KEY=your_gemini_api_key_here
PORT=3001
FRONTEND_URL=http://localhost:3000
```

Start the backend:

```bash
npm run dev
```

The backend runs on **http://localhost:3001**.

### 3. Setup Frontend

Open a new terminal:

```bash
cd frontend
npm install
```

Create a `.env.local` file:

```env
NEXT_PUBLIC_API_URL=http://localhost:3001/api
```

Start the frontend:

```bash
npm run dev
```

The frontend runs on **http://localhost:3000**.

### 4. Open the App

Navigate to [http://localhost:3000](http://localhost:3000) in your browser.

## 🐳 Docker Setup

Run both services with Docker Compose:

```bash
# Set your API key
export GEMINI_API_KEY=your_gemini_api_key_here

# Build and run
docker-compose up --build
```

Access the app at **http://localhost:3000**.

## 📁 Project Structure

```
├── frontend/                 # Next.js Frontend
│   ├── src/
│   │   ├── app/              # App Router pages
│   │   │   ├── layout.tsx    # Root layout with theme
│   │   │   ├── page.tsx      # Main wizard page
│   │   │   └── globals.css   # Design system
│   │   ├── components/       # React components
│   │   │   ├── FileUpload.tsx
│   │   │   ├── DataTable.tsx
│   │   │   ├── ResultsView.tsx
│   │   │   ├── StepIndicator.tsx
│   │   │   └── ThemeToggle.tsx
│   │   ├── lib/              # Utilities
│   │   │   ├── api.ts
│   │   │   └── csvPreview.ts
│   │   └── types/            # TypeScript types
│   │       └── index.ts
│   ├── Dockerfile
│   └── package.json
│
├── backend/                  # Express.js Backend
│   ├── src/
│   │   ├── index.ts          # Server entry point
│   │   ├── routes/
│   │   │   └── import.ts     # Import API route
│   │   ├── services/
│   │   │   ├── aiExtractor.ts
│   │   │   └── csvParser.ts
│   │   ├── utils/
│   │   │   └── prompt.ts     # AI prompt template
│   │   └── types/
│   │       └── crm.ts        # CRM type definitions
│   ├── Dockerfile
│   └── package.json
│
├── docker-compose.yml
├── .gitignore
└── README.md
```

## 🎯 How It Works

1. **Upload** — Drag & drop or browse for a CSV file
2. **Preview** — Review your data in a responsive table
3. **Import** — Click "Confirm Import" to trigger AI extraction
4. **Results** — View extracted CRM records and skipped entries

The AI intelligently maps columns like:
- `"Phone Number"` → `mobile_without_country_code`
- `"Full Name"` or `"First Name" + "Last Name"` → `name`
- `"Organisation"` or `"Business"` → `company`
- `"Notes"` or `"Remarks"` → `crm_note`

## 🌐 Deployment

### Frontend (Vercel)

1. Push your code to GitHub
2. Import the `frontend` folder into [Vercel](https://vercel.com)
3. Set the root directory to `frontend`
4. Add environment variable: `NEXT_PUBLIC_API_URL=https://your-backend.railway.app/api`
5. Deploy

### Backend (Railway)

1. Push your code to GitHub
2. Create a new project on [Railway](https://railway.app)
3. Connect your GitHub repo, set root directory to `backend`
4. Add environment variables:
   - `GEMINI_API_KEY=your_key`
   - `PORT=3001`
   - `FRONTEND_URL=https://your-frontend.vercel.app`
5. Deploy

## 📊 CRM Fields Extracted

| Field | Description |
|-------|-------------|
| `created_at` | Lead creation date |
| `name` | Lead name |
| `email` | Primary email |
| `country_code` | Phone country code |
| `mobile_without_country_code` | Mobile number |
| `company` | Company name |
| `city` | City |
| `state` | State |
| `country` | Country |
| `lead_owner` | Lead owner |
| `crm_status` | Lead status (enum) |
| `crm_note` | Notes/remarks |
| `data_source` | Lead source (enum) |
| `possession_time` | Property possession time |
| `description` | Additional description |

## 📝 License

MIT
