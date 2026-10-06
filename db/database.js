const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

// Ensure data folder exists
const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'hd_customs.db');
const db = new DatabaseSync(dbPath);

// Enable foreign keys
db.exec('PRAGMA foreign_keys = ON;');

// Helper for password hashing using built-in crypto
function hashPassword(password) {
  return crypto.createHash('sha256').update(password + 'hd_customs_salt_2026').digest('hex');
}

function initDb() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT DEFAULT 'admin',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS inquiries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tracking_code TEXT UNIQUE NOT NULL,
      customer_name TEXT NOT NULL,
      customer_phone TEXT NOT NULL,
      customer_email TEXT,
      bike_model TEXT NOT NULL,
      service_type TEXT NOT NULL,
      finish_type TEXT,
      requirements TEXT,
      estimated_budget REAL DEFAULT 0,
      status TEXT DEFAULT 'New',
      notes TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS jobs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tracking_code TEXT UNIQUE NOT NULL,
      customer_name TEXT NOT NULL,
      customer_phone TEXT NOT NULL,
      bike_model TEXT NOT NULL,
      reg_number TEXT,
      service_type TEXT NOT NULL,
      color_finish TEXT,
      current_stage TEXT NOT NULL DEFAULT 'Consultation & Intake',
      stage_progress INTEGER DEFAULT 15,
      total_amount REAL DEFAULT 0,
      advance_paid REAL DEFAULT 0,
      balance_due REAL DEFAULT 0,
      status TEXT DEFAULT 'In Progress',
      technician TEXT DEFAULT 'Hemanth (Lead Artist)',
      start_date TEXT,
      estimated_delivery TEXT,
      completed_date TEXT,
      notes TEXT,
      before_photo TEXT,
      current_photo TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS job_timeline (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      job_id INTEGER NOT NULL,
      stage_name TEXT NOT NULL,
      title TEXT NOT NULL,
      notes TEXT,
      photo_url TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(job_id) REFERENCES jobs(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS inventory (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      item_code TEXT UNIQUE,
      item_name TEXT NOT NULL,
      category TEXT NOT NULL,
      quantity REAL DEFAULT 0,
      unit TEXT DEFAULT 'Liters',
      min_threshold REAL DEFAULT 2,
      unit_price REAL DEFAULT 0,
      supplier TEXT,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS invoices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_number TEXT UNIQUE NOT NULL,
      job_id INTEGER,
      customer_name TEXT NOT NULL,
      customer_phone TEXT NOT NULL,
      bike_model TEXT NOT NULL,
      items_json TEXT NOT NULL,
      subtotal REAL DEFAULT 0,
      discount REAL DEFAULT 0,
      tax_rate REAL DEFAULT 0,
      total_amount REAL DEFAULT 0,
      paid_amount REAL DEFAULT 0,
      balance_due REAL DEFAULT 0,
      payment_method TEXT DEFAULT 'UPI',
      payment_status TEXT DEFAULT 'Partial',
      notes TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(job_id) REFERENCES jobs(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS gallery (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      bike_model TEXT NOT NULL,
      category TEXT NOT NULL,
      before_image TEXT,
      after_image TEXT NOT NULL,
      description TEXT,
      featured INTEGER DEFAULT 1,
      likes_count INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );
  `);

  // Seed the first admin only when credentials are explicitly configured.
  const adminUsername = process.env.ADMIN_USERNAME;
  const adminPassword = process.env.ADMIN_PASSWORD;
  const adminCheck = db.prepare('SELECT id FROM users WHERE username = ?').get(adminUsername || 'admin');
  if (!adminCheck && adminUsername && adminPassword) {
    const defaultPassHash = hashPassword(adminPassword);
    db.prepare(`
      INSERT INTO users (username, password_hash, name, role)
      VALUES (?, ?, ?, ?)
    `).run(adminUsername, defaultPassHash, 'HD Customs Master Admin', 'admin');
  } else if (!adminCheck) {
    console.warn('Admin account not seeded. Set ADMIN_USERNAME and ADMIN_PASSWORD to enable dashboard login.');
  }

  // Seed initial settings
  const settingsCheck = db.prepare('SELECT count(*) as count FROM settings').get();
  if (settingsCheck.count === 0) {
    const defaultSettings = [
      ['studio_name', 'HD CUSTOMS'],
      ['tagline', 'Turn Your Bike Into Art'],
      ['phone', '7639459207'],
      ['whatsapp', '917639459207'],
      ['instagram', 'https://instagram.com/hd_customs_'],
      ['address', 'Perumal Kovil Street, Vellerithangal, Papparambakam, Tamil Nadu – 602025'],
      ['google_maps', 'https://maps.app.goo.gl/5sWhZ5kk3j3ve9gU9'],
      ['upi_id', '7639459207@upi'],
      ['lead_artist', 'Hemanth']
    ];
    const insSetting = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)');
    for (const [k, v] of defaultSettings) {
      insSetting.run(k, v);
    }
  }

  // Seed sample jobs if empty
  const jobsCheck = db.prepare('SELECT count(*) as count FROM jobs').get();
  if (jobsCheck.count === 0) {
    seedSampleData();
  }
}

function seedSampleData() {
  const insertJob = db.prepare(`
    INSERT INTO jobs (
      tracking_code, customer_name, customer_phone, bike_model, reg_number,
      service_type, color_finish, current_stage, stage_progress, total_amount,
      advance_paid, balance_due, status, technician, start_date, estimated_delivery,
      notes, before_photo, current_photo
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertTimeline = db.prepare(`
    INSERT INTO job_timeline (job_id, stage_name, title, notes, photo_url, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  // Job 1: Continental GT 650
  const job1 = insertJob.run(
    'HDC-2026-101',
    'Karthik Raja',
    '9840123456',
    'Royal Enfield Continental GT 650',
    'TN 05 AK 9988',
    'Full Bike Makeover',
    'Candy Apple Red & Chrome Dual-Tone',
    'Custom Paint & Airbrush Art',
    70,
    38500,
    25000,
    13500,
    'In Progress',
    'Hemanth (Lead Artist)',
    '2026-09-28',
    '2026-10-12',
    'Customer requested 3-layer candy red with silver metallic base and custom pinstriping on tank cowl.',
    'assets/hero.jpg',
    'assets/hero.jpg'
  );

  insertTimeline.run(job1.lastInsertRowid, 'Consultation & Intake', 'Bike received & inspected', 'Checked fuel tank, side panels, and cowl for micro-scratches. Color plan signed off.', null, '2026-09-28 10:30:00');
  insertTimeline.run(job1.lastInsertRowid, 'Surface Stripping & Prep', 'Sanded to bare metal & primed', 'Stripped factory clearcoat, neutralized metal, applied 2-pack anti-corrosion epoxy primer.', null, '2026-10-01 14:15:00');
  insertTimeline.run(job1.lastInsertRowid, 'Custom Paint & Airbrush Art', 'Silver metallic base & Candy Red sprayed', 'Applied 4 coats of Candy Apple Red dye with golden flakes under studio LED inspection.', 'assets/hero.jpg', '2026-10-05 16:45:00');

  // Job 2: Yamaha R15 V4
  const job2 = insertJob.run(
    'HDC-2026-102',
    'Arun Kumar',
    '9791198765',
    'Yamaha R15 V4',
    'TN 20 BK 4432',
    'Custom Graphics',
    'Stealth Matte Black & Cyber Neon Gold',
    'Clearcoat & Curing',
    85,
    24000,
    24000,
    0,
    'In Progress',
    'Hemanth (Lead Artist)',
    '2026-09-25',
    '2026-10-08',
    'Full aerodynamic fairing makeover with custom geometric race livery and matte satin finish.',
    'assets/hero.jpg',
    'assets/hero.jpg'
  );

  insertTimeline.run(job2.lastInsertRowid, 'Consultation & Intake', 'Disassembly & Panel Numbering', 'All 12 fairing clips labeled. Original stickers stripped cleanly.', null, '2026-09-25 11:00:00');
  insertTimeline.run(job2.lastInsertRowid, 'Surface Prep', 'Plastic adhesion promoter applied', 'Fine wet sanding 800 grit followed by primer.', null, '2026-09-27 15:20:00');
  insertTimeline.run(job2.lastInsertRowid, 'Artwork & Stenciling', 'Cyber neon gold vector stripes applied', 'Custom mask stencils plotted and sprayed by hand.', null, '2026-10-02 12:00:00');
  insertTimeline.run(job2.lastInsertRowid, 'Clearcoat & Curing', 'Matte satin 2K ceramic clearcoat applied', 'Baking under IR heat lamps for maximum scratch resistance.', 'assets/hero.jpg', '2026-10-06 09:30:00');

  // Job 3: KTM Duke 390
  const job3 = insertJob.run(
    'HDC-2026-103',
    'Siddharth V',
    '9444332211',
    'KTM Duke 390',
    'TN 09 DX 7711',
    'Airbrush Art',
    'Chameleon Color Shift (Purple/Cyan)',
    'Polishing & Detailing',
    95,
    32000,
    30000,
    2000,
    'Ready for Delivery',
    'Hemanth (Lead Artist)',
    '2026-09-20',
    '2026-10-06',
    'Dual-shift pigment on tank extensions and trellis subframe. Tank features airbrushed Spartan helmet motif.',
    'assets/hero.jpg',
    'assets/hero.jpg'
  );

  insertTimeline.run(job3.lastInsertRowid, 'Consultation & Intake', 'Color swatches finalized', 'Sample panels sprayed and approved by client over WhatsApp video call.', null, '2026-09-20 16:00:00');
  insertTimeline.run(job3.lastInsertRowid, 'Custom Paint & Airbrush Art', 'Airbrushed artwork completed', 'Freehand airbrush work using 0.2mm Iwata custom micron.', null, '2026-09-28 17:30:00');
  insertTimeline.run(job3.lastInsertRowid, 'Polishing & Detailing', '3-stage mirror cut & 9H Ceramic coat applied', 'Treated with 9H ceramic shield. Bike ready for client handover.', 'assets/hero.jpg', '2026-10-06 11:00:00');

  // Job 4: Royal Enfield Hunter 350
  const job4 = insertJob.run(
    'HDC-2026-104',
    'Vigneshwaran M',
    '9884567890',
    'Royal Enfield Hunter 350',
    'TN 18 EM 1205',
    'Custom Bike Painting',
    'Vintage British Racing Green with Gold Leaf',
    'Surface Stripping & Prep',
    35,
    21500,
    10000,
    11500,
    'In Progress',
    'Hemanth (Lead Artist)',
    '2026-10-02',
    '2026-10-18',
    'Classic retro aesthetic with hand-laid 24K imitation gold leaf border on tank badge.',
    'assets/hero.jpg',
    'assets/hero.jpg'
  );

  insertTimeline.run(job4.lastInsertRowid, 'Consultation & Intake', 'Bike received & deposit collected', 'Advance ₹10,000 received via UPI.', null, '2026-10-02 11:30:00');
  insertTimeline.run(job4.lastInsertRowid, 'Surface Stripping & Prep', 'Chemical stripping & dent correction', 'Minor tank dent pulled using stud welder and filled with lightweight aluminum putty.', null, '2026-10-05 15:40:00');

  // Seed sample inquiries
  const insertInquiry = db.prepare(`
    INSERT INTO inquiries (
      tracking_code, customer_name, customer_phone, customer_email,
      bike_model, service_type, finish_type, requirements, estimated_budget, status, notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertInquiry.run(
    'INQ-2026-001',
    'Pradeep Krishnan',
    '9841122334',
    'pradeep.k@gmail.com',
    'Yamaha MT-15',
    'Airbrush Art',
    'Matte Stealth',
    'Want custom Japanese samurai graphics and kanji typography on fuel tank and side shrouds.',
    18000,
    'Quoted',
    'Sent digital sketch proposal on WhatsApp. Awaiting confirmation.'
  );

  insertInquiry.run(
    'INQ-2026-002',
    'Dinesh Babu',
    '9940567891',
    'dineshbabu@outlook.com',
    'Royal Enfield Classic 350',
    'Full Bike Makeover',
    'Gloss Vintage Maroon',
    'Restore original 2014 Classic 350 with vintage maroon, hand pin-striping on mudguards and buffed engine fins.',
    28000,
    'New',
    'Fresh inquiry from website form.'
  );

  insertInquiry.run(
    'INQ-2026-003',
    'Suresh Kumar',
    '9789012345',
    'suresh.motor@yahoo.com',
    'Kawasaki Ninja 300',
    'Custom Graphics',
    'Candy Lime Green & Gloss Black',
    'Monster Energy WSBK replica graphics with fluorescent accents.',
    22000,
    'Contacted',
    'Discussed timeline and paint durability. Coming for studio visit on Saturday.'
  );

  insertInquiry.run(
    'INQ-2026-004',
    'Manoj Selvam',
    '9840998877',
    'manoj.s@gmail.com',
    'Harley Davidson Iron 883',
    'Custom Bike Painting',
    'Hard Candy Gold Flake',
    'Heavy metalflake gold tank and shorty rear fender. Needs deep 2K clear coat with mirror gloss.',
    45000,
    'New',
    'High value lead. Call back in evening.'
  );

  // Seed Inventory
  const insertInv = db.prepare(`
    INSERT INTO inventory (item_code, item_name, category, quantity, unit, min_threshold, unit_price, supplier)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const inventoryItems = [
    ['INV-PNT-01', 'House of Kolor Candy Apple Red', 'Paints & Pearls', 3.5, 'Liters', 2.0, 4800, 'Custom Paint India Corp'],
    ['INV-PNT-02', 'High Solids Deep Jet Black Basecoat', 'Paints & Pearls', 8.0, 'Liters', 3.0, 1650, 'Nippon Paint Specialist'],
    ['INV-PNT-03', 'Chameleon Cyan/Purple Shift Pearl', 'Paints & Pearls', 1.2, 'Liters', 1.0, 6200, 'Kustom Kulture pigments'],
    ['INV-CLR-01', 'Standox 2K High Gloss VOC Clearcoat', 'Clearcoats & Thinners', 6.0, 'Liters', 2.5, 3200, 'Axalta Distribution'],
    ['INV-CLR-02', 'DeBeer Satin Matte 2K Clearcoat', 'Clearcoats & Thinners', 2.0, 'Liters', 2.0, 3400, 'Valspar Automotive'],
    ['INV-PRM-01', '2-Pack Anti-Corrosive Epoxy Primer', 'Primers & Fillers', 7.5, 'Liters', 3.0, 1400, 'AkzoNobel'],
    ['INV-PRM-02', 'Plastic Adhesion Promoter 1K Spray', 'Primers & Fillers', 4.0, 'Cans', 2.0, 850, '3M Automotive'],
    ['INV-ABR-01', '3M Wetordry Sandpaper P800 / P1500 / P2000', 'Abrasives & Sanding', 65, 'Sheets', 30, 45, '3M India'],
    ['INV-ABR-02', 'Fineline Masking Tape 3mm & 6mm', 'Abrasives & Sanding', 14, 'Packs', 5, 280, 'Norton Saint-Gobain'],
    ['INV-DTL-01', '9H Ceramic Matrix Shield 50ml', 'Airbrush & Detailing', 5, 'Pieces', 2, 2900, 'Gtechniq India'],
    ['INV-TLS-01', 'Iwata Eclipse HP-CS 0.35mm Fluid Needle', 'Tools & Safety', 2, 'Pieces', 2, 1200, 'Anest Iwata'],
    ['INV-TLS-02', '3M Organic Vapor Respirator Cartridges', 'Tools & Safety', 6, 'Packs', 3, 1100, 'Safety First Chennai']
  ];

  for (const item of inventoryItems) {
    insertInv.run(...item);
  }

  // Seed Invoices
  const insertInvoice = db.prepare(`
    INSERT INTO invoices (
      invoice_number, job_id, customer_name, customer_phone, bike_model,
      items_json, subtotal, discount, tax_rate, total_amount, paid_amount,
      balance_due, payment_method, payment_status, notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const inv1Items = JSON.stringify([
    { description: 'Full Bike Complete Disassembly & Panel Prep', qty: 1, rate: 4500, amount: 4500 },
    { description: 'Candy Apple Red 3-Stage Custom Paintwork', qty: 1, rate: 22000, amount: 22000 },
    { description: 'Custom Silver Flake Tank Pinstriping & Decals', qty: 1, rate: 6000, amount: 6000 },
    { description: 'Ultra-High Solids 2K Clearcoat & 3-Step Mirror Buffing', qty: 1, rate: 6000, amount: 6000 }
  ]);

  insertInvoice.run(
    'INV-2026-001',
    job1.lastInsertRowid,
    'Karthik Raja',
    '9840123456',
    'Royal Enfield Continental GT 650',
    inv1Items,
    38500,
    0,
    0,
    38500,
    25000,
    13500,
    'UPI',
    'Partial',
    'Advance of ₹25,000 paid on check-in. Balance due upon delivery.'
  );

  const inv2Items = JSON.stringify([
    { description: 'Yamaha R15 V4 Fairing Graphics Custom Design', qty: 1, rate: 8000, amount: 8000 },
    { description: 'Stealth Matte Black & Cyber Neon Gold Spray Paint', qty: 1, rate: 12000, amount: 12000 },
    { description: 'Satin Ceramic Matte Clear Topcoat', qty: 1, rate: 4000, amount: 4000 }
  ]);

  insertInvoice.run(
    'INV-2026-002',
    job2.lastInsertRowid,
    'Arun Kumar',
    '9791198765',
    'Yamaha R15 V4',
    inv2Items,
    24000,
    0,
    0,
    24000,
    24000,
    0,
    'UPI',
    'Paid',
    'Full payment completed via GPay/PhonePe.'
  );

  // Seed Gallery Projects
  const insertGal = db.prepare(`
    INSERT INTO gallery (title, bike_model, category, before_image, after_image, description, featured, likes_count)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertGal.run(
    'Candy Crimson Cafe Racer',
    'Royal Enfield Continental GT 650',
    'Custom Paint',
    'assets/hero.jpg',
    'assets/HD Customs_ Turn Your Bike into Art.png',
    'Hand-layered deep ruby candy paint over coarse metallic silver flakes with hand-turned pinstripes.',
    1,
    148
  );

  insertGal.run(
    'Cyberpunk Stealth Track Machine',
    'Yamaha R15 V4',
    'Graphics & Matte',
    'assets/hero.jpg',
    'assets/HD Customs Motorcycle Branding.png',
    'Ultra-matte carbon black accented with electric neon gold lines and custom racing aerodynamics finish.',
    1,
    212
  );

  insertGal.run(
    'Hyper Shift Spartan Beast',
    'KTM Duke 390',
    'Airbrush Art',
    'assets/hero.jpg',
    'assets/hero.jpg',
    'Intricate custom airbrush Spartan helm mural with color-shifting chameleon pigments transitioning between purple and teal.',
    1,
    189
  );

  insertGal.run(
    'Heritage British Racing Green',
    'Royal Enfield Hunter 350',
    'Vintage Restoration',
    'assets/hero.jpg',
    'assets/HD Customs_ Turn Your Bike into Art.png',
    'Timeless gloss British racing green with authentic 24K leaf border line and deep polished finish.',
    1,
    95
  );
}

// Initialize on require
initDb();

module.exports = {
  db,
  hashPassword
};
