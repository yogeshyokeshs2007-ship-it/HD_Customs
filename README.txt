====================================================
HD CUSTOMS - WORKSHOP OS & FULL-STACK PLATFORM v2.0
====================================================

COMPLETE PLATFORM INCLUDED:
1. FRONTEND:
   - Customer Portal: Turn Your Bike into Art Landing Page
   - Live Order / Bike Build Status Tracker (by Job ID or Phone)
   - Interactive Motorcycle Paint & Finish Cost Calculator
   - Before & After Transformation Slider
   - Public Builds Showcase Portfolio
   - Workshop Studio Admin Dashboard (Kanban Pipeline, Invoices, Inventory, Inquiries)

2. BACKEND API (Node.js & Express):
   - /api/jobs        : Bike build pipeline, stages, photos, timeline updates
   - /api/inquiries   : Instant website quote enquiries & WhatsApp hooks
   - /api/inventory   : Workshop paints, pearls, clearcoats, abrasives & stock alerts
   - /api/invoices    : Tax & workshop invoice generator with printable receipts
   - /api/gallery     : Before/after motorcycle showcase portfolio
   - /api/analytics   : Real-time studio KPI counters, revenue, and stage progress
   - /api/auth        : Studio admin authentication

3. DATABASE (SQLite with node:sqlite):
   - Local database location: data/hd_customs.db (or the DB_PATH environment variable)
   - In production, configure DB_PATH on a persistent disk.

HOW TO RUN:
Option 1: In terminal, run:
   npm start
   (or: node server.js)

For production, deploy the included render.yaml as a Render Blueprint and set
ADMIN_USERNAME and ADMIN_PASSWORD in the service environment. SQLite needs the
persistent disk configured by the Blueprint; serverless temporary storage is not suitable.

Option 2: Open in your browser:
   Customer Website: http://localhost:3000
   Workshop Admin Dashboard: http://localhost:3000/dashboard.html

ADMIN LOGIN SETUP:
- Set ADMIN_USERNAME and ADMIN_PASSWORD environment variables before the first server start.
- Choose a unique, strong password and do not commit credentials.
====================================================
