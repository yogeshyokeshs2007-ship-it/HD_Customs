# 🏍️ HD CUSTOMS - Full-Stack Workshop Studio Platform & Dashboard

Complete motorcycle painting & custom finishing business platform with **Frontend**, **REST API Backend**, and **SQLite Database**.

---

## 🚀 Live Access & URLs

- **Customer Website**: [http://localhost:3000](http://localhost:3000)
- **Workshop Admin OS (Dashboard)**: [http://localhost:3000/dashboard.html](http://localhost:3000/dashboard.html)
- **API Health Check**: [http://localhost:3000/api/health](http://localhost:3000/api/health)

### 🔐 Admin Setup

The first admin account is created when the database is initialized. Configure a unique username and strong password before starting the server:

```powershell
$env:ADMIN_USERNAME = "admin"
$env:ADMIN_PASSWORD = "replace-with-a-strong-password"
npm start
```

On other platforms, set the `ADMIN_USERNAME` and `ADMIN_PASSWORD` environment variables in your shell or hosting provider. Do not commit real credentials or your local `.env` file.

---

## ✨ Features

### 1. 🌐 Public Customer Portal (`/index.html`)
- **Turn Your Bike Into Art** luxury dark/gold aesthetic with authentic HD CUSTOMS assets.
- **🔍 Live Bike Build Status Tracker (`#tracker`)**:
  - Customers enter their tracking code (e.g. `HDC-2026-101`) or phone number.
  - Interactive 5-stage progress indicator (`Intake & Prep` ➔ `Epoxy Priming` ➔ `Custom Paint & Airbrush` ➔ `Clearcoat & Buff` ➔ `Ready for Handover`).
  - Workshop timeline log with photos and notes.
  - Payment balance details and 1-click WhatsApp inquiry.
- **💰 Interactive Price & Estimate Calculator (`#calculator`)**:
  - Dynamically calculates price based on bike style, paint finish, and add-ons (candy pearl, chameleon shift, tank airbrush, ceramic 9H).
  - One-click booking that saves directly into the database and generates a pre-formatted WhatsApp quote.
- **🔄 Interactive Before & After Transformation Slider (`#work`)**:
  - Smooth interactive slider comparing stock motorcycle to finished HD Customs build.
- **🖼️ Live Portfolio Showcase**:
  - Real-time builds loaded from SQLite database with like counters and quick WhatsApp links.

### 2. 🛠️ Workshop Management OS (`/dashboard.html`)
- **Studio Overview**:
  - Real-time metrics: Active Builds, Ready for Delivery, New Inquiries, Pending Balances, Low Stock items.
  - Stage pipeline distribution bar chart.
- **Bike Build Pipeline**:
  - **Kanban Board** & **Table View** with live stage status.
  - Advance stages, upload progress photos, post technician notes.
  - **1-Click WhatsApp Status Dispatch**: Sends formatted status update with live tracking link directly to the customer's phone!
- **Quote Inquiries Manager**:
  - Review website leads, update status (`New`, `Contacted`, `Quoted`, `Converted`).
  - One-click "Convert to Active Build".
- **Paints, Clearcoats & Consumables (Inventory)**:
  - Track liters/cans of candies, pearls, clears, primers, abrasives, needles.
  - Low stock warning badges with quick `+1` / `-1` adjusters.
- **Billing & Invoice Generator**:
  - Itemized workshop estimates and invoices.
  - Calculates subtotal, discount, tax, advance paid, and balance due.
  - **Printable Tax Invoice & Job Card** with HD Customs letterhead and UPI payment details.
- **Showcase Manager**:
  - Upload before/after photos directly to public site.
- **Studio Settings**:
  - Configure phone numbers, WhatsApp, UPI ID, and studio location.

---

## 📡 REST API Endpoints

| Endpoint | Method | Description |
|---|---|---|
| `/api/jobs` | GET, POST | List all jobs or create new bike build |
| `/api/jobs/:id` | GET, PUT, DELETE | Get job details, update, or remove |
| `/api/jobs/:id/timeline` | POST | Add stage update with photo upload |
| `/api/jobs/track/:query` | GET | Public customer tracking by code or phone |
| `/api/inquiries` | GET, POST | Manage quote inquiries |
| `/api/inquiries/:id/convert` | POST | Convert inquiry to active build |
| `/api/inventory` | GET, POST, PUT, DELETE | Inventory management |
| `/api/inventory/:id/adjust` | POST | Quick +/- stock increment |
| `/api/invoices` | GET, POST, PUT, DELETE | Invoicing and balance tracking |
| `/api/gallery` | GET, POST, DELETE | Portfolio showcase management |
| `/api/analytics` | GET | Studio KPI metrics & pipeline stats |
| `/api/auth/login` | POST | Admin login authentication |

---

## 🛠️ How to Run

```bash
# In this directory:
npm start

# Or directly:
node server.js
```
The server will start on port `3000`.

`.env.example` documents the required variable names. The app reads credentials from environment variables; it does not load `.env` files itself.

## ☁️ Deploy with a persistent SQLite database

This app uses SQLite, so deploy it to a Node.js host with a persistent disk rather than a serverless function. The included `render.yaml` configures a Render web service with a persistent disk mounted at `/var/data`.

1. In Render, create a **Blueprint** from this GitHub repository and apply `render.yaml`.
2. In the service's **Environment** settings, set `ADMIN_USERNAME` and a strong, unique `ADMIN_PASSWORD`.
3. Wait for the deploy to finish, then open the service URL. The customer site and workshop dashboard are served from the same origin as the API.
4. Confirm the service is healthy at `/api/health`. The database file is stored on the persistent disk at `/var/data/hd_customs.db`.

The persistent disk requires a paid Render instance. Do not point a Vercel serverless deployment at this SQLite backend; its filesystem is not persistent.
