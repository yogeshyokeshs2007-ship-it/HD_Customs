// HD CUSTOMS Workshop OS - Dashboard Client Script & Database Connector

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

let authToken = localStorage.getItem('hdc_auth_token') || 'demo_token';
let currentTab = 'overview';
let allJobs = [];
let allInquiries = [];
let allInventory = [];
let allInvoices = [];
let studioSettings = {};

// On Load
document.addEventListener('DOMContentLoaded', () => {
  setupNavigation();
  setupEventListeners();
  checkAuth();
  checkDatabaseConnection();
  loadAllData();
});

// Setup Navigation
function setupNavigation() {
  document.querySelectorAll('.sidebar-menu .nav-item').forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const tab = item.getAttribute('data-tab');
      if (tab) switchTab(tab);
    });
  });

  const mobileToggle = document.getElementById('mobileToggle');
  const sidebar = document.getElementById('sidebar');
  mobileToggle?.addEventListener('click', () => {
    sidebar.classList.toggle('open');
  });

  // Close sidebar on click outside on mobile
  document.addEventListener('click', (e) => {
    if (window.innerWidth < 992 && !sidebar.contains(e.target) && !mobileToggle.contains(e.target)) {
      sidebar.classList.remove('open');
    }
  });
}

function switchTab(tabId) {
  currentTab = tabId;
  document.querySelectorAll('.sidebar-menu .nav-item').forEach(item => {
    item.classList.toggle('active', item.getAttribute('data-tab') === tabId);
  });

  document.querySelectorAll('.tab-panel').forEach(panel => {
    panel.classList.toggle('active', panel.id === `tab-${tabId}`);
  });

  // Update Topbar
  const titleMap = {
    overview: 'Studio Overview',
    jobs: 'Motorcycle Build Pipeline',
    inquiries: 'Website Quote Inquiries',
    inventory: 'Paints, Clearcoats & Consumables',
    invoices: 'Estimates & Invoicing',
    gallery: 'Portfolio & Transformations',
    settings: 'Studio Configuration'
  };
  const subtitleMap = {
    overview: 'Real-time studio health, active projects, and financials',
    jobs: 'Manage bike projects from bare metal to final mirror finish',
    inquiries: 'Inbound requests from prospective riders & custom enthusiasts',
    inventory: 'Paints, primers, pearls, abrasives, and studio stock levels',
    invoices: 'Generate professional job sheets, tax invoices, and receipts',
    gallery: 'Showcase before & after transformations to prospective clients',
    settings: 'Configure studio details, WhatsApp number, and payment information'
  };

  document.getElementById('pageTitle').textContent = titleMap[tabId] || 'Dashboard';
  document.getElementById('pageSubtitle').textContent = subtitleMap[tabId] || '';

  // Topbar button adjustments
  const topActionBtn = document.getElementById('topbarActionBtn');
  if (tabId === 'inventory') {
    topActionBtn.textContent = '+ Add Material';
    topActionBtn.onclick = openAddInventoryModal;
  } else if (tabId === 'invoices') {
    topActionBtn.textContent = '+ Create Invoice';
    topActionBtn.onclick = openNewInvoiceModal;
  } else if (tabId === 'gallery') {
    topActionBtn.textContent = '+ Upload Build';
    topActionBtn.onclick = openAddGalleryModal;
  } else {
    topActionBtn.textContent = '+ New Bike Job';
    topActionBtn.onclick = openNewJobModal;
  }

  // Refresh tab specific data if needed
  if (tabId === 'overview') loadAnalytics();
  if (tabId === 'jobs') loadJobs();
  if (tabId === 'inquiries') loadInquiries();
  if (tabId === 'inventory') loadInventory();
  if (tabId === 'invoices') loadInvoices();
  if (tabId === 'gallery') loadGallery();
  if (tabId === 'settings') loadSettings();
}

// Setup Event Listeners
function setupEventListeners() {
  // Job Filters
  document.getElementById('jobSearchInput')?.addEventListener('input', renderJobs);
  document.getElementById('jobStatusFilter')?.addEventListener('change', renderJobs);

  // Kanban / Table Toggle
  document.getElementById('viewKanbanBtn')?.addEventListener('click', () => {
    document.getElementById('jobsKanbanView').style.display = 'grid';
    document.getElementById('jobsTableView').style.display = 'none';
    document.getElementById('viewKanbanBtn').style.background = 'var(--gold)';
    document.getElementById('viewKanbanBtn').style.color = '#000';
    document.getElementById('viewTableBtn').style.background = 'transparent';
    document.getElementById('viewTableBtn').style.color = '#fff';
  });
  document.getElementById('viewTableBtn')?.addEventListener('click', () => {
    document.getElementById('jobsKanbanView').style.display = 'none';
    document.getElementById('jobsTableView').style.display = 'block';
    document.getElementById('viewTableBtn').style.background = 'var(--gold)';
    document.getElementById('viewTableBtn').style.color = '#000';
    document.getElementById('viewKanbanBtn').style.background = 'transparent';
    document.getElementById('viewKanbanBtn').style.color = '#fff';
  });

  // Inquiry Filters
  document.getElementById('inquirySearchInput')?.addEventListener('input', renderInquiries);
  document.getElementById('inquiryStatusFilter')?.addEventListener('change', renderInquiries);

  // Inventory Filters
  document.getElementById('inventorySearchInput')?.addEventListener('input', renderInventory);
  document.getElementById('inventoryCategoryFilter')?.addEventListener('change', renderInventory);

  // Invoice Filters
  document.getElementById('invoiceSearchInput')?.addEventListener('input', renderInvoices);
  document.getElementById('invoiceStatusFilter')?.addEventListener('change', renderInvoices);

  // Form Submissions
  document.getElementById('jobForm')?.addEventListener('submit', handleJobFormSubmit);
  document.getElementById('timelineForm')?.addEventListener('submit', handleTimelineFormSubmit);
  document.getElementById('inventoryForm')?.addEventListener('submit', handleInventoryFormSubmit);
  document.getElementById('invoiceForm')?.addEventListener('submit', handleInvoiceFormSubmit);
  document.getElementById('galleryForm')?.addEventListener('submit', handleGalleryFormSubmit);
  document.getElementById('settingsForm')?.addEventListener('submit', handleSettingsFormSubmit);
  document.getElementById('loginForm')?.addEventListener('submit', handleLoginSubmit);

  document.getElementById('logoutBtn')?.addEventListener('click', () => {
    localStorage.removeItem('hdc_auth_token');
    showModal('loginModal');
  });
}

// Check Database Connection Status
async function checkDatabaseConnection() {
  const statusEl = document.getElementById('dashDbStatus');
  try {
    const res = await fetch(`${API_BASE}/health`);
    const data = await res.json();
    if (data.status === 'online') {
      if (statusEl) {
        statusEl.innerHTML = `🟢 Database Connected (SQLite)`;
        statusEl.style.color = '#10b981';
        statusEl.style.borderColor = 'rgba(16,185,129,0.3)';
      }
    }
  } catch (err) {
    if (statusEl) {
      statusEl.innerHTML = `🔴 Backend Offline • Click to Reconnect`;
      statusEl.style.color = '#ef4444';
      statusEl.style.borderColor = 'rgba(239,68,68,0.3)';
      statusEl.onclick = () => {
        checkDatabaseConnection();
        loadAllData();
      };
    }
  }
}

// Auth Handling
async function checkAuth() {
  if (!authToken || authToken === 'demo_token') {
    const stored = localStorage.getItem('hdc_auth_token');
    if (!stored) {
      // By default open login modal if not authenticated
      showModal('loginModal');
    }
  }
}

async function handleLoginSubmit(e) {
  e.preventDefault();
  const username = document.getElementById('loginUsername').value;
  const password = document.getElementById('loginPassword').value;
  const errDiv = document.getElementById('loginError');

  try {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();
    if (data.success) {
      authToken = data.token;
      localStorage.setItem('hdc_auth_token', authToken);
      closeModal('loginModal');
      document.getElementById('userName').textContent = data.user.name;
      loadAllData();
    } else {
      errDiv.textContent = data.error || 'Invalid credentials';
      errDiv.style.display = 'block';
    }
  } catch (err) {
    errDiv.textContent = 'Server connection error. Make sure node server.js is running.';
    errDiv.style.display = 'block';
  }
}

// Initial Data Loading
async function loadAllData() {
  await Promise.all([
    loadAnalytics(),
    loadJobs(),
    loadInquiries(),
    loadInventory(),
    loadInvoices(),
    loadSettings()
  ]);
}

// 1. ANALYTICS & OVERVIEW
async function loadAnalytics() {
  try {
    const res = await fetch(`${API_BASE}/analytics`);
    const data = await res.json();
    if (!data.success) return;

    const { metrics, stageBreakdown, recentJobs } = data;

    // Metrics
    document.getElementById('statActiveJobs').textContent = metrics.activeJobs;
    document.getElementById('statReadyJobs').textContent = metrics.readyJobs;
    document.getElementById('statInquiries').textContent = metrics.pendingInquiries;
    document.getElementById('statPendingBalance').textContent = `₹${(metrics.pendingBalance || 0).toLocaleString('en-IN')}`;

    // Badges in sidebar
    document.getElementById('badgeActiveJobs').textContent = metrics.activeJobs;
    document.getElementById('badgeInquiries').textContent = metrics.pendingInquiries;

    const lowStockBadge = document.getElementById('badgeLowStock');
    if (metrics.lowStockCount > 0) {
      lowStockBadge.textContent = metrics.lowStockCount;
      lowStockBadge.style.display = 'inline-block';
    } else {
      lowStockBadge.style.display = 'none';
    }

    // Pipeline Stage Distribution
    const pipelineContainer = document.getElementById('overviewPipeline');
    pipelineContainer.innerHTML = '';
    const stages = [
      'Consultation & Intake',
      'Surface Stripping & Prep',
      'Epoxy Priming',
      'Custom Paint & Airbrush Art',
      'Clearcoat & Curing',
      'Polishing & Detailing',
      'Quality Check & Ready'
    ];

    const stageCounts = {};
    stageBreakdown.forEach(s => { stageCounts[s.current_stage] = s.count; });

    stages.forEach(stage => {
      const count = stageCounts[stage] || 0;
      const total = metrics.activeJobs + metrics.readyJobs || 1;
      const pct = Math.round((count / total) * 100);

      const div = document.createElement('div');
      div.className = 'stage-bar-item';
      div.innerHTML = `
        <div class="stage-bar-info">
          <span>${stage}</span>
          <span>${count} build${count === 1 ? '' : 's'} (${pct}%)</span>
        </div>
        <div class="stage-progress-track">
          <div class="stage-progress-fill" style="width: ${pct}%"></div>
        </div>
      `;
      pipelineContainer.appendChild(div);
    });

    // Recent Jobs in Overview Table
    const recentBody = document.getElementById('overviewRecentJobs');
    recentBody.innerHTML = '';
    recentJobs.forEach(job => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong style="font-family:monospace;color:var(--gold-light);">${job.tracking_code}</strong></td>
        <td>${job.customer_name}</td>
        <td><strong>${job.bike_model}</strong></td>
        <td><span class="badge badge-gold">${job.current_stage}</span></td>
        <td>
          <div style="display:flex;align-items:center;gap:8px;">
            <div style="flex:1;background:#27272a;height:6px;border-radius:3px;overflow:hidden;width:60px;">
              <div style="height:100%;width:${job.stage_progress}%;background:var(--gold);"></div>
            </div>
            <span>${job.stage_progress}%</span>
          </div>
        </td>
        <td><span class="badge ${job.status === 'Ready for Delivery' ? 'badge-success' : 'badge-warning'}">${job.status}</span></td>
        <td>
          <button class="btn-secondary" style="padding:4px 9px;font-size:11px;" onclick="openJobDetailModal(${job.id})">Details →</button>
        </td>
      `;
      recentBody.appendChild(tr);
    });

  } catch (err) {
    console.error('Error loading analytics:', err);
  }
}

// 2. JOBS MANAGEMENT
async function loadJobs() {
  try {
    const res = await fetch(`${API_BASE}/jobs`);
    const data = await res.json();
    if (data.success) {
      allJobs = data.jobs;
      renderJobs();
    }
  } catch (err) {
    console.error('Error loading jobs:', err);
  }
}

function renderJobs() {
  const searchTerm = (document.getElementById('jobSearchInput')?.value || '').toLowerCase();
  const statusFilter = document.getElementById('jobStatusFilter')?.value || 'All';

  const filtered = allJobs.filter(j => {
    const matchStatus = statusFilter === 'All' || j.status === statusFilter;
    const matchSearch = !searchTerm ||
      j.customer_name.toLowerCase().includes(searchTerm) ||
      j.customer_phone.includes(searchTerm) ||
      j.bike_model.toLowerCase().includes(searchTerm) ||
      j.tracking_code.toLowerCase().includes(searchTerm);
    return matchStatus && matchSearch;
  });

  // 1. Render Kanban View
  const kanbanContainer = document.getElementById('jobsKanbanView');
  kanbanContainer.innerHTML = '';

  const columns = [
    { title: 'Intake & Prep', stages: ['Consultation & Intake', 'Surface Stripping & Prep'] },
    { title: 'Priming & Base', stages: ['Epoxy Priming'] },
    { title: 'Artwork & Paint', stages: ['Custom Paint & Airbrush Art'] },
    { title: 'Clearcoat & Curing', stages: ['Clearcoat & Curing'] },
    { title: 'Buffing & Detailing', stages: ['Polishing & Detailing'] },
    { title: 'Ready / Delivered', stages: ['Quality Check & Ready', 'Ready for Delivery', 'Delivered'] }
  ];

  columns.forEach(col => {
    const colJobs = filtered.filter(j => {
      if (col.title === 'Ready / Delivered') {
        return j.current_stage === 'Quality Check & Ready' || j.status === 'Ready for Delivery' || j.status === 'Delivered';
      }
      return col.stages.includes(j.current_stage);
    });

    const colEl = document.createElement('div');
    colEl.className = 'kanban-col';
    colEl.innerHTML = `
      <div class="kanban-col-header">
        <h4>${col.title}</h4>
        <span class="kanban-count">${colJobs.length}</span>
      </div>
      <div class="kanban-cards-container">
        ${colJobs.length === 0 ? '<div style="color:#52525b;font-size:11px;text-align:center;padding:20px 0;">No active builds</div>' : ''}
      </div>
    `;

    const cardsContainer = colEl.querySelector('.kanban-cards-container');
    colJobs.forEach(job => {
      const card = document.createElement('div');
      card.className = 'kanban-card';
      card.onclick = () => openJobDetailModal(job.id);
      card.innerHTML = `
        <div class="kanban-card-top">
          <span class="kanban-code">${job.tracking_code}</span>
          <span class="badge ${job.status === 'Ready for Delivery' ? 'badge-success' : 'badge-warning'}">${job.status}</span>
        </div>
        <h5>${job.bike_model}</h5>
        <div class="kanban-customer">👤 ${job.customer_name} • ☎ ${job.customer_phone}</div>
        <div style="font-size:11px;color:var(--gold-light);margin-bottom:8px;">🎨 ${job.color_finish || job.service_type}</div>
        <div style="background:#27272a;height:5px;border-radius:3px;overflow:hidden;margin-bottom:8px;">
          <div style="height:100%;width:${job.stage_progress}%;background:var(--gold);"></div>
        </div>
        <div class="kanban-card-bottom">
          <span style="color:var(--text-muted);">${job.current_stage}</span>
          <span style="font-weight:700;color:#fff;">₹${(job.total_amount || 0).toLocaleString('en-IN')}</span>
        </div>
      `;
      cardsContainer.appendChild(card);
    });

    kanbanContainer.appendChild(colEl);
  });

  // 2. Render Table View
  const tableBody = document.getElementById('jobsTableBody');
  tableBody.innerHTML = '';
  filtered.forEach(job => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong style="font-family:monospace;color:var(--gold-light);">${job.tracking_code}</strong></td>
      <td><strong>${job.customer_name}</strong></td>
      <td>${job.customer_phone}</td>
      <td>${job.bike_model} ${job.reg_number ? `(${job.reg_number})` : ''}</td>
      <td><span class="badge badge-gold">${job.service_type}</span></td>
      <td>${job.current_stage}</td>
      <td>
        <div style="display:flex;align-items:gap:6px;">
          <div style="flex:1;background:#27272a;height:6px;border-radius:3px;overflow:hidden;width:50px;">
            <div style="height:100%;width:${job.stage_progress}%;background:var(--gold);"></div>
          </div>
          <span>${job.stage_progress}%</span>
        </div>
      </td>
      <td>
        <div style="font-size:11px;">
          <div>Total: ₹${(job.total_amount || 0).toLocaleString('en-IN')}</div>
          <div style="color:var(--gold-light);">Bal: ₹${(job.balance_due || 0).toLocaleString('en-IN')}</div>
        </div>
      </td>
      <td><span class="badge ${job.status === 'Ready for Delivery' ? 'badge-success' : 'badge-warning'}">${job.status}</span></td>
      <td>
        <div style="display:flex;gap:6px;">
          <button class="btn-secondary" style="padding:4px 8px;font-size:11px;" onclick="openJobDetailModal(${job.id})">View</button>
          <button class="btn-secondary" style="padding:4px 8px;font-size:11px;" onclick="editJob(${job.id})">Edit</button>
        </div>
      </td>
    `;
    tableBody.appendChild(tr);
  });
}

// Open Job Details & Timeline Modal
async function openJobDetailModal(jobId) {
  try {
    const res = await fetch(`${API_BASE}/jobs/${jobId}`);
    const data = await res.json();
    if (!data.success) return;

    const { job, timeline } = data;

    document.getElementById('jdm_title').textContent = `${job.bike_model} Build`;
    document.getElementById('jdm_code').textContent = job.tracking_code;
    document.getElementById('jdm_bike').textContent = `${job.bike_model} ${job.reg_number ? `(${job.reg_number})` : ''}`;
    document.getElementById('jdm_customer').textContent = `${job.customer_name} • Phone: ${job.customer_phone}`;
    document.getElementById('jdm_finish').textContent = `Finish Concept: ${job.color_finish || 'Custom Finishing'}`;

    document.getElementById('jdm_total').textContent = `Total: ₹${(job.total_amount || 0).toLocaleString('en-IN')}`;
    document.getElementById('jdm_advance').textContent = `Advance: ₹${(job.advance_paid || 0).toLocaleString('en-IN')}`;
    document.getElementById('jdm_balance').textContent = `Balance: ₹${(job.balance_due || 0).toLocaleString('en-IN')}`;

    // WhatsApp Dispatch Button
    document.getElementById('jdm_whatsapp_btn').onclick = () => {
      const publicTrackUrl = window.location.protocol === 'file:'
        ? `http://localhost:3000/#tracker`
        : `${window.location.origin}/#tracker`;
      const msg = [
        `🏍️ *HD CUSTOMS - Live Build Update*`,
        `Hi ${job.customer_name},`,
        `Here is the latest status on your *${job.bike_model}* (${job.tracking_code}):`,
        `• Current Stage: *${job.current_stage}*`,
        `• Progress: *${job.stage_progress}%*`,
        `• Status: *${job.status}*`,
        `• Balance Due: ₹${(job.balance_due || 0).toLocaleString('en-IN')}`,
        ``,
        `Track real-time photos & details on our website:`,
        `${publicTrackUrl}`,
        `Enter your Tracking Code: *${job.tracking_code}*`,
        ``,
        `- Hemanth & The HD CUSTOMS Team`
      ].join('\n');
      window.open(`https://wa.me/91${job.customer_phone}?text=${encodeURIComponent(msg)}`, '_blank');
    };

    // Invoice Button
    document.getElementById('jdm_invoice_btn').onclick = () => {
      closeModal('jobDetailModal');
      openNewInvoiceModalForJob(job);
    };

    // Edit Button
    document.getElementById('jdm_edit_btn').onclick = () => {
      closeModal('jobDetailModal');
      editJob(job.id);
    };

    // Setup timeline submission hidden id
    document.getElementById('timeline_job_id').value = job.id;
    document.getElementById('tf_stage').value = job.current_stage;

    // Render Timeline records
    const timelineList = document.getElementById('jdm_timeline_list');
    timelineList.innerHTML = '';
    if (timeline.length === 0) {
      timelineList.innerHTML = '<p style="color:#71717a;font-size:12px;">No stage records yet.</p>';
    } else {
      timeline.forEach(item => {
        const itemEl = document.createElement('div');
        itemEl.style.cssText = 'background:#141418;border-left:3px solid var(--gold);padding:12px 16px;border-radius:4px;';
        const photoSrc = item.photo_url ? getAssetUrl(item.photo_url) : '';
        itemEl.innerHTML = `
          <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
            <strong style="color:#fff;font-size:13px;">${item.title}</strong>
            <span style="font-size:11px;color:var(--text-muted);">${item.created_at}</span>
          </div>
          <div style="font-size:11px;color:var(--gold-light);margin-bottom:6px;">Stage: ${item.stage_name}</div>
          <p style="font-size:12px;color:#d4d4d8;line-height:1.5;">${item.notes || ''}</p>
          ${photoSrc ? `<img src="${photoSrc}" style="max-height:160px;border-radius:6px;margin-top:8px;border:1px solid #333;" />` : ''}
        `;
        timelineList.appendChild(itemEl);
      });
    }

    showModal('jobDetailModal');
  } catch (err) {
    console.error('Error opening job details:', err);
  }
}

function toggleAddTimelineForm() {
  const box = document.getElementById('addTimelineBox');
  box.style.display = box.style.display === 'none' ? 'block' : 'none';
}

async function handleTimelineFormSubmit(e) {
  e.preventDefault();
  const form = document.getElementById('timelineForm');
  const jobId = document.getElementById('timeline_job_id').value;
  const formData = new FormData(form);

  try {
    const res = await fetch(`${API_BASE}/jobs/${jobId}/timeline`, {
      method: 'POST',
      body: formData
    });
    const data = await res.json();
    if (data.success) {
      form.reset();
      toggleAddTimelineForm();
      openJobDetailModal(jobId);
      loadJobs();
    }
  } catch (err) {
    alert('Failed to post timeline update');
  }
}

function showModal(id) {
  document.getElementById(id)?.classList.add('active');
}
function closeModal(id) {
  document.getElementById(id)?.classList.remove('active');
}

function openNewJobModal() {
  document.getElementById('jobModalTitle').textContent = 'Intake New Motorcycle Build';
  document.getElementById('jobEditId').value = '';
  document.getElementById('jobForm').reset();
  showModal('jobModal');
}

function editJob(jobId) {
  const job = allJobs.find(j => j.id === jobId);
  if (!job) return;

  document.getElementById('jobModalTitle').textContent = `Edit Build: ${job.bike_model} (${job.tracking_code})`;
  document.getElementById('jobEditId').value = job.id;
  document.getElementById('jf_customer_name').value = job.customer_name;
  document.getElementById('jf_customer_phone').value = job.customer_phone;
  document.getElementById('jf_bike_model').value = job.bike_model;
  document.getElementById('jf_reg_number').value = job.reg_number || '';
  document.getElementById('jf_service_type').value = job.service_type;
  document.getElementById('jf_color_finish').value = job.color_finish || '';
  document.getElementById('jf_current_stage').value = job.current_stage;
  document.getElementById('jf_stage_progress').value = job.stage_progress;
  document.getElementById('jf_total_amount').value = job.total_amount;
  document.getElementById('jf_advance_paid').value = job.advance_paid;
  document.getElementById('jf_status').value = job.status;
  document.getElementById('jf_estimated_delivery').value = job.estimated_delivery || '';
  document.getElementById('jf_notes').value = job.notes || '';

  showModal('jobModal');
}

async function handleJobFormSubmit(e) {
  e.preventDefault();
  const form = document.getElementById('jobForm');
  const jobId = document.getElementById('jobEditId').value;
  const formData = new FormData(form);

  const url = jobId ? `${API_BASE}/jobs/${jobId}` : `${API_BASE}/jobs`;
  const method = jobId ? 'PUT' : 'POST';

  try {
    const res = await fetch(url, { method, body: formData });
    const data = await res.json();
    if (data.success) {
      closeModal('jobModal');
      form.reset();
      await loadJobs();
      await loadAnalytics();
    } else {
      alert(data.error || 'Failed to save job');
    }
  } catch (err) {
    alert('Server connection error. Please make sure node server.js is running.');
  }
}

// 3. INQUIRIES MANAGEMENT
async function loadInquiries() {
  try {
    const res = await fetch(`${API_BASE}/inquiries`);
    const data = await res.json();
    if (data.success) {
      allInquiries = data.inquiries;
      renderInquiries();
    }
  } catch (err) {
    console.error('Error loading inquiries:', err);
  }
}

function renderInquiries() {
  const searchTerm = (document.getElementById('inquirySearchInput')?.value || '').toLowerCase();
  const statusFilter = document.getElementById('inquiryStatusFilter')?.value || 'All';

  const filtered = allInquiries.filter(i => {
    const matchStatus = statusFilter === 'All' || i.status === statusFilter;
    const matchSearch = !searchTerm ||
      i.customer_name.toLowerCase().includes(searchTerm) ||
      i.customer_phone.includes(searchTerm) ||
      i.bike_model.toLowerCase().includes(searchTerm);
    return matchStatus && matchSearch;
  });

  const body = document.getElementById('inquiriesTableBody');
  body.innerHTML = '';

  filtered.forEach(inq => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong style="font-family:monospace;color:var(--blue);">${inq.tracking_code}</strong></td>
      <td><strong>${inq.customer_name}</strong></td>
      <td>${inq.customer_phone}</td>
      <td>${inq.bike_model}</td>
      <td>
        <div><strong>${inq.service_type}</strong></div>
        <small style="color:var(--text-muted);">${inq.finish_type || 'Custom Finish'}</small>
      </td>
      <td style="max-width:240px;font-size:11px;color:#d4d4d8;">${inq.requirements || 'N/A'}</td>
      <td><strong>₹${(inq.estimated_budget || 0).toLocaleString('en-IN')}</strong></td>
      <td>
        <select class="form-control" style="padding:4px 6px;font-size:11px;" onchange="updateInquiryStatus(${inq.id}, this.value)">
          <option ${inq.status === 'New' ? 'selected' : ''}>New</option>
          <option ${inq.status === 'Contacted' ? 'selected' : ''}>Contacted</option>
          <option ${inq.status === 'Quoted' ? 'selected' : ''}>Quoted</option>
          <option ${inq.status === 'Converted' ? 'selected' : ''}>Converted</option>
          <option ${inq.status === 'Archived' ? 'selected' : ''}>Archived</option>
        </select>
      </td>
      <td>
        <div style="display:flex;gap:6px;">
          <button class="btn-primary" style="padding:4px 8px;font-size:11px;" onclick="replyInquiryWhatsApp(${inq.id})" title="Reply via WhatsApp">
            💬 Reply
          </button>
          ${inq.status !== 'Converted' ? `
            <button class="btn-secondary" style="padding:4px 8px;font-size:11px;" onclick="convertInquiryToJob(${inq.id})" title="Convert to Active Build">
              🏍️ Convert
            </button>
          ` : ''}
        </div>
      </td>
    `;
    body.appendChild(tr);
  });
}

async function updateInquiryStatus(id, newStatus) {
  try {
    await fetch(`${API_BASE}/inquiries/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus })
    });
    loadAnalytics();
  } catch (err) {
    console.error('Failed to update status');
  }
}

function replyInquiryWhatsApp(id) {
  const inq = allInquiries.find(i => i.id === id);
  if (!inq) return;

  const msg = [
    `Hi ${inq.customer_name},`,
    `Thank you for inquiring with *HD CUSTOMS* regarding your *${inq.bike_model}*!`,
    `We reviewed your requested service: *${inq.service_type}* (${inq.finish_type || 'Custom Finish'}).`,
    `Estimated Consultation Quote: ₹${(inq.estimated_budget || 20000).toLocaleString('en-IN')}`,
    ``,
    `We would love to discuss your design idea and show you sample panels. Would you like to schedule a studio visit or discuss colours?`,
    ``,
    `- Hemanth (Lead Artist, HD CUSTOMS)`
  ].join('\n');

  window.open(`https://wa.me/91${inq.customer_phone}?text=${encodeURIComponent(msg)}`, '_blank');
}

async function convertInquiryToJob(id) {
  if (!confirm('Convert this inquiry into an active workshop motorcycle job?')) return;
  try {
    const res = await fetch(`${API_BASE}/inquiries/${id}/convert`, { method: 'POST', body: JSON.stringify({}) });
    const data = await res.json();
    if (data.success) {
      alert(`Success! Created Job #${data.tracking_code}`);
      await loadInquiries();
      await loadJobs();
      await loadAnalytics();
      switchTab('jobs');
    }
  } catch (err) {
    alert('Failed to convert inquiry');
  }
}

// 4. INVENTORY MANAGEMENT
async function loadInventory() {
  try {
    const res = await fetch(`${API_BASE}/inventory`);
    const data = await res.json();
    if (data.success) {
      allInventory = data.items;
      renderInventory();
    }
  } catch (err) {
    console.error('Error loading inventory:', err);
  }
}

function renderInventory() {
  const searchTerm = (document.getElementById('inventorySearchInput')?.value || '').toLowerCase();
  const categoryFilter = document.getElementById('inventoryCategoryFilter')?.value || 'All';

  const filtered = allInventory.filter(item => {
    const matchCat = categoryFilter === 'All' || item.category === categoryFilter;
    const matchSearch = !searchTerm ||
      item.item_name.toLowerCase().includes(searchTerm) ||
      item.item_code.toLowerCase().includes(searchTerm) ||
      (item.supplier && item.supplier.toLowerCase().includes(searchTerm));
    return matchCat && matchSearch;
  });

  const body = document.getElementById('inventoryTableBody');
  body.innerHTML = '';

  filtered.forEach(item => {
    const isLow = item.quantity <= item.min_threshold;
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong style="font-family:monospace;color:var(--text-muted);">${item.item_code}</strong></td>
      <td><strong>${item.item_name}</strong></td>
      <td><span class="badge badge-info">${item.category}</span></td>
      <td>
        <strong style="font-size:13px;color:${isLow ? 'var(--red)' : '#fff'};">${item.quantity} ${item.unit}</strong>
      </td>
      <td>${item.min_threshold} ${item.unit}</td>
      <td>₹${(item.unit_price || 0).toLocaleString('en-IN')}</td>
      <td>${item.supplier || '-'}</td>
      <td>
        ${isLow ? '<span class="badge badge-danger">⚠️ Low Stock</span>' : '<span class="badge badge-success">✓ In Stock</span>'}
      </td>
      <td>
        <div style="display:flex;gap:4px;">
          <button class="btn-secondary" style="padding:2px 7px;font-size:11px;" onclick="adjustInventory(${item.id}, 1)">+1</button>
          <button class="btn-secondary" style="padding:2px 7px;font-size:11px;" onclick="adjustInventory(${item.id}, -1)">-1</button>
        </div>
      </td>
      <td>
        <button class="btn-icon-danger" onclick="deleteInventoryItem(${item.id})" title="Delete item">🗑️</button>
      </td>
    `;
    body.appendChild(tr);
  });
}

function openAddInventoryModal() {
  document.getElementById('inventoryForm').reset();
  showModal('inventoryModal');
}

async function handleInventoryFormSubmit(e) {
  e.preventDefault();
  const form = document.getElementById('inventoryForm');
  const formData = new FormData(form);
  const json = Object.fromEntries(formData.entries());

  try {
    const res = await fetch(`${API_BASE}/inventory`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(json)
    });
    const data = await res.json();
    if (data.success) {
      closeModal('inventoryModal');
      form.reset();
      await loadInventory();
      await loadAnalytics();
    }
  } catch (err) {
    alert('Failed to save material');
  }
}

async function adjustInventory(id, delta) {
  try {
    await fetch(`${API_BASE}/inventory/${id}/adjust`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ delta })
    });
    await loadInventory();
    await loadAnalytics();
  } catch (err) {
    console.error('Failed to adjust inventory');
  }
}

async function deleteInventoryItem(id) {
  if (!confirm('Remove this item from inventory?')) return;
  try {
    await fetch(`${API_BASE}/inventory/${id}`, { method: 'DELETE' });
    await loadInventory();
    await loadAnalytics();
  } catch (err) {
    alert('Failed to delete item');
  }
}

// 5. INVOICES & BILLING
async function loadInvoices() {
  try {
    const res = await fetch(`${API_BASE}/invoices`);
    const data = await res.json();
    if (data.success) {
      allInvoices = data.invoices;
      renderInvoices();
    }
  } catch (err) {
    console.error('Error loading invoices:', err);
  }
}

function renderInvoices() {
  const searchTerm = (document.getElementById('invoiceSearchInput')?.value || '').toLowerCase();
  const statusFilter = document.getElementById('invoiceStatusFilter')?.value || 'All';

  const filtered = allInvoices.filter(inv => {
    const matchStatus = statusFilter === 'All' || inv.payment_status === statusFilter;
    const matchSearch = !searchTerm ||
      inv.invoice_number.toLowerCase().includes(searchTerm) ||
      inv.customer_name.toLowerCase().includes(searchTerm) ||
      inv.customer_phone.includes(searchTerm) ||
      inv.bike_model.toLowerCase().includes(searchTerm);
    return matchStatus && matchSearch;
  });

  const body = document.getElementById('invoicesTableBody');
  body.innerHTML = '';

  filtered.forEach(inv => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong style="font-family:monospace;color:var(--gold-light);">${inv.invoice_number}</strong></td>
      <td><strong>${inv.customer_name}</strong></td>
      <td>${inv.customer_phone}</td>
      <td>${inv.bike_model}</td>
      <td><strong>₹${(inv.total_amount || 0).toLocaleString('en-IN')}</strong></td>
      <td style="color:var(--green);">₹${(inv.paid_amount || 0).toLocaleString('en-IN')}</td>
      <td style="color:${inv.balance_due > 0 ? 'var(--gold-light)' : 'var(--text-muted)'};font-weight:700;">
        ₹${(inv.balance_due || 0).toLocaleString('en-IN')}
      </td>
      <td>
        <span class="badge ${inv.payment_status === 'Paid' ? 'badge-success' : (inv.payment_status === 'Partial' ? 'badge-warning' : 'badge-danger')}">
          ${inv.payment_status}
        </span>
      </td>
      <td>${(inv.created_at || '').split(' ')[0]}</td>
      <td>
        <div style="display:flex;gap:6px;">
          <button class="btn-primary" style="padding:4px 8px;font-size:11px;" onclick="viewInvoice(${inv.id})">🖨️ View / Print</button>
        </div>
      </td>
    `;
    body.appendChild(tr);
  });
}

function openNewInvoiceModal() {
  document.getElementById('invoiceForm').reset();
  document.getElementById('inv_job_id').value = '';
  document.getElementById('invoiceItemsContainer').innerHTML = '';
  addInvoiceItemRow('Custom Motorcycle Paint Job', 1, 20000);
  addInvoiceItemRow('Clearcoat & Mirror Buff Finish', 1, 5000);
  calculateInvoiceTotal();
  showModal('invoiceModal');
}

function openNewInvoiceModalForJob(job) {
  document.getElementById('invoiceForm').reset();
  document.getElementById('inv_job_id').value = job.id;
  document.getElementById('inv_customer_name').value = job.customer_name;
  document.getElementById('inv_customer_phone').value = job.customer_phone;
  document.getElementById('inv_bike_model').value = job.bike_model;
  document.getElementById('inv_paid').value = job.advance_paid || 0;

  document.getElementById('invoiceItemsContainer').innerHTML = '';
  addInvoiceItemRow(`${job.service_type} - ${job.color_finish || 'Custom Concept'}`, 1, job.total_amount || 25000);
  calculateInvoiceTotal();
  showModal('invoiceModal');
}

function addInvoiceItemRow(description = '', qty = 1, rate = 0) {
  const container = document.getElementById('invoiceItemsContainer');
  const div = document.createElement('div');
  div.style.cssText = 'display:grid;grid-template-columns:3fr 1fr 1.5fr auto;gap:8px;align-items:center;';
  div.innerHTML = `
    <input type="text" class="form-control item-desc" placeholder="Work description" value="${description}" required />
    <input type="number" class="form-control item-qty" value="${qty}" min="1" oninput="calculateInvoiceTotal()" />
    <input type="number" class="form-control item-rate" value="${rate}" oninput="calculateInvoiceTotal()" />
    <button type="button" class="btn-icon-danger" onclick="this.parentElement.remove();calculateInvoiceTotal();">✕</button>
  `;
  container.appendChild(div);
  calculateInvoiceTotal();
}

function calculateInvoiceTotal() {
  const descs = document.querySelectorAll('#invoiceItemsContainer .item-desc');
  const qtys = document.querySelectorAll('#invoiceItemsContainer .item-qty');
  const rates = document.querySelectorAll('#invoiceItemsContainer .item-rate');

  let subtotal = 0;
  for (let i = 0; i < qtys.length; i++) {
    const q = parseFloat(qtys[i].value) || 0;
    const r = parseFloat(rates[i].value) || 0;
    subtotal += (q * r);
  }

  const discount = parseFloat(document.getElementById('inv_discount').value) || 0;
  const total = Math.max(0, subtotal - discount);
  const paid = parseFloat(document.getElementById('inv_paid').value) || 0;
  const balance = Math.max(0, total - paid);

  document.getElementById('inv_calc_total').textContent = `₹${total.toLocaleString('en-IN')}`;
  document.getElementById('inv_calc_balance').textContent = `₹${balance.toLocaleString('en-IN')}`;
}

async function handleInvoiceFormSubmit(e) {
  e.preventDefault();
  const descs = document.querySelectorAll('#invoiceItemsContainer .item-desc');
  const qtys = document.querySelectorAll('#invoiceItemsContainer .item-qty');
  const rates = document.querySelectorAll('#invoiceItemsContainer .item-rate');

  const items = [];
  for (let i = 0; i < qtys.length; i++) {
    items.push({
      description: descs[i].value,
      qty: parseFloat(qtys[i].value) || 1,
      rate: parseFloat(rates[i].value) || 0,
      amount: (parseFloat(qtys[i].value) || 1) * (parseFloat(rates[i].value) || 0)
    });
  }

  const payload = {
    job_id: document.getElementById('inv_job_id').value || null,
    customer_name: document.getElementById('inv_customer_name').value,
    customer_phone: document.getElementById('inv_customer_phone').value,
    bike_model: document.getElementById('inv_bike_model').value,
    payment_method: document.querySelector('#invoiceForm select[name="payment_method"]').value,
    items,
    discount: parseFloat(document.getElementById('inv_discount').value) || 0,
    paid_amount: parseFloat(document.getElementById('inv_paid').value) || 0,
    notes: document.querySelector('#invoiceForm textarea[name="notes"]').value
  };

  try {
    const res = await fetch(`${API_BASE}/invoices`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (data.success) {
      closeModal('invoiceModal');
      await loadInvoices();
      await loadJobs();
      await loadAnalytics();
      viewInvoice(data.id);
    }
  } catch (err) {
    alert('Failed to generate invoice');
  }
}

// Printable Invoice Formatter
async function viewInvoice(id) {
  try {
    const res = await fetch(`${API_BASE}/invoices/${id}`);
    const data = await res.json();
    if (!data.success) return;

    const inv = data.invoice;
    const printContainer = document.getElementById('printableInvoiceContent');

    const itemsRows = inv.items.map((it, idx) => `
      <tr style="border-bottom:1px solid #e4e4e7;">
        <td style="padding:10px 8px;">${idx + 1}</td>
        <td style="padding:10px 8px;"><strong>${it.description}</strong></td>
        <td style="padding:10px 8px;text-align:center;">${it.qty}</td>
        <td style="padding:10px 8px;text-align:right;">₹${(it.rate || 0).toLocaleString('en-IN')}</td>
        <td style="padding:10px 8px;text-align:right;">₹${((it.qty * it.rate) || 0).toLocaleString('en-IN')}</td>
      </tr>
    `).join('');

    printContainer.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid #d9a21b;padding-bottom:18px;margin-bottom:20px;">
        <div>
          <h1 style="font-family:'Oswald',sans-serif;font-size:28px;letter-spacing:1px;color:#000;margin:0;">HD CUSTOMS</h1>
          <p style="font-size:12px;color:#555;margin:4px 0 0;">Custom Motorcycle Painting & Artistic Studio</p>
          <p style="font-size:11px;color:#666;">Perumal Kovil Street, Vellerithangal, Papparambakam, TN 602025</p>
          <p style="font-size:11px;color:#666;">Phone / WhatsApp: +91 7639459207 • Instagram: @hd_customs_</p>
        </div>
        <div style="text-align:right;">
          <h2 style="font-size:22px;color:#d9a21b;margin:0;">ESTIMATE & INVOICE</h2>
          <p style="font-size:13px;font-family:monospace;font-weight:bold;margin:4px 0;"># ${inv.invoice_number}</p>
          <p style="font-size:12px;color:#666;">Date: ${(inv.created_at || '').split(' ')[0]}</p>
        </div>
      </div>

      <div style="display:flex;justify-content:space-between;margin-bottom:24px;background:#f8f9fa;padding:14px;border-radius:6px;">
        <div>
          <div style="font-size:11px;color:#777;text-transform:uppercase;font-weight:bold;">BILLED TO:</div>
          <h3 style="font-size:16px;margin:3px 0;color:#111;">${inv.customer_name}</h3>
          <p style="font-size:12px;margin:2px 0;">Phone: <strong>${inv.customer_phone}</strong></p>
          <p style="font-size:12px;margin:2px 0;">Motorcycle: <strong>${inv.bike_model}</strong></p>
        </div>
        <div style="text-align:right;">
          <div style="font-size:11px;color:#777;text-transform:uppercase;font-weight:bold;">PAYMENT STATUS:</div>
          <span style="display:inline-block;padding:4px 10px;border-radius:4px;font-weight:bold;font-size:12px;margin-top:4px;background:${inv.payment_status === 'Paid' ? '#dcfce7;color:#15803d' : '#fef3c7;color:#b45309'};">
            ${inv.payment_status.toUpperCase()}
          </span>
          <p style="font-size:12px;color:#555;margin-top:6px;">Method: ${inv.payment_method || 'UPI'}</p>
        </div>
      </div>

      <table style="width:100%;border-collapse:collapse;font-size:12px;margin-bottom:20px;">
        <thead>
          <tr style="background:#111;color:#fff;">
            <th style="padding:10px 8px;text-align:left;width:30px;">#</th>
            <th style="padding:10px 8px;text-align:left;">Job Description / Craftsmanship Item</th>
            <th style="padding:10px 8px;text-align:center;width:50px;">Qty</th>
            <th style="padding:10px 8px;text-align:right;width:100px;">Rate</th>
            <th style="padding:10px 8px;text-align:right;width:120px;">Amount</th>
          </tr>
        </thead>
        <tbody>
          ${itemsRows}
        </tbody>
      </table>

      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-top:20px;">
        <div style="max-width:380px;">
          <h4 style="font-size:12px;text-transform:uppercase;margin-bottom:4px;">Payment via UPI:</h4>
          <p style="font-size:12px;font-family:monospace;background:#eee;padding:6px 10px;border-radius:4px;display:inline-block;">7639459207@upi</p>
          <p style="font-size:11px;color:#666;margin-top:8px;">Notes: ${inv.notes || 'All custom paintwork backed by studio quality guarantee.'}</p>
        </div>
        <div style="width:260px;font-size:13px;">
          <div style="display:flex;justify-content:space-between;padding:4px 0;">
            <span>Subtotal:</span>
            <span>₹${(inv.subtotal || 0).toLocaleString('en-IN')}</span>
          </div>
          ${inv.discount > 0 ? `
            <div style="display:flex;justify-content:space-between;padding:4px 0;color:#15803d;">
              <span>Discount:</span>
              <span>- ₹${(inv.discount || 0).toLocaleString('en-IN')}</span>
            </div>
          ` : ''}
          <div style="display:flex;justify-content:space-between;padding:6px 0;border-top:1px solid #ccc;font-weight:bold;font-size:15px;">
            <span>Total Amount:</span>
            <span>₹${(inv.total_amount || 0).toLocaleString('en-IN')}</span>
          </div>
          <div style="display:flex;justify-content:space-between;padding:4px 0;color:#15803d;font-weight:bold;">
            <span>Paid / Advance:</span>
            <span>₹${(inv.paid_amount || 0).toLocaleString('en-IN')}</span>
          </div>
          <div style="display:flex;justify-content:space-between;padding:6px 0;border-top:2px solid #111;font-size:16px;font-weight:bold;color:#b45309;">
            <span>Balance Due:</span>
            <span>₹${(inv.balance_due || 0).toLocaleString('en-IN')}</span>
          </div>
        </div>
      </div>

      <div style="margin-top:36px;padding-top:14px;border-top:1px solid #eee;display:flex;justify-content:space-between;font-size:11px;color:#777;">
        <div>Customer Signature: _______________________</div>
        <div>For HD CUSTOMS (Authorized Signatory)</div>
      </div>
    `;

    showModal('viewInvoiceModal');
  } catch (err) {
    alert('Failed to load invoice');
  }
}

// 6. SHOWCASE GALLERY
async function loadGallery() {
  try {
    const res = await fetch(`${API_BASE}/gallery`);
    const data = await res.json();
    if (!data.success) return;

    const grid = document.getElementById('galleryGrid');
    grid.innerHTML = '';

    data.items.forEach(item => {
      const card = document.createElement('div');
      card.className = 'card';
      const imgSrc = getAssetUrl(item.after_image);
      card.innerHTML = `
        <img src="${imgSrc}" style="width:100%;height:180px;object-fit:cover;border-radius:8px;margin-bottom:12px;border:1px solid #333;" />
        <h4 style="font-size:16px;color:#fff;">${item.title}</h4>
        <div style="font-size:12px;color:var(--gold-light);margin-bottom:6px;">${item.bike_model} • ${item.category}</div>
        <p style="font-size:11px;color:var(--text-muted);line-height:1.5;margin-bottom:12px;">${item.description || ''}</p>
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <span style="font-size:11px;color:var(--text-muted);">❤️ ${item.likes_count} likes</span>
          <button class="btn-icon-danger" onclick="deleteGalleryItem(${item.id})">🗑️ Delete</button>
        </div>
      `;
      grid.appendChild(card);
    });
  } catch (err) {
    console.error('Error loading gallery:', err);
  }
}

function openAddGalleryModal() {
  document.getElementById('galleryForm').reset();
  showModal('galleryModal');
}

async function handleGalleryFormSubmit(e) {
  e.preventDefault();
  const form = document.getElementById('galleryForm');
  const formData = new FormData(form);

  try {
    const res = await fetch(`${API_BASE}/gallery`, { method: 'POST', body: formData });
    const data = await res.json();
    if (data.success) {
      closeModal('galleryModal');
      form.reset();
      loadGallery();
    }
  } catch (err) {
    alert('Failed to upload showcase');
  }
}

async function deleteGalleryItem(id) {
  if (!confirm('Remove this build from public showcase?')) return;
  try {
    await fetch(`${API_BASE}/gallery/${id}`, { method: 'DELETE' });
    loadGallery();
  } catch (err) {
    alert('Failed to delete');
  }
}

// 7. SETTINGS
async function loadSettings() {
  try {
    const res = await fetch(`${API_BASE}/settings`);
    const data = await res.json();
    if (!data.success) return;

    studioSettings = data.settings;
    const form = document.getElementById('settingsForm');
    for (const [key, val] of Object.entries(studioSettings)) {
      const input = form.querySelector(`[name="${key}"]`);
      if (input) input.value = val;
    }
  } catch (err) {
    console.error('Error loading settings:', err);
  }
}

async function handleSettingsFormSubmit(e) {
  e.preventDefault();
  const form = document.getElementById('settingsForm');
  const formData = new FormData(form);
  const json = Object.fromEntries(formData.entries());

  try {
    const res = await fetch(`${API_BASE}/settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(json)
    });
    const data = await res.json();
    if (data.success) {
      alert('Studio settings updated successfully!');
      loadSettings();
    }
  } catch (err) {
    alert('Failed to save settings');
  }
}
