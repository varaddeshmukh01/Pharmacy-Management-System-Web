/**
 * Pharmacy Management System - Frontend Application Logic
 * Single Page Architecture connected to Node.js & MySQL
 */

// Application State
const state = {
  token: localStorage.getItem('pharmacy_token') || null,
  user: JSON.parse(localStorage.getItem('pharmacy_user') || 'null'),
  currentView: 'dashboard',
  drugsCache: [],
  companiesCache: [],
  confirmCallback: null
};

// =============================================================================
// API Request Helper
// =============================================================================
async function api(endpoint, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  if (state.token) {
    headers['Authorization'] = `Bearer ${state.token}`;
  }

  try {
    const res = await fetch(endpoint, { ...options, headers });
    const data = await res.json();

    if (res.status === 401 || res.status === 403) {
      if (data.message && data.message.includes('expired') || res.status === 401) {
        logoutUser();
        showToast('Session expired. Please log in again.', 'warning');
      }
    }

    if (!res.ok) {
      throw new Error(data.message || `Request failed with status ${res.status}`);
    }
    return data;
  } catch (err) {
    console.error(`API Error [${endpoint}]:`, err);
    throw err;
  }
}

// =============================================================================
// Toast Notifications & Modals
// =============================================================================
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;

  const icon = type === 'success' ? '✅' : type === 'error' ? '❌' : type === 'warning' ? '⚠️' : 'ℹ️';
  toast.innerHTML = `<span>${icon}</span> <span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.classList.add('active');
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.classList.remove('active');
}

function showConfirm(title, message, onConfirm) {
  document.getElementById('confirm-title').textContent = title || 'Are you sure?';
  document.getElementById('confirm-message').textContent = message || 'Do you want to proceed with this deletion?';
  state.confirmCallback = onConfirm;
  openModal('modal-confirm');
}

// =============================================================================
// Live Clock & Date
// =============================================================================
function startLiveClock() {
  function updateTime() {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    document.getElementById('live-clock').textContent = `${hours}:${minutes}:${seconds}`;

    const day = String(now.getDate()).padStart(2, '0');
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const year = now.getFullYear();
    document.getElementById('live-date').textContent = `${day}-${month}-${year}`;
  }
  updateTime();
  setInterval(updateTime, 1000);
}

// =============================================================================
// Authentication & User Session
// =============================================================================
function initAuth() {
  if (!state.token || !state.user) {
    document.getElementById('login-overlay').style.display = 'flex';
  } else {
    document.getElementById('login-overlay').style.display = 'none';
    updateUserUI();
    loadDashboardStats();
    loadInboxCount();
  }

  // Login form handler
  document.getElementById('form-login').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('login-id-input').value.trim();
    const password = document.getElementById('login-pass-input').value;

    try {
      const res = await api('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ id, password })
      });

      if (res.success) {
        state.token = res.token;
        state.user = res.user;
        localStorage.setItem('pharmacy_token', res.token);
        localStorage.setItem('pharmacy_user', JSON.stringify(res.user));

        document.getElementById('login-overlay').style.display = 'none';
        updateUserUI();
        showToast(`Welcome back, ${res.user.name}! (Role: ${res.user.role})`, 'success');
        navigateTo('dashboard');
        loadDashboardStats();
        loadInboxCount();
      }
    } catch (err) {
      showToast(err.message || 'Login failed.', 'error');
    }
  });

  // Logout handler
  document.getElementById('btn-logout').addEventListener('click', () => {
    showConfirm('Confirm Logout', 'Are you sure you want to end your session?', () => {
      logoutUser();
      showToast('Logged out successfully.', 'info');
    });
  });
}

function updateUserUI() {
  if (!state.user) return;
  const roleBadge = document.getElementById('user-role-badge');
  roleBadge.textContent = `Login As: ${state.user.role}`;
  if (state.user.role === 'Admin') {
    roleBadge.classList.add('admin');
  } else {
    roleBadge.classList.remove('admin');
  }
  document.getElementById('user-display-name').textContent = state.user.name;
  const posCashier = document.getElementById('pos-cashier-name');
  if (posCashier) posCashier.textContent = state.user.name;
}

function logoutUser() {
  state.token = null;
  state.user = null;
  localStorage.removeItem('pharmacy_token');
  localStorage.removeItem('pharmacy_user');
  document.getElementById('login-overlay').style.display = 'flex';
}

// =============================================================================
// Navigation & Views
// =============================================================================
function navigateTo(viewName) {
  // Check permission for User module (Employees need Admin)
  if (viewName === 'users' && state.user && state.user.role !== 'Admin') {
    showToast('Access restricted: Only Administrators can manage system users.', 'warning');
    return;
  }

  state.currentView = viewName;

  // Update navigation bar items
  document.querySelectorAll('.nav-item').forEach(item => {
    if (item.getAttribute('data-view') === viewName) {
      item.classList.add('active');
    } else {
      item.classList.remove('active');
    }
  });

  // Switch visible section
  document.querySelectorAll('.view-section').forEach(sec => sec.classList.remove('active'));
  const target = document.getElementById(`view-${viewName}`);
  if (target) {
    target.classList.add('active');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // Trigger data loader for view
  if (viewName === 'dashboard') loadDashboardStats();
  if (viewName === 'companies') loadCompanies();
  if (viewName === 'drugs') loadDrugs();
  if (viewName === 'drug-details') loadDrugDetailsView();
  if (viewName === 'purchases') loadPurchases();
  if (viewName === 'sales') loadSalesView();
  if (viewName === 'users') loadUsers();
  if (viewName === 'settings') loadSettingsView();
}

function initNavigation() {
  // Nav bar items
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => {
      const view = item.getAttribute('data-view');
      if (view) navigateTo(view);
    });
  });

  // Dashboard cards
  document.querySelectorAll('.module-card, .stat-card').forEach(card => {
    card.addEventListener('click', () => {
      const view = card.getAttribute('data-view');
      if (view) navigateTo(view);
    });
  });

  // Quick Action Buttons
  document.getElementById('btn-quick-drug-list').addEventListener('click', () => navigateTo('drugs'));
  document.getElementById('btn-quick-move-drug').addEventListener('click', () => {
    navigateTo('drug-details');
    switchTab('view-drug-details', 'tab-move-drug');
  });
  document.getElementById('btn-quick-return-drug').addEventListener('click', () => {
    navigateTo('sales');
    switchTab('view-sales', 'tab-retrieval-drug');
  });
  document.getElementById('btn-quick-expired').addEventListener('click', () => {
    navigateTo('drug-details');
    switchTab('view-drug-details', 'tab-expired-drugs');
  });
  document.getElementById('btn-quick-almost').addEventListener('click', () => {
    navigateTo('drug-details');
    switchTab('view-drug-details', 'tab-almost-finish');
  });
  document.getElementById('card-alert-expired').addEventListener('click', () => {
    navigateTo('drug-details');
    switchTab('view-drug-details', 'tab-expired-drugs');
  });
  document.getElementById('card-alert-almost').addEventListener('click', () => {
    navigateTo('drug-details');
    switchTab('view-drug-details', 'tab-almost-finish');
  });

  // Aux & Modals triggers
  document.getElementById('btn-modal-about-pharmacy').addEventListener('click', () => openModal('modal-about-pharmacy'));
  document.getElementById('btn-modal-about-dev').addEventListener('click', () => openModal('modal-about-dev'));
  document.getElementById('btn-inbox-header').addEventListener('click', () => {
    openModal('modal-inbox');
    loadInboxMessages();
  });

  // Modal close buttons
  document.querySelectorAll('[data-close]').forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = btn.getAttribute('data-close');
      closeModal(targetId);
    });
  });

  // Confirm dialog handlers
  document.getElementById('btn-confirm-cancel').addEventListener('click', () => {
    closeModal('modal-confirm');
    state.confirmCallback = null;
  });
  document.getElementById('btn-confirm-yes').addEventListener('click', () => {
    if (state.confirmCallback) state.confirmCallback();
    closeModal('modal-confirm');
    state.confirmCallback = null;
  });

  // Tab buttons switching
  document.querySelectorAll('.tabs-bar').forEach(bar => {
    bar.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const tabId = btn.getAttribute('data-tab');
        const container = bar.closest('.card-box') || bar.parentElement;
        container.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        container.querySelectorAll('.tab-content').forEach(c => (c.style.display = 'none'));
        btn.classList.add('active');
        const content = document.getElementById(tabId);
        if (content) content.style.display = 'block';
      });
    });
  });
}

function switchTab(viewId, tabId) {
  const container = document.getElementById(viewId);
  if (!container) return;
  container.querySelectorAll('.tab-btn').forEach(b => {
    if (b.getAttribute('data-tab') === tabId) b.classList.add('active');
    else b.classList.remove('active');
  });
  container.querySelectorAll('.tab-content').forEach(c => {
    if (c.id === tabId) c.style.display = 'block';
    else c.style.display = 'none';
  });
}

// =============================================================================
// Dashboard Stats
// =============================================================================
async function loadDashboardStats() {
  if (!state.token) return;
  try {
    const res = await api('/api/stats/summary');
    if (res.success && res.stats) {
      const s = res.stats;
      document.getElementById('stat-total-drugs').textContent = s.totalDrugs;
      document.getElementById('stat-expired-drugs').textContent = s.expiredDrugs;
      document.getElementById('stat-low-stock').textContent = s.almostFinished;
      document.getElementById('stat-today-sales').textContent = `$${s.todaySales.toFixed(2)}`;

      document.getElementById('quick-expired-count').textContent = s.expiredDrugs;
      document.getElementById('quick-almost-count').textContent = s.almostFinished;
      document.getElementById('inbox-badge-count').textContent = s.inboxCount;
    }
  } catch (err) {
    console.error('Error fetching dashboard stats:', err);
  }
}

async function loadInboxCount() {
  if (!state.token) return;
  try {
    const res = await api('/api/messages/inbox');
    if (res.success) {
      document.getElementById('inbox-badge-count').textContent = res.count || 0;
    }
  } catch (_) {}
}

// =============================================================================
// Companies Module
// =============================================================================
async function loadCompanies(searchTerm = '') {
  try {
    const url = searchTerm ? `/api/companies?search=${encodeURIComponent(searchTerm)}` : '/api/companies';
    const res = await api(url);
    if (res.success) {
      state.companiesCache = res.data;
      renderCompaniesTable(res.data);
      populateCompanyDropdowns(res.data);
    }
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function renderCompaniesTable(companies) {
  const tbody = document.querySelector('#companies-table tbody');
  tbody.innerHTML = '';

  if (companies.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;color:var(--text-muted);padding:24px;">No companies found.</td></tr>`;
    return;
  }

  companies.forEach(comp => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${escapeHtml(comp.NAME)}</strong></td>
      <td>${escapeHtml(comp.ADDRESS)}</td>
      <td>📞 ${escapeHtml(comp.PHONE)}</td>
      <td style="text-align: right;">
        <div class="action-buttons" style="justify-content: flex-end;">
          <button class="btn btn-secondary btn-sm btn-edit-company">Edit</button>
          <button class="btn btn-danger btn-sm btn-delete-company">Delete</button>
        </div>
      </td>
    `;

    tr.querySelector('.btn-edit-company').addEventListener('click', () => openEditCompany(comp));
    tr.querySelector('.btn-delete-company').addEventListener('click', () => {
      showConfirm(
        'Delete Company',
        `Are you sure you want to remove '${comp.NAME}'? (Note: Connected drugs may be affected).`,
        async () => {
          try {
            await api(`/api/companies/${encodeURIComponent(comp.NAME)}`, { method: 'DELETE' });
            showToast(`Company '${comp.NAME}' deleted.`, 'success');
            loadCompanies();
            loadDashboardStats();
          } catch (err) {
            showToast(err.message, 'error');
          }
        }
      );
    });

    tbody.appendChild(tr);
  });
}

function openEditCompany(comp) {
  document.getElementById('modal-company-title').textContent = 'Edit Company';
  document.getElementById('company-original-name').value = comp.NAME;
  document.getElementById('company-name-input').value = comp.NAME;
  document.getElementById('company-address-input').value = comp.ADDRESS;
  document.getElementById('company-phone-input').value = comp.PHONE;
  openModal('modal-company');
}

function populateCompanyDropdowns(companies) {
  const selects = [
    document.getElementById('drugs-filter-company'),
    document.getElementById('drug-company-input'),
    document.getElementById('purchase-company-input')
  ];

  selects.forEach(select => {
    if (!select) return;
    const currentVal = select.value;
    const isFilter = select.id.includes('filter');
    select.innerHTML = isFilter ? '<option value="">All Companies</option>' : '<option value="">-- Choose Company --</option>';

    companies.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.NAME;
      opt.textContent = c.NAME;
      select.appendChild(opt);
    });
    if (currentVal) select.value = currentVal;
  });
}

// =============================================================================
// Drugs Inventory Module
// =============================================================================
async function loadDrugs() {
  try {
    const q = document.getElementById('drugs-search-input')?.value || '';
    const type = document.getElementById('drugs-filter-type')?.value || '';
    const company = document.getElementById('drugs-filter-company')?.value || '';

    const params = new URLSearchParams();
    if (q) params.append('q', q);
    if (type) params.append('type', type);
    if (company) params.append('company', company);

    const res = await api(`/api/drugs/search?${params.toString()}`);
    if (res.success) {
      state.drugsCache = res.data;
      renderDrugsTable(res.data);
      populateDrugSelects(res.data);
    }
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function renderDrugsTable(drugs) {
  const tbody = document.querySelector('#drugs-table tbody');
  tbody.innerHTML = '';

  if (drugs.length === 0) {
    tbody.innerHTML = `<tr><td colspan="11" style="text-align:center;color:var(--text-muted);padding:24px;">No drugs found.</td></tr>`;
    return;
  }

  drugs.forEach(d => {
    const tr = document.createElement('tr');
    const isLow = d.QUANTITY <= 10;
    tr.innerHTML = `
      <td><code>${escapeHtml(d.BARCODE)}</code></td>
      <td><strong>${escapeHtml(d.NAME)}</strong></td>
      <td><span class="badge-tag available">${escapeHtml(d.TYPE)}</span></td>
      <td>${escapeHtml(d.DOSE)}</td>
      <td>$${parseFloat(d.COST_PRICE).toFixed(2)}</td>
      <td><strong style="color:var(--primary-teal);">$${parseFloat(d.SELLING_PRICE).toFixed(2)}</strong></td>
      <td>${escapeHtml(d.COMPANY_NAME)}</td>
      <td>${escapeHtml(d.EXPIRATION_DATE)}</td>
      <td><span style="font-family:monospace;background:#eee;padding:2px 6px;border-radius:4px;">${escapeHtml(d.PLACE)}</span></td>
      <td><strong style="color: ${isLow ? 'var(--coral-danger)' : 'var(--emerald-success)'};">${d.QUANTITY}</strong></td>
      <td style="text-align: right;">
        <div class="action-buttons" style="justify-content: flex-end;">
          <button class="btn btn-secondary btn-sm btn-edit-drug">Edit</button>
          <button class="btn btn-danger btn-sm btn-delete-drug">Delete</button>
        </div>
      </td>
    `;

    tr.querySelector('.btn-edit-drug').addEventListener('click', () => openEditDrug(d));
    tr.querySelector('.btn-delete-drug').addEventListener('click', () => {
      showConfirm(
        'Delete Medicine',
        `Are you sure you want to delete '${d.NAME}' (${d.BARCODE})?`,
        async () => {
          try {
            await api(`/api/drugs/${encodeURIComponent(d.BARCODE)}`, { method: 'DELETE' });
            showToast(`Drug '${d.NAME}' deleted.`, 'success');
            loadDrugs();
            loadDashboardStats();
          } catch (err) {
            showToast(err.message, 'error');
          }
        }
      );
    });

    tbody.appendChild(tr);
  });
}

function openEditDrug(d) {
  document.getElementById('modal-drug-title').textContent = 'Edit Medicine Details';
  document.getElementById('drug-barcode-input').value = d.BARCODE;
  document.getElementById('drug-barcode-input').readOnly = true;
  document.getElementById('drug-name-input').value = d.NAME;
  document.getElementById('drug-type-input').value = d.TYPE;
  document.getElementById('drug-dose-input').value = d.DOSE;
  document.getElementById('drug-code-input').value = d.CODE;
  document.getElementById('drug-company-input').value = d.COMPANY_NAME;
  document.getElementById('drug-cost-input').value = d.COST_PRICE;
  document.getElementById('drug-selling-input').value = d.SELLING_PRICE;
  document.getElementById('drug-prod-date-input').value = d.PRODUCTION_DATE;
  document.getElementById('drug-exp-date-input').value = d.EXPIRATION_DATE;
  document.getElementById('drug-place-input').value = d.PLACE;
  document.getElementById('drug-qty-input').value = d.QUANTITY;

  openModal('modal-drug');
}

function populateDrugSelects(drugs) {
  const selects = [
    document.getElementById('editprice-drug-select'),
    document.getElementById('renew-drug-select'),
    document.getElementById('move-drug-select'),
    document.getElementById('pos-drug-select'),
    document.getElementById('retrieval-drug-select')
  ];

  selects.forEach(select => {
    if (!select) return;
    const currentVal = select.value;
    select.innerHTML = '<option value="">-- Choose Medicine --</option>';

    drugs.forEach(d => {
      const opt = document.createElement('option');
      opt.value = d.BARCODE;
      opt.textContent = `${d.NAME} (${d.DOSE}) - Barcode: ${d.BARCODE} [Stock: ${d.QUANTITY}]`;
      opt.dataset.drug = JSON.stringify(d);
      select.appendChild(opt);
    });
    if (currentVal) select.value = currentVal;
  });
}

// =============================================================================
// Drug Details Module Sub-tabs
// =============================================================================
async function loadDrugDetailsView() {
  loadExpiredDrugsTable();
  loadAlmostFinishTable();
  if (state.drugsCache.length === 0) loadDrugs();
}

async function loadExpiredDrugsTable() {
  try {
    const res = await api('/api/drugs/alerts/expired');
    const tbody = document.querySelector('#expired-drugs-table tbody');
    tbody.innerHTML = '';

    if (!res.data || res.data.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:var(--text-muted);padding:20px;">No expired medicines found.</td></tr>`;
      return;
    }

    res.data.forEach(d => {
      const tr = document.createElement('tr');
      const isExpired = d.DAYS_LEFT < 0;
      tr.innerHTML = `
        <td><code>${escapeHtml(d.BARCODE)}</code></td>
        <td><strong>${escapeHtml(d.NAME)}</strong></td>
        <td>${escapeHtml(d.COMPANY_NAME)}</td>
        <td>${escapeHtml(d.EXPIRATION_DATE)}</td>
        <td><span class="badge-tag ${isExpired ? 'expired' : 'warning'}">${isExpired ? 'Expired' : `${d.DAYS_LEFT} days left`}</span></td>
        <td>${d.QUANTITY}</td>
        <td><button class="btn btn-secondary btn-sm btn-renew-this">Renew</button></td>
      `;
      tr.querySelector('.btn-renew-this').addEventListener('click', () => {
        switchTab('view-drug-details', 'tab-renew-validity');
        document.getElementById('renew-drug-select').value = d.BARCODE;
      });
      tbody.appendChild(tr);
    });
  } catch (err) {
    console.error(err);
  }
}

async function loadAlmostFinishTable() {
  try {
    const res = await api('/api/drugs/alerts/almost-finish');
    const tbody = document.querySelector('#almost-finish-table tbody');
    tbody.innerHTML = '';

    if (!res.data || res.data.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:var(--text-muted);padding:20px;">All stock levels healthy.</td></tr>`;
      return;
    }

    res.data.forEach(d => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><code>${escapeHtml(d.BARCODE)}</code></td>
        <td><strong>${escapeHtml(d.NAME)}</strong></td>
        <td>${escapeHtml(d.COMPANY_NAME)}</td>
        <td><strong style="color:var(--coral-danger);">${d.QUANTITY}</strong></td>
        <td>${escapeHtml(d.PLACE)}</td>
        <td><button class="btn btn-primary btn-sm btn-reorder-deal">Order Restock</button></td>
      `;
      tr.querySelector('.btn-reorder-deal').addEventListener('click', () => {
        navigateTo('purchases');
        openAddPurchaseDeal(d);
      });
      tbody.appendChild(tr);
    });
  } catch (err) {
    console.error(err);
  }
}

// =============================================================================
// Purchases Module
// =============================================================================
async function loadPurchases(searchTerm = '') {
  try {
    const url = searchTerm ? `/api/purchases?q=${encodeURIComponent(searchTerm)}` : '/api/purchases';
    const res = await api(url);
    if (res.success) {
      renderPurchasesTable(res.data);
      if (res.summary) {
        document.getElementById('purchase-total-spending').textContent = `$${res.summary.totalSpending.toFixed(2)}`;
      }
    }
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function renderPurchasesTable(purchases) {
  const tbody = document.querySelector('#purchases-table tbody');
  tbody.innerHTML = '';

  if (purchases.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;color:var(--text-muted);padding:24px;">No purchase deals recorded.</td></tr>`;
    return;
  }

  purchases.forEach(p => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><code>${escapeHtml(p.BARCODE)}</code></td>
      <td><strong>${escapeHtml(p.NAME)}</strong></td>
      <td>${escapeHtml(p.TYPE)}</td>
      <td>${escapeHtml(p.COMPANY_NAME)}</td>
      <td>${p.QUANTITY}</td>
      <td>$${parseFloat(p.PRICE).toFixed(2)}</td>
      <td><strong style="color:var(--primary-teal);">$${parseFloat(p.AMOUNT).toFixed(2)}</strong></td>
      <td style="text-align: right;">
        <div class="action-buttons" style="justify-content: flex-end;">
          <button class="btn btn-secondary btn-sm btn-edit-deal">Edit</button>
          <button class="btn btn-danger btn-sm btn-delete-deal">Delete</button>
        </div>
      </td>
    `;

    tr.querySelector('.btn-edit-deal').addEventListener('click', () => openEditPurchase(p));
    tr.querySelector('.btn-delete-deal').addEventListener('click', () => {
      showConfirm(
        'Cancel Purchase Deal',
        `Are you sure you want to delete purchase deal '${p.BARCODE}'?`,
        async () => {
          try {
            await api(`/api/purchases/${encodeURIComponent(p.BARCODE)}`, { method: 'DELETE' });
            showToast('Purchase deal removed.', 'success');
            loadPurchases();
          } catch (err) {
            showToast(err.message, 'error');
          }
        }
      );
    });

    tbody.appendChild(tr);
  });
}

function openAddPurchaseDeal(initialDrug) {
  document.getElementById('modal-purchase-title').textContent = 'Make Purchase Deal';
  document.getElementById('purchase-barcode-input').value = initialDrug ? initialDrug.BARCODE : '';
  document.getElementById('purchase-barcode-input').readOnly = false;
  document.getElementById('purchase-name-input').value = initialDrug ? initialDrug.NAME : '';
  document.getElementById('purchase-type-input').value = initialDrug ? initialDrug.TYPE : 'Bills';
  if (initialDrug) document.getElementById('purchase-company-input').value = initialDrug.COMPANY_NAME;
  document.getElementById('purchase-qty-input').value = '100';
  document.getElementById('purchase-price-input').value = initialDrug ? initialDrug.COST_PRICE : '1.50';

  openModal('modal-purchase');
}

function openEditPurchase(p) {
  document.getElementById('modal-purchase-title').textContent = 'Edit Purchase Deal';
  document.getElementById('purchase-barcode-input').value = p.BARCODE;
  document.getElementById('purchase-barcode-input').readOnly = true;
  document.getElementById('purchase-name-input').value = p.NAME;
  document.getElementById('purchase-type-input').value = p.TYPE;
  document.getElementById('purchase-company-input').value = p.COMPANY_NAME;
  document.getElementById('purchase-qty-input').value = p.QUANTITY;
  document.getElementById('purchase-price-input').value = p.PRICE;

  openModal('modal-purchase');
}

// =============================================================================
// Sales & POS Module
// =============================================================================
async function loadSalesView() {
  loadPOSCart();
  loadSalesHistory();
  if (state.drugsCache.length === 0) loadDrugs();
}

async function loadPOSCart() {
  try {
    const res = await api('/api/sales/cart');
    if (res.success) {
      renderPOSCartTable(res.cart);
      document.getElementById('pos-item-count').textContent = res.itemCount;
      document.getElementById('pos-subtotal').textContent = `$${res.total.toFixed(2)}`;
      document.getElementById('pos-grand-total').textContent = `$${res.total.toFixed(2)}`;
    }
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function renderPOSCartTable(cart) {
  const tbody = document.querySelector('#pos-cart-table tbody');
  tbody.innerHTML = '';

  if (cart.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;color:var(--text-muted);padding:24px;">Active cart is empty. Add drugs above.</td></tr>`;
    return;
  }

  cart.forEach(item => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><code>${escapeHtml(item.BARCODE)}</code></td>
      <td><strong>${escapeHtml(item.NAME)}</strong></td>
      <td>${escapeHtml(item.TYPE)}</td>
      <td>${escapeHtml(item.DOSE)}</td>
      <td>${item.QUANTITY}</td>
      <td>$${parseFloat(item.PRICE).toFixed(2)}</td>
      <td><strong style="color:var(--primary-teal);">$${parseFloat(item.AMOUNT).toFixed(2)}</strong></td>
      <td style="text-align: right;">
        <button class="btn btn-danger btn-sm btn-remove-cart">✕</button>
      </td>
    `;

    tr.querySelector('.btn-remove-cart').addEventListener('click', async () => {
      try {
        await api(`/api/sales/cart/${item.ID}`, { method: 'DELETE' });
        loadPOSCart();
      } catch (err) {
        showToast(err.message, 'error');
      }
    });

    tbody.appendChild(tr);
  });
}

async function loadSalesHistory(dateFilter = '') {
  try {
    const url = dateFilter ? `/api/sales/history?date=${encodeURIComponent(dateFilter)}` : '/api/sales/history';
    const res = await api(url);
    if (res.success) {
      renderSalesHistoryTable(res.data);
      if (res.summary) {
        document.getElementById('shift-total-revenue').textContent = `$${res.summary.totalRevenue.toFixed(2)}`;
      }
    }
  } catch (err) {
    console.error(err);
  }
}

function renderSalesHistoryTable(history) {
  const tbody = document.querySelector('#sales-history-table tbody');
  tbody.innerHTML = '';

  if (history.length === 0) {
    tbody.innerHTML = `<tr><td colspan="10" style="text-align:center;color:var(--text-muted);padding:20px;">No sales transactions found.</td></tr>`;
    return;
  }

  history.forEach(h => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${h.ID}</td>
      <td><strong style="color:var(--primary-teal);">${escapeHtml(h.USER_NAME)}</strong></td>
      <td><code>${escapeHtml(h.BARCODE)}</code></td>
      <td>${escapeHtml(h.NAME)}</td>
      <td>${escapeHtml(h.TYPE)}</td>
      <td>${h.QUANTITY}</td>
      <td>$${parseFloat(h.PRICE).toFixed(2)}</td>
      <td><strong>$${parseFloat(h.AMOUNT).toFixed(2)}</strong></td>
      <td>${escapeHtml(h.DATE)}</td>
      <td>${escapeHtml(h.TIME)}</td>
    `;
    tbody.appendChild(tr);
  });
}

function renderReceiptInvoice(invoice) {
  const area = document.getElementById('printable-receipt-area');
  let itemsHtml = '';
  invoice.items.forEach(item => {
    itemsHtml += `
      <tr>
        <td style="padding:6px 0;border-bottom:1px solid #ddd;">${escapeHtml(item.name)} (${escapeHtml(item.dose)}) x ${item.quantity}</td>
        <td style="text-align:right;padding:6px 0;border-bottom:1px solid #ddd;">$${item.amount.toFixed(2)}</td>
      </tr>
    `;
  });

  area.innerHTML = `
    <div style="font-family:monospace;padding:12px;text-align:center;border:1px dashed #aaa;border-radius:8px;">
      <h2 style="margin:0 0 4px 0;font-size:1.4rem;">PHARMACY MANAGEMENT</h2>
      <p style="margin:0 0 10px 0;font-size:0.8rem;color:#555;">Alexandria / Elraml Station / st-Elshazly<br>Tel: 01128284736 / 045/3397825</p>
      <div style="text-align:left;font-size:0.85rem;margin-bottom:12px;border-top:1px dashed #888;border-bottom:1px dashed #888;padding:6px 0;">
        <div><strong>Invoice #:</strong> ${invoice.invoiceNumber}</div>
        <div><strong>Date:</strong> ${invoice.date} ${invoice.time}</div>
        <div><strong>Cashier:</strong> ${invoice.cashier}</div>
      </div>
      <table style="width:100%;border-collapse:collapse;font-size:0.85rem;text-align:left;margin-bottom:12px;">
        <thead>
          <tr style="border-bottom:2px solid #333;">
            <th>Item</th>
            <th style="text-align:right;">Total</th>
          </tr>
        </thead>
        <tbody>
          ${itemsHtml}
        </tbody>
      </table>
      <div style="display:flex;justify-content:space-between;font-size:1.2rem;font-weight:bold;border-top:2px solid #333;padding-top:8px;">
        <span>TOTAL DUE:</span>
        <span>$${invoice.grandTotal.toFixed(2)}</span>
      </div>
      <p style="margin-top:18px;font-size:0.75rem;color:#777;">Thank you for your purchase! Keep medicine stored safely.</p>
    </div>
  `;

  openModal('modal-receipt');
}

// =============================================================================
// User Management Module
// =============================================================================
async function loadUsers() {
  try {
    const res = await api('/api/users');
    if (res.success) {
      renderUsersTable(res.data);
    }
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function renderUsersTable(users) {
  const tbody = document.querySelector('#users-table tbody');
  tbody.innerHTML = '';

  users.forEach(u => {
    const tr = document.createElement('tr');
    const isAdmin = u.ID === 1 || u.ROLE === 'Admin';
    tr.innerHTML = `
      <td><strong>${u.ID}</strong></td>
      <td><strong>${escapeHtml(u.NAME)}</strong></td>
      <td><span class="user-role-tag ${isAdmin ? 'admin' : ''}">${u.ROLE}</span></td>
      <td>${escapeHtml(u.DOB)}</td>
      <td>${escapeHtml(u.ADDRESS)}</td>
      <td>📞 ${escapeHtml(u.PHONE)}</td>
      <td>$${parseFloat(u.SALARY).toFixed(2)}</td>
      <td style="text-align: right;">
        <div class="action-buttons" style="justify-content: flex-end;">
          <button class="btn btn-secondary btn-sm btn-edit-user">Edit</button>
          ${!isAdmin ? '<button class="btn btn-danger btn-sm btn-delete-user">Delete</button>' : ''}
        </div>
      </td>
    `;

    tr.querySelector('.btn-edit-user').addEventListener('click', () => openEditUser(u));
    const delBtn = tr.querySelector('.btn-delete-user');
    if (delBtn) {
      delBtn.addEventListener('click', () => {
        showConfirm(
          'Delete Staff User',
          `Are you sure you want to remove user '${u.NAME}' (ID: ${u.ID})?`,
          async () => {
            try {
              await api(`/api/users/${u.ID}`, { method: 'DELETE' });
              showToast(`User '${u.NAME}' deleted.`, 'success');
              loadUsers();
            } catch (err) {
              showToast(err.message, 'error');
            }
          }
        );
      });
    }

    tbody.appendChild(tr);
  });
}

function openEditUser(u) {
  document.getElementById('modal-user-title').textContent = 'Edit Employee Profile';
  document.getElementById('user-id-input').value = u.ID;
  document.getElementById('user-id-input').readOnly = true;
  document.getElementById('user-name-input').value = u.NAME;
  document.getElementById('user-dob-input').value = u.DOB;
  document.getElementById('user-phone-input').value = u.PHONE;
  document.getElementById('user-salary-input').value = u.SALARY;
  document.getElementById('user-address-input').value = u.ADDRESS;
  document.getElementById('user-pass-input').value = '';
  document.getElementById('user-pass-input').placeholder = 'Leave blank to keep unchanged';
  document.getElementById('user-pass-input').required = false;

  openModal('modal-user');
}

// =============================================================================
// Settings & Audit Module
// =============================================================================
async function loadSettingsView() {
  try {
    const res = await api('/api/audit/logins');
    if (res.success) {
      renderAuditLoginsTable(res.data);
    }
  } catch (err) {
    console.error(err);
  }
}

function renderAuditLoginsTable(logins) {
  const tbody = document.querySelector('#audit-logins-table tbody');
  tbody.innerHTML = '';

  logins.forEach(l => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>#${l.ID}</td>
      <td><strong>${escapeHtml(l.NAME)}</strong></td>
      <td><span class="user-role-tag ${l.TYPE === 'Admin' ? 'admin' : ''}">${escapeHtml(l.TYPE)}</span></td>
      <td>${escapeHtml(l.DATE)}</td>
      <td>${escapeHtml(l.TIME)}</td>
    `;
    tbody.appendChild(tr);
  });
}

// =============================================================================
// Messaging & Inbox Module
// =============================================================================
async function loadInboxMessages() {
  try {
    const res = await api('/api/messages/inbox');
    const tbody = document.querySelector('#inbox-messages-table tbody');
    tbody.innerHTML = '';

    if (!res.data || res.data.length === 0) {
      tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;color:var(--text-muted);padding:20px;">No messages in inbox.</td></tr>`;
      return;
    }

    res.data.forEach(m => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong>${escapeHtml(m.MESSAGE_FROM)}</strong></td>
        <td><span class="badge-tag available">${escapeHtml(m.MESSAGE_TO)}</span></td>
        <td>${escapeHtml(m.MESSAGE_TEXT)}</td>
        <td><button class="btn btn-danger btn-sm btn-del-msg">✕</button></td>
      `;

      tr.querySelector('.btn-del-msg').addEventListener('click', async () => {
        try {
          await api(`/api/messages/inbox/${m.ID}`, { method: 'DELETE' });
          showToast('Message deleted.', 'success');
          loadInboxMessages();
          loadInboxCount();
        } catch (err) {
          showToast(err.message, 'error');
        }
      });

      tbody.appendChild(tr);
    });

    // Populate recipients
    if (state.drugsCache.length === 0) loadDrugs();
    const recipientSelect = document.getElementById('msg-recipient-select');
    recipientSelect.innerHTML = '<option value="Public">Public (All Staff)</option>';
    try {
      const uRes = await api('/api/users');
      if (uRes.success) {
        uRes.data.forEach(u => {
          if (u.NAME !== state.user.name) {
            const opt = document.createElement('option');
            opt.value = u.NAME;
            opt.textContent = `${u.NAME} (${u.ROLE})`;
            recipientSelect.appendChild(opt);
          }
        });
      }
    } catch (_) {}
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// =============================================================================
// Form Handlers & Event Listeners
// =============================================================================
function initFormHandlers() {
  // 1. Company Form
  document.getElementById('btn-add-company').addEventListener('click', () => {
    document.getElementById('modal-company-title').textContent = 'Add Pharmaceutical Company';
    document.getElementById('company-original-name').value = '';
    document.getElementById('company-name-input').value = '';
    document.getElementById('company-name-input').readOnly = false;
    document.getElementById('company-address-input').value = '';
    document.getElementById('company-phone-input').value = '';
    openModal('modal-company');
  });

  document.getElementById('form-company').addEventListener('submit', async (e) => {
    e.preventDefault();
    const originalName = document.getElementById('company-original-name').value;
    const name = document.getElementById('company-name-input').value.trim();
    const address = document.getElementById('company-address-input').value.trim();
    const phone = document.getElementById('company-phone-input').value.trim();

    try {
      if (originalName) {
        await api(`/api/companies/${encodeURIComponent(originalName)}`, {
          method: 'PUT',
          body: JSON.stringify({ address, phone, newName: name })
        });
        showToast('Company updated successfully.', 'success');
      } else {
        await api('/api/companies', {
          method: 'POST',
          body: JSON.stringify({ name, address, phone })
        });
        showToast(`Company '${name}' added.`, 'success');
      }
      closeModal('modal-company');
      loadCompanies();
      loadDashboardStats();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  document.getElementById('companies-search-input').addEventListener('input', (e) => {
    loadCompanies(e.target.value.trim());
  });

  // 2. Drug Form
  document.getElementById('btn-add-drug').addEventListener('click', () => {
    document.getElementById('modal-drug-title').textContent = 'Add New Medicine';
    document.getElementById('drug-barcode-input').value = '';
    document.getElementById('drug-barcode-input').readOnly = false;
    document.getElementById('drug-name-input').value = '';
    document.getElementById('drug-type-input').value = 'Bills';
    document.getElementById('drug-dose-input').value = '500mg';
    document.getElementById('drug-code-input').value = 'B01';
    document.getElementById('drug-cost-input').value = '2.50';
    document.getElementById('drug-selling-input').value = '4.00';

    const now = new Date();
    const nextYear = new Date(now.getFullYear() + 2, now.getMonth(), now.getDate());
    document.getElementById('drug-prod-date-input').value = now.toISOString().split('T')[0];
    document.getElementById('drug-exp-date-input').value = nextYear.toISOString().split('T')[0];
    document.getElementById('drug-place-input').value = 'N-Right';
    document.getElementById('drug-qty-input').value = '50';

    openModal('modal-drug');
  });

  document.getElementById('form-drug').addEventListener('submit', async (e) => {
    e.preventDefault();
    const isEdit = document.getElementById('drug-barcode-input').readOnly;
    const barcode = document.getElementById('drug-barcode-input').value.trim();
    const payload = {
      barcode,
      name: document.getElementById('drug-name-input').value.trim(),
      type: document.getElementById('drug-type-input').value,
      dose: document.getElementById('drug-dose-input').value.trim(),
      code: document.getElementById('drug-code-input').value.trim(),
      company_name: document.getElementById('drug-company-input').value,
      cost_price: document.getElementById('drug-cost-input').value,
      selling_price: document.getElementById('drug-selling-input').value,
      production_date: document.getElementById('drug-prod-date-input').value,
      expiration_date: document.getElementById('drug-exp-date-input').value,
      place: document.getElementById('drug-place-input').value.trim(),
      quantity: document.getElementById('drug-qty-input').value
    };

    try {
      if (isEdit) {
        await api(`/api/drugs/${encodeURIComponent(barcode)}`, {
          method: 'PUT',
          body: JSON.stringify(payload)
        });
        showToast('Drug specifications updated.', 'success');
      } else {
        await api('/api/drugs', {
          method: 'POST',
          body: JSON.stringify(payload)
        });
        showToast(`Drug '${payload.name}' registered.`, 'success');
      }
      closeModal('modal-drug');
      loadDrugs();
      loadDashboardStats();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  // Drug filters
  document.getElementById('drugs-search-input').addEventListener('input', () => loadDrugs());
  document.getElementById('drugs-filter-type').addEventListener('change', () => loadDrugs());
  document.getElementById('drugs-filter-company').addEventListener('change', () => loadDrugs());

  // 3. Drug Details Forms
  document.getElementById('btn-inspect-lookup').addEventListener('click', async () => {
    const term = document.getElementById('inspect-barcode-input').value.trim();
    if (!term) return;
    try {
      const res = await api(`/api/drugs/search?q=${encodeURIComponent(term)}`);
      const card = document.getElementById('inspect-result-card');
      if (res.data && res.data.length > 0) {
        const d = res.data[0];
        card.style.display = 'block';
        card.innerHTML = `
          <h3 style="color:var(--primary-teal-dark);margin-bottom:8px;">${escapeHtml(d.NAME)} (${escapeHtml(d.DOSE)})</h3>
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px;font-size:0.95rem;">
            <div><strong>Barcode:</strong> <code>${escapeHtml(d.BARCODE)}</code></div>
            <div><strong>Type:</strong> ${escapeHtml(d.TYPE)}</div>
            <div><strong>Batch Code:</strong> ${escapeHtml(d.CODE)}</div>
            <div><strong>Company:</strong> ${escapeHtml(d.COMPANY_NAME)}</div>
            <div><strong>Cost Price:</strong> $${parseFloat(d.COST_PRICE).toFixed(2)}</div>
            <div><strong>Selling Price:</strong> $${parseFloat(d.SELLING_PRICE).toFixed(2)}</div>
            <div><strong>Production Date:</strong> ${escapeHtml(d.PRODUCTION_DATE)}</div>
            <div><strong>Expiration Date:</strong> ${escapeHtml(d.EXPIRATION_DATE)}</div>
            <div><strong>Shelf Place:</strong> <span style="background:#fff;padding:2px 8px;border-radius:4px;">${escapeHtml(d.PLACE)}</span></div>
            <div><strong>Stock Available:</strong> <strong style="color:var(--primary-teal);">${d.QUANTITY}</strong></div>
          </div>
        `;
      } else {
        card.style.display = 'block';
        card.innerHTML = `<p style="color:var(--coral-danger);">No medicine found matching '${escapeHtml(term)}'.</p>`;
      }
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  document.getElementById('editprice-drug-select').addEventListener('change', (e) => {
    const sel = e.target.selectedOptions[0];
    if (sel && sel.dataset.drug) {
      const d = JSON.parse(sel.dataset.drug);
      document.getElementById('editprice-cost').value = d.COST_PRICE;
      document.getElementById('editprice-selling').value = d.SELLING_PRICE;
    }
  });

  document.getElementById('form-edit-price').addEventListener('submit', async (e) => {
    e.preventDefault();
    const barcode = document.getElementById('editprice-drug-select').value;
    const cost_price = document.getElementById('editprice-cost').value;
    const selling_price = document.getElementById('editprice-selling').value;

    try {
      await api(`/api/drugs/${encodeURIComponent(barcode)}/price`, {
        method: 'PUT',
        body: JSON.stringify({ cost_price, selling_price })
      });
      showToast('Medicine prices updated successfully.', 'success');
      loadDrugs();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  document.getElementById('form-renew-validity').addEventListener('submit', async (e) => {
    e.preventDefault();
    const barcode = document.getElementById('renew-drug-select').value;
    const production_date = document.getElementById('renew-prod-date').value;
    const expiration_date = document.getElementById('renew-exp-date').value;

    try {
      await api(`/api/drugs/${encodeURIComponent(barcode)}/validity`, {
        method: 'PUT',
        body: JSON.stringify({ production_date, expiration_date })
      });
      showToast('Drug validity renewed successfully.', 'success');
      loadDrugs();
      loadExpiredDrugsTable();
      loadDashboardStats();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  document.getElementById('form-move-drug').addEventListener('submit', async (e) => {
    e.preventDefault();
    const barcode = document.getElementById('move-drug-select').value;
    const place = document.getElementById('move-new-place').value.trim();

    try {
      await api(`/api/drugs/${encodeURIComponent(barcode)}/move`, {
        method: 'PUT',
        body: JSON.stringify({ place })
      });
      showToast(`Drug moved to shelf '${place}'.`, 'success');
      loadDrugs();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  // 4. Purchases Form
  document.getElementById('btn-add-purchase').addEventListener('click', () => openAddPurchaseDeal());
  document.getElementById('form-purchase').addEventListener('submit', async (e) => {
    e.preventDefault();
    const isEdit = document.getElementById('purchase-barcode-input').readOnly;
    const barcode = document.getElementById('purchase-barcode-input').value.trim();
    const payload = {
      barcode,
      name: document.getElementById('purchase-name-input').value.trim(),
      type: document.getElementById('purchase-type-input').value,
      company_name: document.getElementById('purchase-company-input').value,
      quantity: document.getElementById('purchase-qty-input').value,
      price: document.getElementById('purchase-price-input').value
    };

    try {
      if (isEdit) {
        await api(`/api/purchases/${encodeURIComponent(barcode)}`, {
          method: 'PUT',
          body: JSON.stringify(payload)
        });
        showToast('Purchase deal updated.', 'success');
      } else {
        await api('/api/purchases', {
          method: 'POST',
          body: JSON.stringify(payload)
        });
        showToast('Purchase deal recorded.', 'success');
      }
      closeModal('modal-purchase');
      loadPurchases();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  document.getElementById('purchases-search-input').addEventListener('input', (e) => {
    loadPurchases(e.target.value.trim());
  });

  // 5. Sales & POS Handlers
  document.getElementById('btn-pos-add-cart').addEventListener('click', async () => {
    const barcode = document.getElementById('pos-drug-select').value;
    const quantity = document.getElementById('pos-qty-input').value;

    if (!barcode) {
      showToast('Please select a drug to add.', 'warning');
      return;
    }

    try {
      await api('/api/sales/cart', {
        method: 'POST',
        body: JSON.stringify({ barcode, quantity })
      });
      loadPOSCart();
      showToast('Item added to active bill.', 'success');
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  document.getElementById('btn-pos-clear-cart').addEventListener('click', () => {
    showConfirm('Clear Active Cart', 'Do you want to discard all items in the current cart?', async () => {
      try {
        await api('/api/sales/cart', { method: 'DELETE' });
        loadPOSCart();
        showToast('Cart cleared.', 'info');
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  });

  document.getElementById('btn-pos-checkout').addEventListener('click', async () => {
    try {
      const res = await api('/api/sales/checkout', { method: 'POST' });
      if (res.success && res.invoice) {
        showToast('Sale finalized! Generating receipt...', 'success');
        renderReceiptInvoice(res.invoice);
        loadPOSCart();
        loadDrugs();
        loadDashboardStats();
      }
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  document.getElementById('btn-sales-filter-today').addEventListener('click', () => {
    const now = new Date();
    const day = String(now.getDate()).padStart(2, '0');
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const todayStr = `${day}-${month}-${now.getFullYear()}`;
    document.getElementById('sales-history-date-filter').value = todayStr;
    loadSalesHistory(todayStr);
  });

  document.getElementById('btn-sales-filter-all').addEventListener('click', () => {
    document.getElementById('sales-history-date-filter').value = '';
    loadSalesHistory();
  });

  document.getElementById('form-retrieval-drug').addEventListener('submit', async (e) => {
    e.preventDefault();
    const barcode = document.getElementById('retrieval-drug-select').value;
    const quantity = document.getElementById('retrieval-qty-input').value;

    try {
      const res = await api('/api/sales/return', {
        method: 'POST',
        body: JSON.stringify({ barcode, quantity })
      });
      showToast(res.message, 'success');
      loadDrugs();
      loadDashboardStats();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  // 6. User Management Handlers
  document.getElementById('btn-add-user').addEventListener('click', () => {
    document.getElementById('modal-user-title').textContent = 'Add Pharmacy Employee';
    document.getElementById('user-id-input').value = '';
    document.getElementById('user-id-input').readOnly = false;
    document.getElementById('user-name-input').value = '';
    document.getElementById('user-dob-input').value = '01-01-1995';
    document.getElementById('user-phone-input').value = '';
    document.getElementById('user-salary-input').value = '30000';
    document.getElementById('user-address-input').value = '';
    document.getElementById('user-pass-input').value = '';
    document.getElementById('user-pass-input').placeholder = 'Min 6 characters';
    document.getElementById('user-pass-input').required = true;

    openModal('modal-user');
  });

  document.getElementById('form-user').addEventListener('submit', async (e) => {
    e.preventDefault();
    const isEdit = document.getElementById('user-id-input').readOnly;
    const id = document.getElementById('user-id-input').value;
    const payload = {
      id,
      name: document.getElementById('user-name-input').value.trim(),
      dob: document.getElementById('user-dob-input').value.trim(),
      phone: document.getElementById('user-phone-input').value.trim(),
      salary: document.getElementById('user-salary-input').value,
      address: document.getElementById('user-address-input').value.trim(),
      password: document.getElementById('user-pass-input').value
    };

    try {
      if (isEdit) {
        await api(`/api/users/${id}`, {
          method: 'PUT',
          body: JSON.stringify(payload)
        });
        showToast('User profile updated.', 'success');
      } else {
        await api('/api/users', {
          method: 'POST',
          body: JSON.stringify(payload)
        });
        showToast(`User '${payload.name}' created.`, 'success');
      }
      closeModal('modal-user');
      loadUsers();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  // 7. Change Password Form
  document.getElementById('form-change-password').addEventListener('submit', async (e) => {
    e.preventDefault();
    const currentPassword = document.getElementById('input-curr-pass').value;
    const newPassword = document.getElementById('input-new-pass').value;
    const confirmPassword = document.getElementById('input-confirm-pass').value;

    if (newPassword !== confirmPassword) {
      showToast('New passwords do not match.', 'error');
      return;
    }

    try {
      await api('/api/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword, newPassword })
      });
      showToast('Password changed successfully.', 'success');
      document.getElementById('form-change-password').reset();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  // 8. Inbox Form
  document.getElementById('form-send-message').addEventListener('submit', async (e) => {
    e.preventDefault();
    const to = document.getElementById('msg-recipient-select').value;
    const text = document.getElementById('msg-text-input').value.trim();

    try {
      await api('/api/messages/send', {
        method: 'POST',
        body: JSON.stringify({ to, text })
      });
      showToast('Message sent.', 'success');
      document.getElementById('msg-text-input').value = '';
      loadInboxMessages();
      loadInboxCount();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });
}

// Utility: Escape HTML to prevent XSS
function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// =============================================================================
// App Initialization
// =============================================================================
document.addEventListener('DOMContentLoaded', () => {
  startLiveClock();
  initAuth();
  initNavigation();
  initFormHandlers();
});
