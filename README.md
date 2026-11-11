# HelpFund 🤝
### AI-Powered Transparent Crowdfunding & PayPal Micro-Donations Platform
> Built for the **PayPal AI Hackathon: Build What's Next with PayPal and AI!**

[![Node.js](https://img.shields.io/badge/Node.js-22.x-339933?logo=node.js)](https://nodejs.org)
[![Express](https://img.shields.io/badge/Express-4.21-000000?logo=express)](https://expressjs.com)
[![SQLite](https://img.shields.io/badge/SQLite-better--sqlite3-003B57?logo=sqlite)](https://github.com/WiseLibs/better-sqlite3)
[![Google Gemini](https://img.shields.io/badge/Google%20Gemini-Flash%203.5%20%2F%202.5-4285F4?logo=google)](https://aistudio.google.com)
[![PayPal](https://img.shields.io/badge/PayPal-Orders%20v2%20Sandbox-003087?logo=paypal)](https://developer.paypal.com)
[![Hosted on Render](https://img.shields.io/badge/Hosted%20on-Render-46E3B7?logo=render)](https://helpfund.onrender.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Tests Passing](https://img.shields.io/badge/Tests-75%20Passing-brightgreen.svg)](tests/)

---

## 🌟 Live Demo & Links
- **Hosted Platform URL**: [https://helpfund.onrender.com](https://helpfund.onrender.com)
- **GitHub Repository**: [https://github.com/Vivek93065/HelpFund](https://github.com/Vivek93065/HelpFund)

---

## 📌 Executive Summary
**HelpFund** is a production-quality, full-stack crowdfunding platform engineered to combine **Google Gemini Artificial Intelligence** with **PayPal's Developer Platform (Orders v2 Sandbox)**. 

Crowdfunding often suffers from two major friction points:
1. **The Blank Page Problem for Creators**: Fundraisers struggle to craft persuasive, transparent stories with structured milestone budgets.
2. **The Credibility & Trust Deficit for Donors**: Backers hesitate to donate when they cannot verify whether campaigns have realistic timelines, itemized budgets, or genuine community beneficiaries.

HelpFund solves both:
- **Creators** use the **Gemini AI Story Assistant** to convert rough notes into compelling grant-style pitches, accompanied by an AI-generated widescreen campaign visual.
- **Donors** see an automated **AI Credibility Audit (0–100 Trust Score)** evaluating budget clarity, beneficiary transparency, and timeline feasibility.
- **Smart Impact Calculator**: Inside the PayPal checkout modal, Gemini predicts the exact real-world impact of the donor's chosen contribution (e.g. *"$50 covers 2 pediatric consultation sessions and emergency medication kits"*).
- **Institutional Payment Security**: Donations are initiated and captured entirely server-side via the **PayPal Orders v2 API**, recorded in an atomic SQLite ledger with strict idempotency against duplicate captures.

---

## 🏗️ System Architecture

```mermaid
flowchart TD
    subgraph Client["Frontend Client (Vanilla JS & HTML5)"]
        UI[Responsive UI / Explore / Campaign Detail]
        SDK[PayPal JavaScript SDK Modal]
    end

    subgraph Backend["Express Backend (Node.js 22)"]
        Router[Express Routers & Rate Limiters]
        AuthCtrl[JWT & BCrypt Authentication]
        AICtrl[Gemini AI Controller]
        PayCtrl[PayPal Donation Controller]
        ImgService[Multi-Tier AI Vision Engine]
    end

    subgraph External["External Cloud Services"]
        PayPalAPI["PayPal Orders v2 REST API (Sandbox)"]
        GeminiAPI["Google Gemini AI API (AI Studio)"]
        CloudflareAPI["Cloudflare Workers AI (FLUX.1 Schnell)"]
    end

    subgraph Database["Database & Storage"]
        SQLite[("better-sqlite3 Database\n(WAL Mode, Foreign Keys ON)")]
        Disk[Local / Upload Storage]
    end

    UI -->|1. Request AI Story / Trust Score| Router
    Router --> AICtrl
    AICtrl -->|Prompt Engineering & JSON Schema| GeminiAPI
    
    UI -->|2. Generate Campaign Banner| Router
    Router --> ImgService
    ImgService -->|Tier 1 / Tier 2 / Tier 3| CloudflareAPI
    ImgService -.->|Fallback Tier| GeminiAPI
    
    UI -->|3. Create Order Intent| Router
    Router --> PayCtrl
    PayCtrl -->|Server-Side Create Order| PayPalAPI
    PayPalAPI -->|Order ID| PayCtrl
    PayCtrl -->|orderID| SDK
    
    SDK -->|4. Buyer Approves Modal| UI
    UI -->|5. Capture Request (orderID)| Router
    Router --> PayCtrl
    PayCtrl -->|Server-Side Verified Capture| PayPalAPI
    PayPalAPI -->|Verified Capture Details| PayCtrl
    PayCtrl -->|6. Atomic ACID Transaction| SQLite
    SQLite -->|Updated Raised Amount & Ledger| UI
```

---

## ✨ Key Features & Technical Highlights

### 1. PayPal Developer Platform Integration (Sandbox)
- **Orders v2 REST API**: Communicates directly with `api-m.sandbox.paypal.com` using OAuth 2.0 Client Credentials with cached bearer tokens.
- **Server-Side Intent Capture**: The client never initiates financial capture directly. The frontend receives only an `orderID`, opens the PayPal checkout modal, and sends the authorization back to the server.
- **Never Trust Client Amounts**: The database records only the verified currency and amount returned in PayPal's HTTP capture response.
- **Financial ACID Atomicity & Idempotency**: Campaign balance increments and donation ledger insertions are wrapped inside an atomic SQLite transaction (`db.transaction()`). Duplicate order IDs or capture IDs are strictly rejected.

### 2. Google Gemini AI Capabilities
- **AI Campaign Story Assistant**: Transforms rough notes into structured, empathetic proposals with section headings (*The Challenge*, *How Every Dollar Will Be Used*, *Immediate Impact*) and suggested funding milestones.
- **AI Trust & Credibility Scorer**: Analyzes campaign text for budget itemization, beneficiary clarity, and timeline realism, generating a 0–100 Trust Score and actionable recommendations.
- **AI Smart Impact Calculator**: Dynamically predicts the real-world impact of any donation amount ($10, $25, $50, $100) inside the PayPal modal.
- **AI Campaign Update Drafter**: Allows creators to input raw bullet points on project progress; Gemini crafts a polished donor announcement.
- **Zero-Crash Semantic Fallback**: If the Gemini API is unreachable or offline, an intelligent built-in semantic fallback guarantees 100% platform availability.

### 3. Multi-Tier Resilient AI Image Generation
- **Tier 1**: Cloudflare Workers AI (`@cf/black-forest-labs/flux-1-schnell`) when credentials are provided.
- **Tier 2**: Google Imagen 3 (`imagen-3.0-generate-002`) using the configured `GEMINI_API_KEY`.
- **Tier 3**: Zero-config serverless AI image generation via Pollinations.ai FLUX engine (free, instant, no key required).
- **Tier 4**: High-definition curated category photography presets.

### 4. High-Performance Synchronous Database
- Powered by `better-sqlite3` running in **Write-Ahead Logging (WAL) Mode** with **Foreign Keys ON**.
- 100% prepared statements with parameterized SQL bindings for SQL injection immunity.

---

## 🧪 Quick Test Guide for Hackathon Judges

To test HelpFund immediately:

### 1. Live Hosted Demo
Visit **[https://helpfund.onrender.com](https://helpfund.onrender.com)**.

### 2. Judge One-Click Demo Credentials
On the [Sign In page](https://helpfund.onrender.com/login.html), click the quick-fill buttons:
- **Campaign Creator**: `maya.lin@helpfund.org` / `DemoPassword123!`
- **Platform Admin**: `admin@helpfund.org` / `DemoPassword123!`

### 3. Testing a PayPal Sandbox Donation
1. Go to any campaign on the [Explore page](https://helpfund.onrender.com/explore.html).
2. Click **"❤️ Donate to this Cause"**.
3. Select an amount ($10, $25, $50, $100) or enter a custom value — observe the **Gemini AI Impact Prediction** calculate live.
4. Click the yellow **PayPal** button.
5. In the PayPal sandbox popup, log in with any personal PayPal Sandbox buyer account or test credentials:
   - **Buyer Email**: `buyer@helpfund-sandbox.com` (or your personal PayPal developer sandbox account)
   - **Password**: Any valid sandbox password
6. Complete the approval. HelpFund captures the payment server-side, updates the campaign balance atomically, and generates a verified PayPal transaction receipt!

---

## 💻 Local Installation & Setup

### Prerequisites
- Node.js 20.x or 22.x
- npm 10.x+
- Git

### Installation Steps

1. **Clone the repository:**
   ```bash
   git clone https://github.com/Vivek93065/HelpFund.git
   cd HelpFund
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure Environment Variables:**
   Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
   Fill in your API keys in `.env`:
   ```env
   PORT=5000
   NODE_ENV=development
   CLIENT_URL=http://localhost:5000
   JWT_SECRET=super_secret_jwt_key_at_least_32_characters_long
   
   # Google Gemini API Key (Get free from https://aistudio.google.com/)
   GEMINI_API_KEY=your_gemini_api_key_here
   GEMINI_MODEL=gemini-2.5-flash
   
   # PayPal Sandbox Credentials (Get from https://developer.paypal.com/dashboard/)
   PAYPAL_CLIENT_ID=your_paypal_sandbox_client_id_here
   PAYPAL_CLIENT_SECRET=your_paypal_sandbox_client_secret_here
   PAYPAL_API_BASE=https://api-m.sandbox.paypal.com
   ```

4. **Initialize & Seed the Database:**
   ```bash
   npm run init-db
   npm run seed
   ```

5. **Start the Development Server:**
   ```bash
   npm run dev
   # or for production mode:
   npm start
   ```
   Open [http://localhost:5000](http://localhost:5000) in your browser.

---

## 🧪 Automated Test Suite (75 Tests Passing)

HelpFund includes a comprehensive automated test suite testing auth, campaigns, Gemini AI, and PayPal Sandbox payments offline:

```bash
# Run all 75 automated tests:
npm run test-all

# Or run individual milestone test suites:
npm run test-auth        # 18 Tests: Registration, Login, JWT, Admin RBAC
npm run test-campaigns   # 18 Tests: CRUD, Filtering, Pagination, Metrics
npm run test-ai          # 21 Tests: Gemini Pitch Writer, Trust Audit, Rate Limits
npm run test-donations   # 23 Tests: PayPal Orders v2, Idempotency, Ledger
```

---

## 📡 REST API Reference

| Method | Endpoint | Auth | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/health` | Public | Service health check |
| `POST` | `/api/auth/register` | Public | Register new creator or donor account |
| `POST` | `/api/auth/login` | Public | Authenticate user & return signed JWT |
| `GET` | `/api/auth/me` | Bearer | Retrieve authenticated user profile |
| `GET` | `/api/campaigns` | Public | Paginated list with category & search filters |
| `GET` | `/api/campaigns/:id` | Public | Single campaign details with creator info |
| `POST` | `/api/campaigns` | Creator | Create campaign with banner image upload |
| `PUT` | `/api/campaigns/:id` | Owner | Update campaign details |
| `DELETE`| `/api/campaigns/:id` | Owner | Delete campaign |
| `GET` | `/api/campaigns/:id/updates` | Public | Retrieve campaign milestone updates |
| `POST` | `/api/campaigns/:id/updates` | Owner | Post milestone update to backers |
| `POST` | `/api/ai/generate-story` | Creator | Generate structured campaign pitch |
| `POST` | `/api/ai/generate-image` | Creator | Multi-tier AI campaign illustration generator |
| `POST` | `/api/ai/analyze-trust` | Bearer | Calculate 0–100 AI Credibility Trust Score |
| `POST` | `/api/ai/predict-impact` | Public | Predict real-world impact for donation amount |
| `POST` | `/api/ai/draft-update` | Creator | Draft backer update from raw bullet points |
| `GET` | `/api/donations/config` | Public | Client PayPal sandbox configuration |
| `POST` | `/api/donations/create-order`| Bearer | Initiate PayPal Orders v2 checkout order |
| `POST` | `/api/donations/capture-order`| Bearer | Verify & capture PayPal transaction atomically |
| `GET` | `/api/donations/campaign/:id`| Public | Public campaign donation ledger |
| `GET` | `/api/donations/my` | Bearer | User's personal backed donation history |

---

## 🛠️ Technology Stack Breakdown

| Layer | Technologies Used |
| :--- | :--- |
| **Payments** | PayPal Developer Platform, Orders v2 REST API, PayPal Smart Buttons SDK |
| **Artificial Intelligence** | Google Gemini (2.5/3.5 Flash), Google Imagen 3, Cloudflare Workers AI FLUX |
| **Backend Runtime** | Node.js 22 LTS, Express 4.21, Helmet, CORS, Multer |
| **Database** | SQLite via `better-sqlite3` (WAL Mode, ACID Transactions, Foreign Keys) |
| **Frontend** | Vanilla ES6+ JavaScript, CSS3 Design Tokens, Semantic HTML5 |
| **Security & Auth** | JSON Web Tokens (JWT), bcryptjs (12 salt rounds), express-rate-limit |
| **Hosting & Cloud** | Render Cloud Web Service (Hackathon Sponsor Tool) |

---

## 📄 License
This project is open-source and licensed under the [MIT License](LICENSE).
