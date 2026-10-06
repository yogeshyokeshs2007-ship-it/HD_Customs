// HD CUSTOMS Customer Website - Interactive Features & Database Connection

// Use the backend origin when previewing locally; use the current origin when deployed.
const API_BASE = window.location.protocol === 'file:'
  || (['localhost', '127.0.0.1'].includes(window.location.hostname) && window.location.port !== '3000')
  ? 'http://localhost:3000/api'
  : '/api';

function getAssetUrl(path) {
  if (!path) return '';
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  if (window.location.protocol === 'file:') return `http://localhost:3000/${path.replace(/^\//, '')}`;
  return path.startsWith('/') ? path : `/${path}`;
}

document.addEventListener('DOMContentLoaded', () => {
  // Navigation
  const menuToggle = document.getElementById('menuToggle');
  const navLinks = document.getElementById('navLinks');
  const year = document.getElementById('year');

  if (year) year.textContent = new Date().getFullYear();

  menuToggle?.addEventListener('click', () => navLinks.classList.toggle('open'));
  navLinks?.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => navLinks.classList.remove('open'));
  });

  // Active section scroll spy
  const sections = document.querySelectorAll('main section[id]');
  const links = document.querySelectorAll('.nav-links a');
  window.addEventListener('scroll', () => {
    let current = 'home';
    sections.forEach(section => {
      const top = section.offsetTop - 120;
      if (window.scrollY >= top) current = section.id;
    });
    links.forEach(link => {
      link.classList.toggle('active', link.getAttribute('href') === `#${current}`);
    });
  });

  // Check Database & Backend Connection
  checkBackendConnection();

  // Initialize components
  initCalculator();
  initBeforeAfterSlider();
  loadPublicGallery();

  // Auto-track if URL has query parameter (e.g. ?track=HDC-2026-101)
  const urlParams = new URLSearchParams(window.location.search);
  const trackParam = urlParams.get('track');
  if (trackParam) {
    const input = document.getElementById('trackInput');
    if (input) input.value = trackParam;
    executeTrackSearch(trackParam);
  }
});

// Check Database Connection Status
async function checkBackendConnection() {
  const statusBadge = document.getElementById('dbConnectionStatus');
  try {
    const res = await fetch(`${API_BASE}/health`);
    const data = await res.json();
    if (data.status === 'online' && data.database === 'connected') {
      if (statusBadge) {
        statusBadge.innerHTML = `🟢 Database Connected (SQLite: ${data.total_jobs} builds active)`;
        statusBadge.style.color = '#10b981';
        statusBadge.style.borderColor = 'rgba(16, 185, 129, 0.4)';
      }
    }
  } catch (err) {
    if (statusBadge) {
      statusBadge.innerHTML = `🔴 Backend Disconnected • Click to retry`;
      statusBadge.style.color = '#ef4444';
      statusBadge.style.borderColor = 'rgba(239, 68, 68, 0.4)';
      statusBadge.onclick = () => {
        checkBackendConnection();
        loadPublicGallery();
      };
    }
  }
}

/* ========================================================
   1. LIVE BIKE STATUS TRACKER
   ======================================================== */
async function handleTrackSearch(e) {
  e.preventDefault();
  const query = document.getElementById('trackInput').value.trim();
  if (query) executeTrackSearch(query);
}

function searchDemoJob(code) {
  document.getElementById('trackInput').value = code;
  executeTrackSearch(code);
}

async function executeTrackSearch(query) {
  const resultCard = document.getElementById('trackResult');
  const errorDiv = document.getElementById('trackError');

  resultCard.style.display = 'none';
  errorDiv.style.display = 'none';

  try {
    const res = await fetch(`${API_BASE}/jobs/track/${encodeURIComponent(query)}`);
    const data = await res.json();

    if (!data.success || !data.job) {
      errorDiv.textContent = data.error || 'No matching motorcycle build found. Please verify tracking ID or phone.';
      errorDiv.style.display = 'block';
      return;
    }

    const { job, timeline } = data;

    // Populate header details
    document.getElementById('tr_code').textContent = job.tracking_code;
    document.getElementById('tr_bike').textContent = job.bike_model;
    document.getElementById('tr_customer').textContent = `Customer: ${job.customer_name} ${job.reg_number ? `• Plate: ${job.reg_number}` : ''}`;
    document.getElementById('tr_status_badge').textContent = job.status;
    document.getElementById('tr_delivery').textContent = job.estimated_delivery ? `Est. Handover: ${job.estimated_delivery}` : 'Status: On Schedule';

    document.getElementById('tr_finish').textContent = job.color_finish || job.service_type;
    document.getElementById('tr_notes').textContent = job.notes || '';

    document.getElementById('tr_total').textContent = `₹${(job.total_amount || 0).toLocaleString('en-IN')}`;
    document.getElementById('tr_advance').textContent = `₹${(job.advance_paid || 0).toLocaleString('en-IN')}`;
    document.getElementById('tr_balance').textContent = `₹${(job.balance_due || 0).toLocaleString('en-IN')}`;

    // Stepper logic
    const stageNodes = [
      { name: 'Intake & Inspection', match: ['Consultation & Intake'] },
      { name: 'Surface Prep', match: ['Surface Stripping & Prep', 'Epoxy Priming'] },
      { name: 'Artwork & Paint', match: ['Custom Paint & Airbrush Art'] },
      { name: 'Clearcoat & Curing', match: ['Clearcoat & Curing', 'Polishing & Detailing'] },
      { name: 'Ready for Delivery', match: ['Quality Check & Ready', 'Ready for Delivery', 'Delivered'] }
    ];

    let currentStageIndex = 0;
    stageNodes.forEach((node, idx) => {
      if (node.match.includes(job.current_stage) || (idx === 4 && job.status === 'Ready for Delivery')) {
        currentStageIndex = idx;
      }
    });

    const stepperEl = document.getElementById('tr_stepper');
    stepperEl.innerHTML = '';
    stageNodes.forEach((node, idx) => {
      const stepDiv = document.createElement('div');
      let statusClass = '';
      let symbol = idx + 1;
      if (idx < currentStageIndex || job.status === 'Delivered') {
        statusClass = 'completed';
        symbol = '✓';
      } else if (idx === currentStageIndex) {
        statusClass = 'active';
      }

      stepDiv.className = `step-node ${statusClass}`;
      stepDiv.innerHTML = `
        <div class="step-circle">${symbol}</div>
        <div class="step-label">${node.name}</div>
      `;
      stepperEl.appendChild(stepDiv);
    });

    // Timeline updates
    const timelineContainer = document.getElementById('tr_timeline');
    timelineContainer.innerHTML = '';
    if (!timeline || timeline.length === 0) {
      timelineContainer.innerHTML = '<p style="color:#71717a;font-size:12px;">Bike checked into workshop. Surface preparation underway.</p>';
    } else {
      timeline.forEach(item => {
        const itemDiv = document.createElement('div');
        itemDiv.style.cssText = 'background:#1a1a22;border-left:2px solid var(--gold);padding:10px 14px;border-radius:4px;font-size:12px;';
        const photoSrc = item.photo_url ? getAssetUrl(item.photo_url) : '';
        itemDiv.innerHTML = `
          <div style="display:flex;justify-content:space-between;margin-bottom:2px;">
            <strong style="color:#fff;">${item.title}</strong>
            <span style="color:var(--muted);font-size:10px;">${item.created_at}</span>
          </div>
          <p style="color:#bbb;margin:4px 0;">${item.notes || ''}</p>
          ${photoSrc ? `<img src="${photoSrc}" style="max-height:140px;border-radius:6px;margin-top:6px;border:1px solid #333;" />` : ''}
        `;
        timelineContainer.appendChild(itemDiv);
      });
    }

    // WhatsApp Button
    document.getElementById('tr_whatsapp_btn').onclick = () => {
      const msg = [
        `Hi HD CUSTOMS, I am checking the status for my motorcycle:`,
        `Bike: ${job.bike_model} (${job.tracking_code})`,
        `Current Stage: ${job.current_stage}`,
        `Please share the latest update!`
      ].join('\n');
      window.open(`https://wa.me/917639459207?text=${encodeURIComponent(msg)}`, '_blank');
    };

    resultCard.style.display = 'block';
    resultCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

  } catch (err) {
    errorDiv.textContent = 'Unable to reach backend. Please ensure node server.js is running.';
    errorDiv.style.display = 'block';
  }
}

/* ========================================================
   2. INTERACTIVE BUILD COST ESTIMATOR
   ======================================================== */
let selectedBike = 'Royal Enfield / Cruiser';
let selectedBase = 16000;
let selectedFinish = 'Multi-Layer Candy Pearl';
let selectedFinishCost = 8000;
let selectedAddons = [];

function initCalculator() {
  document.querySelectorAll('#calcBikeChoices .choice-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#calcBikeChoices .choice-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      selectedBike = btn.getAttribute('data-bike');
      selectedBase = parseFloat(btn.getAttribute('data-base')) || 16000;
      updateCalculatorPrice();
    });
  });

  document.querySelectorAll('#calcFinishChoices .choice-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#calcFinishChoices .choice-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      selectedFinish = btn.getAttribute('data-finish');
      selectedFinishCost = parseFloat(btn.getAttribute('data-cost')) || 8000;
      updateCalculatorPrice();
    });
  });

  document.querySelectorAll('#calcAddons .addon-row').forEach(row => {
    row.addEventListener('click', () => {
      row.classList.toggle('selected');
      const addonName = row.getAttribute('data-addon');
      const addonCost = parseFloat(row.getAttribute('data-cost')) || 0;

      if (row.classList.contains('selected')) {
        selectedAddons.push({ name: addonName, cost: addonCost });
      } else {
        selectedAddons = selectedAddons.filter(a => a.name !== addonName);
      }
      updateCalculatorPrice();
    });
  });

  updateCalculatorPrice();
}

function updateCalculatorPrice() {
  const addonsTotal = selectedAddons.reduce((sum, a) => sum + a.cost, 0);
  const total = selectedBase + selectedFinishCost + addonsTotal;
  const priceEl = document.getElementById('calcFinalPrice');
  if (priceEl) priceEl.textContent = `₹${total.toLocaleString('en-IN')}`;
  return total;
}

async function handleCalculatorSubmit(e) {
  e.preventDefault();
  const name = document.getElementById('cb_name').value.trim();
  const phone = document.getElementById('cb_phone').value.trim();
  const bike = document.getElementById('cb_bike').value.trim();
  const notes = document.getElementById('cb_notes').value.trim();
  const total = updateCalculatorPrice();

  const payload = {
    customer_name: name,
    customer_phone: phone,
    bike_model: bike,
    service_type: 'Custom Bike Painting',
    finish_type: selectedFinish,
    requirements: `Category: ${selectedBike}. Finish: ${selectedFinish}. Addons: ${selectedAddons.map(a => a.name).join(', ') || 'None'}. Notes: ${notes}`,
    estimated_budget: total
  };

  try {
    const res = await fetch(`${API_BASE}/inquiries`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Unable to submit your estimate.');
    }

    const code = data.tracking_code;
    const successBox = document.getElementById('calcSuccessMsg');
    document.getElementById('calcSuccessCode').textContent = code;
    successBox.style.display = 'block';

    const msg = [
      `Hi HD CUSTOMS, I used your online estimator to configure my motorcycle:`,
      `• Name: ${name}`,
      `• Bike Model: ${bike}`,
      `• Category: ${selectedBike}`,
      `• Finish: ${selectedFinish}`,
      `• Addons: ${selectedAddons.map(a => a.name).join(', ') || 'Standard Build'}`,
      `• Estimated Quote: ₹${total.toLocaleString('en-IN')}`,
      `• Reference Code: ${code}`,
      `Notes: ${notes || 'Ready to lock consultation slot.'}`
    ].join('\n');

    setTimeout(() => {
      window.open(`https://wa.me/917639459207?text=${encodeURIComponent(msg)}`, '_blank');
    }, 800);

  } catch (err) {
    alert(err.message || 'Failed to connect to the backend. Please ensure the server is running.');
  }
}

/* ========================================================
   3. DIRECT QUOTE FORM
   ======================================================== */
async function handleDirectQuoteSubmit(e) {
  e.preventDefault();
  const form = document.getElementById('quoteForm');
  const data = new FormData(form);

  const payload = {
    customer_name: data.get('name'),
    customer_phone: data.get('phone'),
    bike_model: data.get('bike'),
    service_type: data.get('type'),
    requirements: data.get('requirements')
  };

  try {
    const res = await fetch(`${API_BASE}/inquiries`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const result = await res.json();
    if (!res.ok || !result.success) {
      throw new Error(result.error || 'Unable to submit your inquiry.');
    }
    const code = result.tracking_code;

    const message = [
      'Hi HD CUSTOMS, I want a custom painting quote.',
      `Ref Code: ${code}`,
      `Name: ${payload.customer_name}`,
      `Phone: ${payload.customer_phone}`,
      `Bike: ${payload.bike_model}`,
      `Painting type: ${payload.service_type}`,
      `Requirements: ${payload.requirements || 'N/A'}`
    ].join('\n');

    window.open(`https://wa.me/917639459207?text=${encodeURIComponent(message)}`, '_blank');
    form.reset();
  } catch (err) {
    alert(err.message || 'Unable to submit your inquiry. Please try again.');
  }
}

/* ========================================================
   4. BEFORE & AFTER INTERACTIVE SLIDER
   ======================================================== */
function initBeforeAfterSlider() {
  const container = document.getElementById('baContainer');
  const beforeLayer = document.getElementById('baBefore');
  const handle = document.getElementById('baHandle');
  if (!container || !beforeLayer || !handle) return;

  let isDragging = false;

  function updateSlider(x) {
    const rect = container.getBoundingClientRect();
    let pos = ((x - rect.left) / rect.width) * 100;
    pos = Math.max(0, Math.min(100, pos));
    beforeLayer.style.width = `${pos}%`;
    handle.style.left = `${pos}%`;
  }

  container.addEventListener('mousedown', (e) => {
    isDragging = true;
    updateSlider(e.clientX);
  });
  window.addEventListener('mouseup', () => { isDragging = false; });
  window.addEventListener('mousemove', (e) => {
    if (isDragging) updateSlider(e.clientX);
  });

  container.addEventListener('touchstart', (e) => {
    isDragging = true;
    updateSlider(e.touches[0].clientX);
  });
  window.addEventListener('touchend', () => { isDragging = false; });
  window.addEventListener('touchmove', (e) => {
    if (isDragging) updateSlider(e.touches[0].clientX);
  });
}

/* ========================================================
   5. PUBLIC SHOWCASE GALLERY FROM DATABASE
   ======================================================== */
async function loadPublicGallery() {
  const grid = document.getElementById('publicGalleryGrid');
  if (!grid) return;

  try {
    const res = await fetch(`${API_BASE}/gallery`);
    const data = await res.json();
    if (!data.success) return;

    grid.innerHTML = '';
    data.items.forEach(item => {
      const card = document.createElement('article');
      card.className = 'service-card';
      card.style.cssText = 'padding:0;overflow:hidden;min-height:340px;justify-content:flex-start;';
      const imgSrc = getAssetUrl(item.after_image);
      card.innerHTML = `
        <div style="position:relative;height:200px;overflow:hidden;">
          <img src="${imgSrc}" alt="${item.title}" style="width:100%;height:100%;object-fit:cover;" />
          <span style="position:absolute;top:12px;left:12px;background:rgba(0,0,0,0.85);color:var(--gold-light);border:1px solid var(--gold);padding:3px 8px;border-radius:4px;font-size:10px;font-weight:700;">
            ${item.category}
          </span>
        </div>
        <div style="padding:20px;display:flex;flex-direction:column;flex:1;">
          <h3 style="font-size:18px;margin-bottom:4px;">${item.title}</h3>
          <div style="font-size:12px;color:var(--gold-light);font-weight:600;margin-bottom:8px;">${item.bike_model}</div>
          <p style="font-size:11px;color:var(--muted);line-height:1.5;margin-bottom:14px;flex:1;">${item.description || ''}</p>
          <div style="display:flex;justify-content:space-between;align-items:center;border-top:1px solid #27272a;padding-top:10px;">
            <button class="btn btn-secondary" style="padding:5px 10px;font-size:11px;" onclick="likeGalleryItem(${item.id}, this)">
              ❤️ <span class="like-count">${item.likes_count}</span>
            </button>
            <a href="https://wa.me/917639459207?text=${encodeURIComponent(`Hi HD CUSTOMS, I love this build: ${item.title} (${item.bike_model}). Can I get something similar?`)}" target="_blank" class="mini-link" style="font-size:11px;">
              Enquire This Look ↗
            </a>
          </div>
        </div>
      `;
      grid.appendChild(card);
    });
  } catch (err) {
    console.error('Error loading gallery from database:', err);
  }
}

async function likeGalleryItem(id, btn) {
  try {
    const res = await fetch(`${API_BASE}/gallery/${id}/like`, { method: 'POST' });
    const data = await res.json();
    if (data.success) {
      btn.querySelector('.like-count').textContent = data.likes;
    }
  } catch (err) {
    console.error('Failed to like item');
  }
}
