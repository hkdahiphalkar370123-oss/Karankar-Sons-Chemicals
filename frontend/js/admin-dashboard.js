document.addEventListener('DOMContentLoaded', async () => {
  const user = window.API.requireAuth('admin');
  if (!user) return;

  const adminName = document.getElementById('admin-name');
  if (adminName) adminName.textContent = user.name;

  const adminLogout = document.getElementById('admin-logout');
  if (adminLogout) {
    adminLogout.addEventListener('click', (e) => {
      e.preventDefault();
      window.API.logout();
    });
  }

  // Real-time updates
  window.API.initSocket();
  window.API.onEvent('PAYMENT_SUCCESS', (data) => {
    Toast.success(`New Order: ${data.orderId} (₹${data.amount}) from ${data.customerName}`);
    // Refresh relevant data
    if (typeof loadAllData === 'function') loadAllData();
  });

  window.API.onEvent('LOW_STOCK_ALERT', (data) => {
    Toast.error(`LOW STOCK ALERT: ${data.productName} is down to ${data.currentStock} units!`, { duration: 10000 });
  });

  window.API.onEvent('site-status-updated', () => {
    if (typeof loadAllData === 'function') loadAllData();
  });

  const productsTable = document.getElementById('products-table');
  const ordersTable = document.getElementById('orders-table');
  const usersTable = document.getElementById('users-table');
  const quotationsTable = document.getElementById('quotations-table');
  const bookingsTable = document.getElementById('bookings-table');
  const invoicesTable = document.getElementById('invoices-table');
  const quotationForm = document.getElementById('quotation-form');
  const sitesTable = document.getElementById('sitesTableBody');
  const siteMessage = document.getElementById('site-message');
  const siteDetails = document.getElementById('site-details');

  const showSiteMessage = (text, isError = false) => {
    if (!siteMessage) return;
    siteMessage.textContent = text;
    siteMessage.style.color = isError ? '#c62828' : '#2e7d32';
  };

  const formatDate = (value) => (value ? new Date(value).toLocaleDateString() : '-');
  const formatCurrency = (value) => `₹${Number(value || 0).toFixed(2)}`;
  const surfacePricing = {
    'Roof Waterproofing': 35,
    'Terrace Waterproofing': 40,
    'Bathroom Waterproofing': 55,
    'Basement Waterproofing': 60,
    'Wall Crack Repair': 30,
    'Tank Waterproofing': 50
  };

  // Pagination state variables
  let ordersCurrentPage = 1;
  let ordersTotalPages = 1;
  let sitesCurrentPage = 1;
  let sitesTotalPages = 1;

  const safePrompt = (message, defaultValue = '') => {
    try {
      return window.prompt(message, defaultValue);
    } catch (error) {
      return null;
    }
  };

  const normalizeOrderStatus = (status) => (status === 'Delivered' ? 'Completed' : status);

  const setStats = (products, orders, sites, quotations, analytics) => {
    document.getElementById('stat-products').textContent = products.length;
    document.getElementById('stat-orders').textContent = orders.length;
    document.getElementById('stat-active-sites').textContent = sites.filter((site) => site.status !== 'Completed').length;
    document.getElementById('stat-open-quotations').textContent = quotations.filter((quotation) => quotation.status !== 'Converted').length;
    const monthlyRevenue = analytics && analytics.totals ? analytics.totals.totalRevenue : orders.reduce((sum, order) => sum + Number(order.totalAmount || 0), 0);
    document.getElementById('stat-monthly-revenue').textContent = `₹${Number(monthlyRevenue).toFixed(0)}`;
  };

  let productsCache = [];
  let ordersCache = [];
  let usersCache = [];
  let sitesCache = [];
  let quotationsCache = [];
  let bookingsCache = [];
  let invoicesCache = [];

  const toStatusClass = (status) => {
    const normalized = String(status || '').toLowerCase().trim().replace(/\s+/g, '-');
    const map = {
      pending: 'status-pending',
      processing: 'status-in-progress',
      approved: 'status-in-progress',
      assigned: 'status-in-progress',
      'in-progress': 'status-in-progress',
      completed: 'status-completed',
      active: 'status-completed',
      available: 'status-completed',
      delivered: 'status-completed',
      cancelled: 'status-cancelled',
      rejected: 'status-cancelled',
      inactive: 'status-cancelled',
      'on-leave': 'status-cancelled'
    };
    return map[normalized] || 'status-default';
  };

  const statusBadge = (status) => `<span class="status-badge ${toStatusClass(status)}">${status || 'Unknown'}</span>`;

  const searchState = {
    products: '',
    orders: '',
    users: '',
    sites: '',
    quotations: '',
    bookings: '',
    invoices: ''
  };

  const debounce = (callback, delay = 300) => {
    let timerId;
    return (...args) => {
      clearTimeout(timerId);
      timerId = setTimeout(() => callback(...args), delay);
    };
  };

  const normalizeSearch = (value) => String(value || '').toLowerCase().trim();

  const matchesSearch = (fields, searchTerm) => {
    const needle = normalizeSearch(searchTerm);
    if (!needle) {
      return true;
    }

    return fields.some((field) => normalizeSearch(field).includes(needle));
  };

  const buildSearchToolbar = (tableElement, key, placeholder, onSearch) => {
    const tableContainer = tableElement && tableElement.closest('.table-container');
    if (!tableContainer || !tableContainer.parentElement) {
      return null;
    }

    const existingToolbar = document.getElementById(`search-toolbar-${key}`);
    if (existingToolbar) {
      existingToolbar.remove();
    }

    const toolbar = document.createElement('div');
    toolbar.className = 'module-toolbar';
    toolbar.id = `search-toolbar-${key}`;
    toolbar.innerHTML = `
      <div class="module-search">
        <span class="module-search-icon">🔍</span>
        <input id="search-${key}" type="search" placeholder="${placeholder}" aria-label="${placeholder}">
        <button type="button" class="module-search-clear" aria-label="Clear search">×</button>
      </div>
    `;

    tableContainer.parentElement.insertBefore(toolbar, tableContainer);

    const input = toolbar.querySelector('input');
    const clearButton = toolbar.querySelector('.module-search-clear');
    const updateClear = () => {
      clearButton.classList.toggle('visible', Boolean(input.value.trim()));
    };

    const runSearch = debounce((value) => {
      onSearch(value);
    }, 300);

    input.addEventListener('input', () => {
      const value = input.value.trim();
      searchState[key] = value;
      updateClear();
      runSearch(value);
    });

    clearButton.addEventListener('click', () => {
      input.value = '';
      searchState[key] = '';
      updateClear();
      onSearch('');
      input.focus();
    });

    updateClear();
    return input;
  };

  const loadingRow = (colspan, label = 'Loading records...') => `
    <tr>
      <td colspan="${colspan}">
        <div class="loading-state">
          <span class="loading-spinner" aria-hidden="true"></span>
          <span>${label}</span>
        </div>
      </td>
    </tr>
  `;

  const emptyRow = (colspan, message, actionLabel = '', actionTarget = '') => `
    <tr>
      <td colspan="${colspan}">
        <div class="empty-state">
          <span class="empty-state-icon">📭</span>
          <span>${message}</span>
          ${actionLabel && actionTarget ? `<button type="button" class="btn btn-primary btn-action" data-empty-target="${actionTarget}">${actionLabel}</button>` : ''}
        </div>
      </td>
    </tr>
  `;

  const resolveImageUrl = (imageUrl) => {
    if (!imageUrl) return '/assets/img/chemical_coating.png';
    if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) return '/assets/img/chemical_coating.png';
    if (imageUrl.startsWith('/')) return imageUrl;
    return `/${imageUrl}`;
  };

  const renderProducts = (products) => {
    const term = searchState.products;
    const filteredProducts = products.filter((product) => matchesSearch([
      product.productId,
      product.productName,
      product.category,
      product.description,
      product.brand
    ], term));
    productsTable.innerHTML = '';
    if (!filteredProducts.length) {
      productsTable.innerHTML = emptyRow(8, term ? 'No matching records found.' : 'No Records Found', 'Add Product', term ? '' : 'products');
      return;
    }

    filteredProducts.forEach((product) => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td><img src="${resolveImageUrl(product.imageURL)}" alt="${product.productName}" style="width:46px;height:46px;object-fit:cover;border-radius:8px;"></td>
        <td>${product.productName}</td>
        <td>${product.description || '-'}</td>
        <td>${product.category}</td>
        <td>₹${Number(product.pricePerUnit || 0).toFixed(2)}</td>
        <td>${product.stockQuantity || 0} ${product.quantityUnit || ''}</td>
        <td>${statusBadge(product.status || 'Active')}</td>
        <td>
          <div class="table-actions action-buttons">
            <button class="btn btn-action btn-edit" data-product-action="edit" data-id="${product._id}">Edit</button>
            <button class="btn btn-action btn-delete" data-product-action="delete" data-id="${product._id}">Delete</button>
          </div>
        </td>
      `;
      productsTable.appendChild(row);
    });
  };

  const renderOrders = (orders) => {
    const term = searchState.orders;
    const filteredOrders = orders.filter((order) => matchesSearch([
      order.orderId,
      order.shippingDetails?.fullName,
      order.shippingDetails?.phone,
      order.payment?.razorpayPaymentId,
      order.payment?.transactionId,
      order.createdAt ? new Date(order.createdAt).toLocaleDateString() : ''
    ], term));
    ordersTable.innerHTML = '';
    if (!filteredOrders.length) {
      ordersTable.innerHTML = emptyRow(8, term ? 'No matching records found.' : 'No Records Found');
      return;
    }

    filteredOrders.forEach((order) => {
      const status = normalizeOrderStatus(order.status);
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${order.orderId}</td>
        <td>${order.shippingDetails?.fullName || order.user?.name || '-'}</td>
        <td>${(order.items || []).map((item) => `${item.productName} x ${item.quantity}`).join(', ')}</td>
        <td>₹${Number(order.totalAmount || 0).toFixed(2)}</td>
        <td>${statusBadge(status)}</td>
        <td>${formatDate(order.createdAt)}</td>
        <td><a class="btn btn-action btn-view" href="/order-detail?id=${order._id}">View Details</a></td>
        <td>
          <select data-order-id="${order._id}" class="status-select form-control status-dropdown">
            <option value="Pending" ${status === 'Pending' ? 'selected' : ''}>Pending</option>
            <option value="Processing" ${status === 'Processing' ? 'selected' : ''}>Processing</option>
            <option value="Completed" ${status === 'Completed' ? 'selected' : ''}>Completed</option>
            <option value="Cancelled" ${status === 'Cancelled' ? 'selected' : ''}>Cancelled</option>
          </select>
        </td>
      `;
      ordersTable.appendChild(row);
    });
  };

  const renderUsers = (customerRecords) => {
    const term = searchState.users;
    const filteredUsers = customerRecords.filter((record) => matchesSearch([
      record.siteId,
      record.customerName,
      record.customerPhone,
      record.siteAddress,
      record.warranty
    ], term));
    usersTable.innerHTML = '';
    if (!filteredUsers.length) {
      usersTable.innerHTML = emptyRow(4, term ? 'No matching records found.' : 'No Records Found');
      return;
    }

    filteredUsers.forEach((customer) => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td class="customer-column">${customer.customerName || '-'}</td>
        <td class="phone-column">${customer.customerPhone || '-'}</td>
        <td class="address-column">${customer.siteId || customer.siteAddress || '-'}</td>
        <td class="warranty-column">${customer.warranty || 'No Warranty'}</td>
      `;
      usersTable.appendChild(row);
    });
  };

  const renderSites = (sites) => {
    const term = searchState.sites;
    const filteredSites = sites.filter((site) => matchesSearch([
      site.siteId,
      site.siteName,
      site.customerName,
      site.location,
      site.siteAddress
    ], term));
    sitesTable.innerHTML = '';
    if (!filteredSites.length) {
      sitesTable.innerHTML = emptyRow(7, term ? 'No matching records found.' : 'No Records Found', 'Add New Site', term ? '' : 'sites');
      return;
    }

    filteredSites.forEach((site) => {
      const row = document.createElement('tr');
      row.dataset.siteId = site._id;
      row.innerHTML = `
        <td class="site-id-column">${site.siteId}</td>
        <td class="customer-column">${site.customerName}</td>
        <td class="address-column">${site.siteAddress}</td>
        <td class="work-type-column">${site.workType || site.projectType}</td>
        <td>${site.warranty || 'No Warranty'}</td>
        <td class="date-column">${formatDate(site.startDate)}</td>
        <td class="actions-column">
          <div class="table-actions action-buttons">
            <button class="btn btn-action btn-view" data-site-action="details" data-id="${site._id}">View Details</button>
            <button class="btn btn-action btn-edit" data-site-action="edit" data-id="${site._id}">Edit</button>
            <button class="btn btn-action btn-delete" data-site-action="delete" data-id="${site._id}">Delete</button>
          </div>
        </td>
      `;
      sitesTable.appendChild(row);
    });
  };

  const renderSiteDetails = (site) => {
    siteDetails.innerHTML = `
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 1.5rem;">
        <div class="card" style="padding: 1.5rem; background: #F8FAFC; border: 1px solid var(--border-color); box-shadow: none;">
          <h4 style="margin-top: 0; margin-bottom: 1rem; color: var(--secondary-color); border-bottom: 1px solid #E2E8F0; padding-bottom: 0.5rem;">Site Information</h4>
          <div style="display: grid; gap: 0.75rem;">
            <p style="margin:0;"><strong>Site ID:</strong> <code style="background: #E2E8F0; padding: 2px 6px; border-radius: 4px;">${site.siteId}</code></p>
            <p style="margin:0;"><strong>Customer:</strong> ${site.customerName}</p>
            <p style="margin:0;"><strong>Phone:</strong> ${site.customerPhone}</p>
            <p style="margin:0;"><strong>Address:</strong> ${site.siteAddress}</p>
            <p style="margin:0;"><strong>Warranty:</strong> <span class="badge badge-normal">${site.warranty || 'No Warranty'}</span></p>
          </div>
        </div>
        <div class="card" style="padding: 1.5rem; background: #F8FAFC; border: 1px solid var(--border-color); box-shadow: none;">
          <h4 style="margin-top: 0; margin-bottom: 1rem; color: var(--secondary-color); border-bottom: 1px solid #E2E8F0; padding-bottom: 0.5rem;">Project Details</h4>
          <div style="display: grid; gap: 0.75rem;">
            <p style="margin:0;"><strong>Work Type:</strong> ${site.workType}</p>
            <p style="margin:0;"><strong>Project Type:</strong> ${site.projectType}</p>
            <p style="margin:0;"><strong>Timeline:</strong> ${formatDate(site.startDate)} to ${formatDate(site.expectedEndDate)}</p>
            <p style="margin:0;"><strong>Status:</strong> ${statusBadge(site.status)}</p>
            <p style="margin:0;"><strong>Linked Order:</strong> ${site.linkedOrderId || 'None'}</p>
          </div>
        </div>
      </div>
      <div class="card" style="margin-top: 1.5rem; padding: 1.5rem; background: #F8FAFC; border: 1px solid var(--border-color); box-shadow: none;">
        <h4 style="margin-top: 0; margin-bottom: 0.5rem; color: var(--secondary-color);">Additional Notes</h4>
        <p style="margin: 0; color: #475569; line-height: 1.6;">${site.notes || site.additionalNotes || 'No additional notes provided for this site.'}</p>
      </div>
    `;
  };

  const renderQuotations = (quotations) => {
    if (!quotationsTable) return;
    const term = searchState.quotations;
    const filteredQuotations = quotations.filter((quotation) => matchesSearch([
      quotation.quotationId,
      quotation.customerName,
      quotation.surfaceType,
      quotation.customerPhone,
      quotation.status,
      quotation.createdAt ? new Date(quotation.createdAt).toLocaleDateString() : ''
    ], term));
    quotationsTable.innerHTML = '';
    if (!filteredQuotations.length) {
      quotationsTable.innerHTML = emptyRow(6, term ? 'No matching records found.' : 'No Records Found', 'Create Quotation', term ? '' : 'quotations');
      return;
    }

    filteredQuotations.forEach((quotation) => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${quotation.quotationId}</td>
        <td>${quotation.customerName}</td>
        <td>${quotation.surfaceType || quotation.projectType}</td>
        <td>₹${Number(quotation.finalAmount || quotation.totalEstimatedCost || 0).toFixed(2)}</td>
        <td>${statusBadge(quotation.status)}</td>
        <td>
          <div class="table-actions action-buttons">
            <button class="btn btn-action btn-view" data-quotation-action="view" data-id="${quotation._id}">View</button>
            <button class="btn btn-action btn-edit" data-quotation-action="edit" data-id="${quotation._id}">Edit</button>
            <button class="btn btn-action btn-delete" data-quotation-action="delete" data-id="${quotation._id}">Delete</button>
            <button class="btn btn-action btn-view" data-quotation-action="convert" data-id="${quotation._id}">Convert</button>
          </div>
        </td>
      `;
      quotationsTable.appendChild(row);
    });
  };

  const renderBookings = (bookings) => {
    if (!bookingsTable) return;
    const term = searchState.bookings;
    const filteredBookings = bookings.filter((booking) => matchesSearch([
      booking.serviceId,
      booking.user?.name,
      booking.serviceName,
      booking.siteAddress || booking.site,
      booking.createdAt ? new Date(booking.createdAt).toLocaleDateString() : ''
    ], term));
    bookingsTable.innerHTML = '';
    if (!filteredBookings.length) {
      bookingsTable.innerHTML = emptyRow(6, term ? 'No matching records found.' : 'No Records Found');
      return;
    }

    filteredBookings.forEach((booking) => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${booking.serviceId}</td>
        <td>${booking.user ? booking.user.name : '-'}</td>
        <td>${booking.serviceName}</td>
        <td>${booking.siteAddress || booking.site}</td>
        <td>${formatDate(booking.preferredStartDate)}</td>
        <td>
          <select class="form-control status-dropdown" data-booking-action="status" data-id="${booking._id}">
            <option value="Pending" ${booking.status === 'Pending' ? 'selected' : ''}>Pending</option>
            <option value="Approved" ${booking.status === 'Approved' ? 'selected' : ''}>Approved</option>
            <option value="Assigned" ${booking.status === 'Assigned' ? 'selected' : ''}>Assigned</option>
            <option value="Completed" ${booking.status === 'Completed' ? 'selected' : ''}>Completed</option>
          </select>
        </td>
      `;
      bookingsTable.appendChild(row);
    });
  };

  const renderInvoices = (invoices) => {
    if (!invoicesTable) return;
    const term = searchState.invoices;
    const filteredInvoices = invoices.filter((invoice) => matchesSearch([
      invoice.invoiceNumber,
      invoice.customerDetails?.fullName,
      invoice.order?.orderId,
      invoice.invoiceDate ? new Date(invoice.invoiceDate).toLocaleDateString() : ''
    ], term));
    invoicesTable.innerHTML = '';
    if (!filteredInvoices.length) {
      invoicesTable.innerHTML = emptyRow(6, term ? 'No matching records found.' : 'No Records Found');
      return;
    }

    filteredInvoices.forEach((invoice) => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${invoice.invoiceNumber}</td>
        <td>${invoice.order ? invoice.order.orderId : '-'}</td>
        <td>${invoice.customerDetails.fullName}</td>
        <td>₹${Number(invoice.totalCost || 0).toFixed(2)}</td>
        <td>${formatDate(invoice.invoiceDate)}</td>
        <td><button class="btn btn-action btn-view" data-invoice-action="view" data-id="${invoice._id}">View/Print</button></td>
      `;
      invoicesTable.appendChild(row);
    });
  };

  const renderAnalytics = (analytics) => {
    if (!analytics || !analytics.data) return;
    const data = analytics.data;
    document.getElementById('an-total-orders').textContent = data.totals.totalOrders;
    document.getElementById('an-total-revenue').textContent = `₹${Number(data.totals.totalRevenue).toFixed(0)}`;
    document.getElementById('an-active-sites').textContent = data.totals.activeSites;
    document.getElementById('an-completed-projects').textContent = data.totals.completedProjects;

    const revenueChart = document.getElementById('revenue-chart');
    if (revenueChart) {
      const maxRevenue = Math.max(...data.revenueTrend.map((item) => item.revenue), 1);
      revenueChart.innerHTML = data.revenueTrend.map((item) => {
        const pct = Math.round((item.revenue / maxRevenue) * 100);
        return `<div style="display:flex;align-items:center;gap:0.8rem;margin-bottom:0.45rem;"><span style="width:85px;">${item.month}</span><div style="height:10px;background:#0f766e;width:${pct}%;min-width:6px;border-radius:8px;"></div><span>₹${Math.round(item.revenue)}</span></div>`;
      }).join('') || '<p>No monthly revenue data yet.</p>';
    }

    const progress = data.siteProgress;
    const total = progress.pending + progress.inProgress + progress.completed || 1;
    const siteProgressChart = document.getElementById('site-progress-chart');
    if (siteProgressChart) {
      siteProgressChart.innerHTML = `
        <div style="display:grid;gap:0.5rem;">
          <div>Pending: ${progress.pending} (${Math.round((progress.pending / total) * 100)}%)</div>
          <div>In Progress: ${progress.inProgress} (${Math.round((progress.inProgress / total) * 100)}%)</div>
          <div>Completed: ${progress.completed} (${Math.round((progress.completed / total) * 100)}%)</div>
        </div>
      `;
    }
  };

  const loadMainModules = async () => {
    productsTable.innerHTML = loadingRow(8, 'Loading products...');
    ordersTable.innerHTML = loadingRow(8, 'Loading orders...');
    usersTable.innerHTML = loadingRow(4, 'Loading customers...');
    const orderParams = new URLSearchParams({ page: String(ordersCurrentPage), limit: '10' });
    if (searchState.orders) {
      orderParams.set('q', searchState.orders);
    }
    const [productsRes, ordersRes] = await Promise.all([
      window.API.getProducts(), 
      window.API.getOrders(orderParams.toString())
    ]);
    productsCache = productsRes.data || [];
    ordersCache = (ordersRes.data || []).map((order) => ({ ...order, status: normalizeOrderStatus(order.status) }));
    
    // Extract pagination metadata for orders
    if (ordersRes.pagination) {
      ordersTotalPages = ordersRes.pagination.totalPages || 1;
      ordersCurrentPage = ordersRes.pagination.currentPage || 1;
    }
    
    renderProducts(productsCache);
    renderOrders(ordersCache);
    renderOrdersPagination();
    renderUsers(sitesCache);
  };

  const loadServiceModules = async () => {
    sitesTable.innerHTML = loadingRow(7, 'Loading sites...');
    const siteParams = new URLSearchParams({ page: String(sitesCurrentPage), limit: '10' });
    if (searchState.sites) {
      siteParams.set('q', searchState.sites);
    }
    const [sitesRes] = await Promise.all([
      window.API.getSites(siteParams.toString())
    ]);
    sitesCache = sitesRes.data || [];
    
    // Extract pagination metadata for sites
    if (sitesRes.pagination) {
      sitesTotalPages = sitesRes.pagination.totalPages || 1;
      sitesCurrentPage = sitesRes.pagination.currentPage || 1;
    }
    
    renderSites(sitesCache);
    renderSitesPagination();
    renderUsers(sitesCache);
  };

  const renderOrdersPagination = () => {
    let paginationContainer = document.getElementById('admin-orders-pagination');
    if (!paginationContainer) {
      if (!ordersTable) return;
      paginationContainer = document.createElement('div');
      paginationContainer.id = 'admin-orders-pagination';
      ordersTable.parentElement.appendChild(paginationContainer);
    }

    if (ordersTotalPages > 1) {
      const pagination = new Pagination('admin-orders-pagination', ordersCurrentPage, ordersTotalPages, (page) => {
        ordersCurrentPage = page;
        window.scrollTo({ top: 0, behavior: 'smooth' });
        loadMainModules();
      });
      pagination.render();
    } else {
      paginationContainer.innerHTML = '';
    }
  };

  const renderSitesPagination = () => {
    let paginationContainer = document.getElementById('admin-sites-pagination');
    if (!paginationContainer) {
      if (!sitesTable) return;
      paginationContainer = document.createElement('div');
      paginationContainer.id = 'admin-sites-pagination';
      sitesTable.parentElement.appendChild(paginationContainer);
    }

    if (sitesTotalPages > 1) {
      const pagination = new Pagination('admin-sites-pagination', sitesCurrentPage, sitesTotalPages, (page) => {
        sitesCurrentPage = page;
        window.scrollTo({ top: 0, behavior: 'smooth' });
        loadServiceModules();
      });
      pagination.render();
    } else {
      paginationContainer.innerHTML = '';
    }
  };

  const loadAdvancedModules = async () => {
    if (quotationsTable) quotationsTable.innerHTML = loadingRow(6, 'Loading quotations...');
    if (bookingsTable) bookingsTable.innerHTML = loadingRow(7, 'Loading bookings...');
    if (invoicesTable) invoicesTable.innerHTML = loadingRow(6, 'Loading invoices...');
    const [quotationsRes, bookingsRes, invoicesRes, analyticsRes] = await Promise.all([
      window.API.getQuotations(),
      window.API.getServices(),
      window.API.getInvoices(),
      window.API.getDashboard()
    ]);

    quotationsCache = quotationsRes.data || [];
    bookingsCache = bookingsRes.data || [];
    invoicesCache = invoicesRes.data || [];

    renderQuotations(quotationsCache);
    renderBookings(bookingsCache);
    renderInvoices(invoicesCache);
    renderAnalytics(analyticsRes);
    setStats(productsCache, ordersCache, sitesCache, quotationsCache, analyticsRes.data);
  };

  const initSearchToolbars = () => {
    buildSearchToolbar(productsTable, 'products', 'Search products...', () => renderProducts(productsCache));
    buildSearchToolbar(ordersTable, 'orders', 'Search orders...', () => {
      ordersCurrentPage = 1;
      loadMainModules();
    });
    buildSearchToolbar(usersTable, 'users', 'Search customers...', () => renderUsers(sitesCache));
    buildSearchToolbar(sitesTable, 'sites', 'Search sites...', () => {
      sitesCurrentPage = 1;
      loadServiceModules();
    });
    buildSearchToolbar(quotationsTable, 'quotations', 'Search quotations...', () => renderQuotations(quotationsCache));
    buildSearchToolbar(bookingsTable, 'bookings', 'Search service bookings...', () => renderBookings(bookingsCache));
    buildSearchToolbar(invoicesTable, 'invoices', 'Search invoices...', () => renderInvoices(invoicesCache));
  };

  const recalculateQuotationTotal = () => {
    if (!quotationForm) return;
    const areaInput = document.getElementById('q-area');
    const surfaceInput = document.getElementById('q-surfaceType');
    const priceInput = document.getElementById('q-pricePerSqft');
    const materialInput = document.getElementById('q-materialCost');
    const labourInput = document.getElementById('q-labourCost');
    const additionalInput = document.getElementById('q-additionalCharges');
    const discountInput = document.getElementById('q-discount');
    const gstInput = document.getElementById('q-gst');

    const area = Math.max(Number(areaInput.value || 0), 0);
    const surfaceType = surfaceInput.value;
    const defaultPrice = surfacePricing[surfaceType] || 0;

    if (surfaceType) {
      const shouldAutoFill = !priceInput.value || priceInput.dataset.autoFilled === 'true';
      if (shouldAutoFill) {
        priceInput.value = defaultPrice.toFixed(2);
        priceInput.dataset.autoFilled = 'true';
      }
    } else if (priceInput.dataset.autoFilled === 'true') {
      priceInput.value = '';
      priceInput.dataset.autoFilled = 'false';
    }

    const pricePerSqft = Math.max(Number(priceInput.value || 0), 0);
    const materialCost = Math.max(Number(materialInput.value || 0), 0);
    const labourCost = Math.max(Number(labourInput.value || 0), 0);
    const additionalCharges = Math.max(Number(additionalInput.value || 0), 0);
    const discount = Math.min(Math.max(Number(discountInput.value || 0), 0), 100);
    const gst = Math.min(Math.max(Number(gstInput.value || 0), 0), 100);

    const baseAmount = area * pricePerSqft;
    const subtotal = baseAmount + materialCost + labourCost + additionalCharges;
    const discountAmount = subtotal * (discount / 100);
    const taxableAmount = Math.max(subtotal - discountAmount, 0);
    const gstAmount = taxableAmount * (gst / 100);
    const finalAmount = taxableAmount + gstAmount;

    document.getElementById('q-baseAmount').value = baseAmount.toFixed(2);
    document.getElementById('q-totalEstimatedCost').value = finalAmount.toFixed(2);
  };

  document.getElementById('product-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const imageFile = document.getElementById('p-image').files[0];
    const payload = new FormData();
    payload.append('productName', document.getElementById('p-name').value.trim());
    payload.append('category', document.getElementById('p-category').value);
    payload.append('description', document.getElementById('p-description').value.trim());
    payload.append('pricePerUnit', String(Number(document.getElementById('p-price').value)));
    payload.append('quantityUnit', document.getElementById('p-unit').value);
    payload.append('stockQuantity', String(Number(document.getElementById('p-stock').value)));
    payload.append('discountPercent', String(Number(document.getElementById('p-discount').value || 0)));
    payload.append('status', document.getElementById('p-status').value);
    if (imageFile) payload.append('productImage', imageFile);

    await window.API.createProduct(payload);
    event.target.reset();
    await loadMainModules();
  });

  document.getElementById('site-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const payload = {
      siteId: document.getElementById('s-siteId').value.trim() || undefined,
      customerName: document.getElementById('s-customerName').value.trim(),
      customerPhone: document.getElementById('s-customerPhone').value.trim(),
      siteAddress: document.getElementById('s-siteAddress').value.trim(),
      projectType: document.getElementById('s-projectType').value,
      workType: document.getElementById('s-workType').value.trim(),
      warranty: document.getElementById('s-warranty').value,
      startDate: document.getElementById('s-startDate').value,
      expectedEndDate: document.getElementById('s-endDate').value,
      status: document.getElementById('s-status').value
    };

    try {
      await window.API.createSite(payload);
      event.target.reset();
      showSiteMessage('Site created successfully.');
      await loadServiceModules();
    } catch (error) {
      showSiteMessage(error.message, true);
    }
  });

  if (quotationForm) {
    ['q-area', 'q-surfaceType', 'q-pricePerSqft', 'q-materialCost', 'q-labourCost', 'q-additionalCharges', 'q-discount', 'q-gst'].forEach((id) => {
      const field = document.getElementById(id);
      field.addEventListener('input', recalculateQuotationTotal);
      field.addEventListener('change', recalculateQuotationTotal);
    });
    document.getElementById('q-pricePerSqft').addEventListener('input', () => {
      document.getElementById('q-pricePerSqft').dataset.autoFilled = 'false';
      recalculateQuotationTotal();
    });
    recalculateQuotationTotal();

    quotationForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      const payload = {
        customerName: document.getElementById('q-customerName').value.trim(),
        customerPhone: document.getElementById('q-customerPhone').value.trim(),
        customerEmail: document.getElementById('q-customerEmail').value.trim(),
        siteAddress: document.getElementById('q-siteAddress').value.trim(),
        projectType: document.getElementById('q-projectType').value,
        workType: document.getElementById('q-workType').value.trim(),
        area: Number(document.getElementById('q-area').value || 0),
        surfaceType: document.getElementById('q-surfaceType').value,
        pricePerSqft: Number(document.getElementById('q-pricePerSqft').value || 0),
        baseAmount: Number(document.getElementById('q-baseAmount').value || 0),
        materialCost: Number(document.getElementById('q-materialCost').value || 0),
        labourCost: Number(document.getElementById('q-labourCost').value || 0),
        additionalCharges: Number(document.getElementById('q-additionalCharges').value || 0),
        discount: Number(document.getElementById('q-discount').value || 0),
        gst: Number(document.getElementById('q-gst').value || 0),
        totalEstimatedCost: Number(document.getElementById('q-totalEstimatedCost').value || 0),
        notes: document.getElementById('q-notes').value.trim(),
        status: document.getElementById('q-status').value
      };

      await window.API.createQuotation(payload);
      quotationForm.reset();
      document.getElementById('q-pricePerSqft').dataset.autoFilled = 'false';
      recalculateQuotationTotal();
      await loadAdvancedModules();
    });
  }

  productsTable.addEventListener('click', async (event) => {
    const button = event.target.closest('button[data-product-action]');
    if (!button) return;
    const product = productsCache.find((item) => item._id === button.dataset.id);
    if (!product) return;

    if (button.dataset.productAction === 'edit') {
      const updatedName = safePrompt('Product Name:', product.productName);
      if (updatedName === null) return;
      const updatedDescription = safePrompt('Description:', product.description || '');
      if (updatedDescription === null) return;
      const updatedPrice = safePrompt('Price:', String(product.pricePerUnit));
      if (updatedPrice === null) return;
      const updatedQuantity = safePrompt('Quantity:', String(product.stockQuantity));
      if (updatedQuantity === null) return;
      const updatedStatus = safePrompt('Status (Active/Inactive):', product.status || 'Active');
      if (updatedStatus === null) return;

      await window.API.updateProduct(product._id, {
        productName: updatedName.trim(),
        description: updatedDescription.trim(),
        pricePerUnit: Number(updatedPrice),
        stockQuantity: Number(updatedQuantity),
        status: updatedStatus
      });
      await loadMainModules();
      return;
    }

    if (button.dataset.productAction === 'delete') {
      if (!window.confirm('Delete this product?')) return;
      await window.API.deleteProduct(product._id);
      await loadMainModules();
    }
  });

  ordersTable.addEventListener('change', async (event) => {
    const select = event.target.closest('.status-select');
    if (!select) return;
    await window.API.updateOrderStatus(select.dataset.orderId, select.value);
    await loadMainModules();
  });

  if (quotationsTable) {
    quotationsTable.addEventListener('click', async (event) => {
      const button = event.target.closest('button[data-quotation-action]');
      if (!button) return;
      const quotation = quotationsCache.find((item) => item._id === button.dataset.id);
      if (!quotation) return;

      if (button.dataset.quotationAction === 'view') {
        const printable = window.open('', '_blank');
        printable.document.write(`
          <html><head><title>Quotation ${quotation.quotationId}</title></head><body>
          <h2>Karankar Sons & Chemicals</h2>
          <hr>
          <p><strong>Quotation Number:</strong> ${quotation.quotationId}</p>
          <p><strong>Date:</strong> ${new Date(quotation.createdAt).toLocaleDateString()}</p>
          <p><strong>Customer:</strong> ${quotation.customerName}</p>
          <p><strong>Phone:</strong> ${quotation.customerPhone}</p>
          <p><strong>Email:</strong> ${quotation.customerEmail || 'N/A'}</p>
          <p><strong>Site Address:</strong> ${quotation.siteAddress}</p>
          <p><strong>Project Type:</strong> ${quotation.projectType}</p>
          <p><strong>Work Type:</strong> ${quotation.workType}</p>
          <table border="1" cellspacing="0" cellpadding="6" width="100%">
            <thead><tr><th>Description</th><th>Area</th><th>Rate</th><th>Total</th></tr></thead>
            <tbody>
              <tr>
                <td>${quotation.surfaceType} Waterproofing</td>
                <td>${quotation.area} sq.ft</td>
                <td>₹${Number(quotation.pricePerSqft || 0).toFixed(2)}</td>
                <td>₹${Number(quotation.baseAmount || 0).toFixed(2)}</td>
              </tr>
            </tbody>
          </table>
          <p><strong>Material Cost:</strong> ₹${Number(quotation.materialCost || 0).toFixed(2)}</p>
          <p><strong>Labour Cost:</strong> ₹${Number(quotation.labourCost || 0).toFixed(2)}</p>
          <p><strong>Additional Charges:</strong> ₹${Number(quotation.additionalCharges || 0).toFixed(2)}</p>
          <p><strong>Subtotal:</strong> ₹${Number(quotation.subtotal || quotation.baseAmount || 0).toFixed(2)}</p>
          <p><strong>Discount (${quotation.discount || 0}%):</strong> -₹${Number(quotation.discountAmount || 0).toFixed(2)}</p>
          <p><strong>GST (${quotation.gst || 0}%):</strong> ₹${Number(quotation.gstAmount || 0).toFixed(2)}</p>
          <h3>Final Amount: ₹${Number(quotation.finalAmount || quotation.totalEstimatedCost || 0).toFixed(2)}</h3>
          <p><strong>Notes:</strong> ${quotation.notes || 'None'}</p>
          <p><strong>Status:</strong> ${quotation.status}</p>
          <button onclick="window.print()">Print / Save PDF</button>
          </body></html>
        `);
        printable.document.close();
        return;
      }

      if (button.dataset.quotationAction === 'edit') {
        const nextStatus = safePrompt('Update status (Draft/Sent/Approved/Rejected):', quotation.status);
        if (nextStatus === null) return;
        await window.API.updateQuotation(quotation._id, { status: nextStatus });
        await loadAdvancedModules();
        return;
      }

      if (button.dataset.quotationAction === 'delete') {
        if (!window.confirm('Delete this quotation?')) return;
        await window.API.deleteQuotation(quotation._id);
        await loadAdvancedModules();
        return;
      }

      if (button.dataset.quotationAction === 'convert') {
        await window.API.convertQuotation(quotation._id);
        await loadMainModules();
        await loadAdvancedModules();
      }
    });
  }

  if (bookingsTable) {
    bookingsTable.addEventListener('change', async (event) => {
      const statusSelect = event.target.closest('select[data-booking-action="status"]');
      if (statusSelect) {
        await window.API.updateServiceStatus(statusSelect.dataset.id, statusSelect.value);
        await loadAdvancedModules();
        return;
      }

      const assignSelect = event.target.closest('select[data-booking-action="assign"]');
      if (assignSelect && assignSelect.value) {
        await window.API.assignServiceLabour(assignSelect.dataset.id, assignSelect.value);
        await loadAdvancedModules();
      }
    });
  }

  if (invoicesTable) {
    invoicesTable.addEventListener('click', async (event) => {
      const button = event.target.closest('button[data-invoice-action="view"]');
      if (!button) return;
      const invoiceRes = await window.API.getInvoiceById(button.dataset.id);
      const invoice = invoiceRes.data;
      const printable = window.open('', '_blank');
      printable.document.write(`
        <html><head><title>Invoice ${invoice.invoiceNumber}</title></head><body>
        <h2>${invoice.companyName}</h2>
        <p>${invoice.companyAddress}</p>
        <hr>
        <p><strong>Invoice Number:</strong> ${invoice.invoiceNumber}</p>
        <p><strong>Date:</strong> ${new Date(invoice.invoiceDate).toLocaleDateString()}</p>
        <p><strong>Customer:</strong> ${invoice.customerDetails.fullName}</p>
        <p><strong>Address:</strong> ${invoice.customerDetails.address}, ${invoice.customerDetails.city} - ${invoice.customerDetails.pincode}</p>
        <table border="1" cellspacing="0" cellpadding="6" width="100%"><thead><tr><th>Item</th><th>Qty</th><th>Unit Price</th><th>Total</th></tr></thead>
        <tbody>${invoice.items.map((item) => `<tr><td>${item.itemName}</td><td>${item.quantity}</td><td>₹${Number(item.unitPrice).toFixed(2)}</td><td>₹${Number(item.lineTotal).toFixed(2)}</td></tr>`).join('')}</tbody></table>
        <p><strong>Labour Charges:</strong> ₹${Number(invoice.labourCharges || 0).toFixed(2)}</p>
        <h3>Total: ₹${Number(invoice.totalCost || 0).toFixed(2)}</h3>
        <button onclick="window.print()">Print / Save PDF</button>
        </body></html>
      `);
      printable.document.close();
    });
  }

  sitesTable.addEventListener('click', async (event) => {
    const button = event.target.closest('button[data-site-action]');
    if (!button) return;
    const site = sitesCache.find((item) => item._id === button.dataset.id);
    if (!site) return;

    sitesTable.querySelectorAll('tr.selected-row').forEach((row) => row.classList.remove('selected-row'));
    const row = button.closest('tr');
    if (row) row.classList.add('selected-row');

    if (button.dataset.siteAction === 'details') {
      try {
        const siteDetailsSection = document.getElementById('siteDetailsSection');
        if (siteDetailsSection) {
          siteDetailsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
        siteDetails.innerHTML = '<div class="loading-state"><span class="loading-spinner" aria-hidden="true"></span><span>Loading site details...</span></div>';
        const response = await window.API.getSiteById(site._id);
        renderSiteDetails(response.data);
        if (siteDetailsSection) {
          siteDetailsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      } catch (error) {
        showSiteMessage(error.message, true);
        siteDetails.innerHTML = `<div class="empty-state" style="padding: 2rem; text-align: center; color: var(--text-color);"><span style="font-size: 2rem; display: block; margin-bottom: 1rem;">⚠️</span><span>Failed to load site details. Please try again.</span></div>`;
      }
      return;
    }

    if (button.dataset.siteAction === 'edit') {
      const newAddress = safePrompt('Update site address:', site.siteAddress);
      if (newAddress === null) return;
      const newWorkType = safePrompt('Update work type:', site.workType);
      if (newWorkType === null) return;
      const newWarranty = safePrompt('Update warranty (No Warranty/1 Year/2 Years/3 Years/5 Years/10 Years):', site.warranty || 'No Warranty');
      if (newWarranty === null) return;
      try {
        await window.API.updateSite(site._id, { siteAddress: newAddress, workType: newWorkType, warranty: newWarranty });
        showSiteMessage('Site updated successfully.');
        await loadServiceModules();
      } catch (error) {
        showSiteMessage(error.message, true);
      }
      return;
    }

    if (button.dataset.siteAction === 'delete') {
      if (!window.confirm('Delete this site record?')) return;
      try {
        await window.API.deleteSite(site._id);
        showSiteMessage('Site deleted successfully.');
        siteDetails.textContent = 'Select "View Details" from table to load site information.';
        await loadServiceModules();
      } catch (error) {
        showSiteMessage(error.message, true);
      }
    }
  });

  document.querySelector('.content-wrapper').addEventListener('click', (event) => {
    const actionButton = event.target.closest('button[data-empty-target]');
    if (!actionButton) return;
    const sectionId = actionButton.dataset.emptyTarget;
    const sectionLink = document.querySelector(`.nav-item[data-section="${sectionId}"]`);
    if (sectionLink) sectionLink.click();
  });

  initSearchToolbars();
  await Promise.all([loadMainModules(), loadServiceModules()]);
  await loadAdvancedModules();
});