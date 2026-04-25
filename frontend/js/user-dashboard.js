document.addEventListener('DOMContentLoaded', async () => {
  const user = window.API.requireAuth('user');
  if (!user) {
    return;
  }

  const userName = document.getElementById('user-name');
  if (userName) {
    userName.textContent = user.name;
  }

  const userLogout = document.getElementById('user-logout');
  if (userLogout) {
    userLogout.addEventListener('click', (e) => {
      e.preventDefault();
      window.API.logout();
    });
  }

  // Real-time updates
  window.API.initSocket();
  window.API.onEvent('order-status-updated', () => {
    Toast.success('Your order status has been updated!');
    if (typeof loadAllData === 'function') loadAllData();
  });
  window.API.onEvent('site-status-updated', () => {
    Toast.success('Your site progress has been updated!');
    if (typeof loadAllData === 'function') loadAllData();
  });

  const userOrdersTable = document.getElementById('user-orders-table');
  const userCartTable = document.getElementById('user-cart-table');
  const userBookingsTable = document.getElementById('user-bookings-table');
  const userSitesTable = document.getElementById('user-sites-table');
  const userInvoicesTable = document.getElementById('user-invoices-table');
  const cartCheckoutBtn = document.getElementById('cart-checkout-btn');

  let bookingsCache = [];
  let invoicesCache = [];

  const fillProfile = (profile) => {
    document.getElementById('profile-name').value = profile.name || '';
    document.getElementById('profile-email').value = profile.email || '';
    document.getElementById('profile-phone').value = profile.phone || '';
    document.getElementById('profile-address').value = profile.address || '';
    document.getElementById('profile-city').value = profile.city || '';
    document.getElementById('profile-pincode').value = profile.pincode || '';
  };

  const normalizeOrderStatus = (status) => (status === 'Delivered' ? 'Completed' : status);

  const toStatusClass = (status) => {
    const normalized = String(status || '').toLowerCase().trim().replace(/\s+/g, '-');
    const map = {
      pending: 'status-pending',
      processing: 'status-in-progress',
      approved: 'status-in-progress',
      assigned: 'status-in-progress',
      'in-progress': 'status-in-progress',
      'work-50%-complete': 'status-in-progress',
      'final-stage': 'status-in-progress',
      completed: 'status-completed',
      active: 'status-completed',
      available: 'status-completed',
      delivered: 'status-completed',
      sent: 'status-in-progress',
      converted: 'status-completed',
      draft: 'status-pending',
      cancelled: 'status-cancelled',
      rejected: 'status-cancelled',
      inactive: 'status-cancelled',
      'on-hold': 'status-pending'
    };
    return map[normalized] || 'status-default';
  };

  const statusBadge = (status) => `<span class="status-badge ${toStatusClass(status)}">${status || 'Unknown'}</span>`;

  const searchState = {
    orders: '',
    bookings: '',
    sites: '',
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

  // Pagination state
  let ordersCurrentPage = 1;
  let ordersTotalPages = 1;
  let sitesCurrentPage = 1;
  let sitesTotalPages = 1;

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

  const renderOverview = (profile, orders, userAnalytics) => {
    const profileSummary = document.getElementById('profile-summary');
    const recentOrders = document.getElementById('recent-orders-summary');

    document.getElementById('u-total-orders').textContent = userAnalytics.totalOrders || 0;
    document.getElementById('u-active-bookings').textContent = userAnalytics.activeBookings || 0;
    document.getElementById('u-active-sites').textContent = userAnalytics.activeSites || 0;
    document.getElementById('u-pending-services').textContent = userAnalytics.pendingBookings || 0;
    const totalSpentEl = document.getElementById('u-total-spent');
    if (totalSpentEl) {
      totalSpentEl.textContent = `₹${(userAnalytics.totalSpent || 0).toFixed(2)}`;
    }

    profileSummary.innerHTML = `
      <p><strong>Name:</strong> ${profile.name || '-'}</p>
      <p><strong>Email:</strong> ${profile.email || '-'}</p>
      <p><strong>Phone:</strong> ${profile.phone || '-'}</p>
      <p><strong>Address:</strong> ${profile.address || '-'}</p>
    `;

    const latest = orders.slice(0, 3);
    if (!latest.length) {
      recentOrders.innerHTML = '<div class="empty-state"><span class="empty-state-icon">📭</span><span>No Records Found</span></div>';
      return;
    }

    recentOrders.innerHTML = latest.map((order) => `
      <div style="padding: 0.6rem 0; border-bottom: 1px solid var(--border-color);">
        <div><strong>${order.orderId}</strong> | ${new Date(order.createdAt).toLocaleDateString()}</div>
        <div>Status: ${statusBadge(normalizeOrderStatus(order.status))} | Total: ₹${Number(order.totalAmount || 0).toFixed(2)}</div>
      </div>
    `).join('');
  };

  const renderOrders = (orders) => {
    const table = userOrdersTable;
    const term = searchState.orders;
    const filteredOrders = orders.filter((order) => matchesSearch([
      order.orderId,
      order.shippingDetails?.fullName,
      order.shippingDetails?.phone,
      order.payment?.razorpayPaymentId,
      order.payment?.transactionId,
      order.createdAt ? new Date(order.createdAt).toLocaleDateString() : ''
    ], term));
    table.innerHTML = '';
    if (!filteredOrders.length) {
      table.innerHTML = emptyRow(7, term ? 'No matching records found.' : 'No Records Found');
      return;
    }

    filteredOrders.forEach((order) => {
      const totalQty = (order.items || []).reduce((sum, item) => sum + Number(item.quantity || 0), 0);
      const row = document.createElement('tr');
      
      const hasService = Boolean(order.serviceSite);
      const requestButton = hasService 
        ? `<span class="status-badge status-completed">Service Active</span>`
        : `<button class="btn btn-action btn-edit btn-request-service" data-id="${order._id}">Request Service</button>`;

      row.innerHTML = `
        <td>${order.orderId}</td>
        <td>${order.items.map((item) => `${item.productName} x ${item.quantity}`).join(', ')}</td>
        <td>${totalQty}</td>
        <td>₹${order.totalAmount.toFixed(2)}</td>
        <td>${statusBadge(normalizeOrderStatus(order.status))}</td>
        <td>${new Date(order.createdAt).toLocaleDateString()}</td>
        <td>
          <div class="table-actions">
            <a class="btn btn-action btn-view" href="/order-detail?id=${order._id}">View</a>
            ${requestButton}
          </div>
        </td>
      `;
      table.appendChild(row);
    });

    // Handle Service Request Button clicks
    table.querySelectorAll('.btn-request-service').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const orderId = e.target.dataset.id;
            try {
                const res = await window.API.requestServiceFromOrder(orderId);
                if (res.success) {
                    Toast.success('Service request submitted successfully!');
                    if (typeof loadAllData === 'function') loadAllData();
                }
            } catch (err) {
                Toast.error(err.message || 'Failed to submit service request');
            }
        });
    });
  };

  const renderCart = (cart) => {
    const table = userCartTable;
    const totalEl = document.getElementById('user-cart-total');
    table.innerHTML = '';

    const items = (cart && cart.items) || [];
    if (!items.length) {
      table.innerHTML = emptyRow(5, 'No Records Found', 'Browse Products', 'orders');
      totalEl.textContent = '₹0.00';
      if (cartCheckoutBtn) cartCheckoutBtn.disabled = true;
      return;
    }

    let total = 0;
    items.forEach((item) => {
      const subtotal = Number(item.price) * Number(item.quantity);
      total += subtotal;
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${item.product.productName}</td>
        <td>${item.quantity}</td>
        <td>₹${Number(item.price).toFixed(2)}</td>
        <td>₹${subtotal.toFixed(2)}</td>
        <td>
          <div class="table-actions action-buttons">
            <button class="btn btn-action btn-view" data-cart-action="inc" data-id="${item.product._id}">+</button>
            <button class="btn btn-action btn-edit" data-cart-action="dec" data-id="${item.product._id}">-</button>
            <button class="btn btn-action btn-delete" data-cart-action="remove" data-id="${item.product._id}">Remove</button>
          </div>
        </td>
      `;
      table.appendChild(row);
    });

    totalEl.textContent = `₹${total.toFixed(2)}`;
    if (cartCheckoutBtn) cartCheckoutBtn.disabled = false;
  };

  const renderBookings = (bookings) => {
    const table = userBookingsTable;
    if (!table) return;
    const term = searchState.bookings;
    const filteredBookings = bookings.filter((booking) => matchesSearch([
      booking.serviceId,
      booking.user?.name,
      booking.serviceName,
      booking.siteAddress || booking.site,
      booking.createdAt ? new Date(booking.createdAt).toLocaleDateString() : ''
    ], term));
    table.innerHTML = '';

    if (!filteredBookings.length) {
      table.innerHTML = emptyRow(5, term ? 'No matching records found.' : 'No Records Found', 'Add New Booking', term ? '' : 'bookings');
      return;
    }

    filteredBookings.forEach((booking) => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${booking.serviceId}</td>
        <td>${booking.serviceName}</td>
        <td>${booking.siteAddress || booking.site}</td>
        <td>${booking.preferredStartDate ? new Date(booking.preferredStartDate).toLocaleDateString() : '-'}</td>
        <td>${statusBadge(booking.status)}</td>
      `;
      table.appendChild(row);
    });
  };

  const renderSites = (sites) => {
    const table = userSitesTable;
    if (!table) return;
    const term = searchState.sites;
    const filteredSites = sites.filter((site) => matchesSearch([
      site.siteId,
      site.siteName,
      site.customerName,
      site.location,
      site.siteAddress
    ], term));
    table.innerHTML = '';

    if (!filteredSites.length) {
      table.innerHTML = emptyRow(5, term ? 'No matching records found.' : 'No Records Found');
      return;
    }

    filteredSites.forEach((site) => {
      const assigned = (site.assignedLabours || []).map((labour) => labour.labourName).join(', ') || '-';
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${site.siteName || site.siteId}</td>
        <td>${assigned}</td>
        <td>${site.startDate ? new Date(site.startDate).toLocaleDateString() : '-'}</td>
        <td>${site.expectedEndDate ? new Date(site.expectedEndDate).toLocaleDateString() : '-'}</td>
        <td>${statusBadge(site.status)}</td>
      `;
      table.appendChild(row);
    });
  };

  const renderInvoices = (invoices) => {
    const table = userInvoicesTable;
    if (!table) return;
    const term = searchState.invoices;
    const filteredInvoices = invoices.filter((invoice) => matchesSearch([
      invoice.invoiceNumber,
      invoice.customerDetails?.fullName,
      invoice.order?.orderId,
      invoice.invoiceDate ? new Date(invoice.invoiceDate).toLocaleDateString() : ''
    ], term));
    table.innerHTML = '';

    if (!filteredInvoices.length) {
      table.innerHTML = emptyRow(5, term ? 'No matching records found.' : 'No Records Found');
      return;
    }

    filteredInvoices.forEach((invoice) => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${invoice.invoiceNumber}</td>
        <td>${invoice.order ? invoice.order.orderId : '-'}</td>
        <td>₹${Number(invoice.totalCost || 0).toFixed(2)}</td>
        <td>${new Date(invoice.invoiceDate).toLocaleDateString()}</td>
        <td><button class="btn btn-action btn-view" data-invoice-id="${invoice._id}">View/Print</button></td>
      `;
      table.appendChild(row);
    });
  };

  const renderOrdersPagination = () => {
    let paginationContainer = document.getElementById('user-orders-pagination');
    if (!paginationContainer) {
      const table = document.getElementById('user-orders-table');
      if (!table) return;
      paginationContainer = document.createElement('div');
      paginationContainer.id = 'user-orders-pagination';
      table.parentElement.appendChild(paginationContainer);
    }

    if (ordersTotalPages > 1) {
      const pagination = new Pagination('user-orders-pagination', ordersCurrentPage, ordersTotalPages, (page) => {
        ordersCurrentPage = page;
        window.scrollTo({ top: 0, behavior: 'smooth' });
        loadData();
      });
      pagination.render();
    } else {
      paginationContainer.innerHTML = '';
    }
  };

  const renderSitesPagination = () => {
    let paginationContainer = document.getElementById('user-sites-pagination');
    if (!paginationContainer) {
      const table = document.getElementById('user-sites-table');
      if (!table) return;
      paginationContainer = document.createElement('div');
      paginationContainer.id = 'user-sites-pagination';
      table.parentElement.appendChild(paginationContainer);
    }

    if (sitesTotalPages > 1) {
      const pagination = new Pagination('user-sites-pagination', sitesCurrentPage, sitesTotalPages, (page) => {
        sitesCurrentPage = page;
        window.scrollTo({ top: 0, behavior: 'smooth' });
        loadData();
      });
      pagination.render();
    } else {
      paginationContainer.innerHTML = '';
    }
  };

  const loadAndRenderCart = async () => {
    const cartRes = await window.API.getCart();
    renderCart(cartRes.data || {});
  };

  const loadData = async () => {
    if (userOrdersTable) userOrdersTable.innerHTML = loadingRow(7, 'Loading orders...');
    if (userCartTable) userCartTable.innerHTML = loadingRow(5, 'Loading cart...');
    if (userBookingsTable) userBookingsTable.innerHTML = loadingRow(5, 'Loading bookings...');
    if (userSitesTable) userSitesTable.innerHTML = loadingRow(5, 'Loading sites...');
    if (userInvoicesTable) userInvoicesTable.innerHTML = loadingRow(5, 'Loading invoices...');

    const orderParams = new URLSearchParams({ page: String(ordersCurrentPage), limit: '10' });
    if (searchState.orders) {
      orderParams.set('q', searchState.orders);
    }

    const siteParams = new URLSearchParams({ page: String(sitesCurrentPage), limit: '10' });
    if (searchState.sites) {
      siteParams.set('q', searchState.sites);
    }

    const [profileRes, ordersRes, cartRes, bookingsRes, sitesRes, invoicesRes, analyticsRes] = await Promise.all([
      window.API.getMyProfile(),
      window.API.getOrders(orderParams.toString()),
      window.API.getCart(),
      window.API.getServices(),
      window.API.getMySiteProgress(siteParams.toString()),
      window.API.getInvoices(),
      window.API.getUserAnalytics()
    ]);

    const profile = profileRes.data || {};
    const orders = ordersRes.data || [];
    bookingsCache = bookingsRes.data || [];
    const sites = sitesRes.data || [];
    invoicesCache = invoicesRes.data || [];
    const userAnalytics = analyticsRes.data || { totalOrders: 0, activeBookings: 0, activeSites: 0, pendingServices: 0 };
    
    // Extract pagination metadata
    if (ordersRes.pagination) {
      ordersTotalPages = ordersRes.pagination.totalPages || 1;
      ordersCurrentPage = ordersRes.pagination.currentPage || 1;
    }
    if (sitesRes.pagination) {
      sitesTotalPages = sitesRes.pagination.totalPages || 1;
      sitesCurrentPage = sitesRes.pagination.currentPage || 1;
    }
    
    fillProfile(profile);
    renderOverview(profile, orders, userAnalytics);
    renderOrders(orders);
    renderOrdersPagination();
    renderCart(cartRes.data || {});
    renderBookings(bookingsCache);
    renderSites(sites);
    renderSitesPagination();
    renderInvoices(invoicesCache);
  };

  const initSearchToolbars = () => {
    buildSearchToolbar(userOrdersTable, 'orders', 'Search orders...', () => {
      ordersCurrentPage = 1;
      loadData();
    });
    buildSearchToolbar(userBookingsTable, 'bookings', 'Search bookings...', () => renderBookings(bookingsCache));
    buildSearchToolbar(userSitesTable, 'sites', 'Search sites...', () => {
      sitesCurrentPage = 1;
      loadData();
    });
    buildSearchToolbar(userInvoicesTable, 'invoices', 'Search invoices...', () => renderInvoices(invoicesCache));
  };

  document.getElementById('profile-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
      name: document.getElementById('profile-name').value,
      phone: document.getElementById('profile-phone').value,
      address: document.getElementById('profile-address').value,
      city: document.getElementById('profile-city').value,
      pincode: document.getElementById('profile-pincode').value
    };

    const response = await window.API.updateMyProfile(payload);
    localStorage.setItem('user', JSON.stringify({ ...user, ...response.data }));
    await loadData();
    alert('Profile updated successfully.');
  });

  document.getElementById('user-cart-table').addEventListener('click', async (event) => {
    const button = event.target.closest('button[data-cart-action]');
    if (!button) {
      return;
    }

    const productId = button.dataset.id;
    const action = button.dataset.cartAction;
    const cartRes = await window.API.getCart();
    const currentItem = (cartRes.data.items || []).find((item) => item.product._id === productId);

    if (action === 'remove') {
      await window.API.removeCartItem(productId);
      await loadAndRenderCart();
      return;
    }

    if (!currentItem) {
      return;
    }

    if (action === 'inc') {
      await window.API.updateCart({ productId, quantity: currentItem.quantity + 1 });
      await loadAndRenderCart();
      return;
    }

    if (action === 'dec') {
      const nextQty = currentItem.quantity - 1;
      if (nextQty <= 0) {
        await window.API.removeCartItem(productId);
      } else {
        await window.API.updateCart({ productId, quantity: nextQty });
      }
      await loadAndRenderCart();
    }
  });

  if (cartCheckoutBtn) {
    cartCheckoutBtn.addEventListener('click', () => {
      window.location.href = '/checkout';
    });
  }

  initSearchToolbars();

  const bookingForm = document.getElementById('service-booking-form');
  if (bookingForm) {
    bookingForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      await window.API.createService({
        serviceName: document.getElementById('b-serviceType').value.trim(),
        projectType: document.getElementById('b-projectType').value,
        siteAddress: document.getElementById('b-siteAddress').value.trim(),
        preferredStartDate: document.getElementById('b-startDate').value,
        notes: document.getElementById('b-notes').value.trim()
      });
      bookingForm.reset();
      await loadData();
      alert('Service booking submitted successfully.');
    });
  }

  if (userInvoicesTable) {
    userInvoicesTable.addEventListener('click', async (event) => {
      const button = event.target.closest('button[data-invoice-id]');
      if (!button) return;
      const invoiceRes = await window.API.getInvoiceById(button.dataset.invoiceId);
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
        <table border="1" cellspacing="0" cellpadding="6" width="100%"><thead><tr><th>Item</th><th>Qty</th><th>Unit Price</th><th>Total</th></tr></thead>
        <tbody>${invoice.items.map((item) => `<tr><td>${item.itemName}</td><td>${item.quantity}</td><td>₹${Number(item.unitPrice).toFixed(2)}</td><td>₹${Number(item.lineTotal).toFixed(2)}</td></tr>`).join('')}</tbody></table>
        <h3>Total: ₹${Number(invoice.totalCost || 0).toFixed(2)}</h3>
        <button onclick="window.print()">Print / Save PDF</button>
        </body></html>
      `);
      printable.document.close();
    });
  }

  document.querySelector('.content-wrapper').addEventListener('click', (event) => {
    const actionButton = event.target.closest('button[data-empty-target]');
    if (!actionButton) return;
    const sectionId = actionButton.dataset.emptyTarget;
    const sectionLink = document.querySelector(`.nav-item[data-section="${sectionId}"]`);
    if (sectionLink) sectionLink.click();
  });

  // Refresh data when switching tabs
  document.querySelector('.sidebar-nav').addEventListener('click', (event) => {
    const link = event.target.closest('.nav-item[data-section]');
    if (link) {
      const section = link.dataset.section;
      if (section === 'cart') {
        loadAndRenderCart();
      } else if (section === 'overview' || section === 'orders' || section === 'sites' || section === 'bookings' || section === 'invoices') {
        loadData();
      }
    }
  });

  await loadData();
});