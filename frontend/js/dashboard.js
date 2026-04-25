// dashboard.js - Logic for Admin and User Dashboards

document.addEventListener('DOMContentLoaded', () => {
  const user = window.API.getCurrentUser();
  const token = localStorage.getItem('token');
  if (!token || !user) {
    window.location.href = '/login.html';
    return;
  }

  // 1. Sidebar Toggle Mobile
  const sidebarToggle = document.querySelector('.sidebar-toggle');
  const sidebar = document.querySelector('.sidebar');
  
  if (sidebarToggle && sidebar) {
    sidebarToggle.addEventListener('click', () => {
      sidebar.classList.toggle('show');
    });
  }

  // Section switching for single-page dashboard modules.
  const sidebarNav = document.querySelector('.sidebar-nav');
  const sectionLinks = document.querySelectorAll('.sidebar-nav .nav-item[data-section]');
  const sections = document.querySelectorAll('.dashboard-section[data-section]');
  if (sidebarNav && sectionLinks.length && sections.length) {
    const sectionMap = new Map();
    sections.forEach((section) => {
      sectionMap.set(section.dataset.section, section);
    });

    const pathToSection = {
      '/admin': 'overview',
      '/admin/dashboard': 'overview',
      '/admin/products': 'products',
      '/admin/orders': 'orders',
      '/admin/sites': 'sites',
      '/admin/users': 'users',
      '/admin/quotations': 'quotations',
      '/admin/bookings': 'bookings',
      '/admin/invoices': 'invoices',
      '/admin/analytics': 'analytics',
      '/dashboard': 'overview',
      '/orders': 'orders',
      '/profile': 'profile',
      '/cart': 'cart',
      '/dashboard/bookings': 'bookings',
      '/dashboard/sites': 'sites',
      '/dashboard/invoices': 'invoices'
    };

    const activateSection = (sectionKey) => {
      sectionLinks.forEach((link) => {
        const isActive = link.dataset.section === sectionKey;
        link.classList.toggle('active', isActive);
      });

      sections.forEach((section) => {
        section.classList.toggle('active', section.dataset.section === sectionKey);
      });

      if (window.matchMedia('(max-width: 992px)').matches && sidebar) {
        sidebar.classList.remove('show');
      }
    };

    const fromPath = pathToSection[window.location.pathname];
    const fromHash = window.location.hash ? window.location.hash.replace('#', '') : '';
    const fromQuery = new URLSearchParams(window.location.search).get('section');
    const initial = fromPath || fromQuery || fromHash || sectionLinks.find((link) => link.classList.contains('active'))?.dataset.section
      || sectionLinks[0].dataset.section;
    activateSection(initial);

    sidebarNav.addEventListener('click', (event) => {
      const link = event.target.closest('.nav-item[data-section]');
      if (!link) {
        return;
      }

      event.preventDefault();
      if (!sectionMap.has(link.dataset.section)) {
        return;
      }

      activateSection(link.dataset.section);

      const routePath = link.dataset.route;
      if (routePath && window.history && window.history.replaceState) {
        window.history.replaceState({}, '', routePath);
      }
    });
  }

  // 2. Priority Logic for Site Management Table (Admin)
  const siteRows = document.querySelectorAll('.site-row');
  siteRows.forEach(row => {
    const reqCell = row.querySelector('.req-labour');
    const availCell = row.querySelector('.avail-labour');
    const priorityCell = row.querySelector('.priority-status');
    const shortageCell = row.querySelector('.shortage-val');

    if (reqCell && availCell && priorityCell) {
      const required = parseInt(reqCell.textContent, 10) || 0;
      const available = parseInt(availCell.textContent, 10) || 0;
      
      const shortage = required > available ? required - available : 0;
      if (shortageCell) {
        shortageCell.textContent = shortage;
      }

      if (available < required) {
        priorityCell.innerHTML = '<span class="badge badge-high">HIGH</span>';
        row.classList.add('priority-high-row');
      } else {
        priorityCell.innerHTML = '<span class="badge badge-normal">NORMAL</span>';
      }
    }
  });

  // 3. Modal Toggles
  const openModalBtns = document.querySelectorAll('[data-target]');
  const closeBtns = document.querySelectorAll('.close-modal');

  openModalBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = btn.getAttribute('data-target');
      const targetModal = document.getElementById(targetId);
      if (targetModal) {
        targetModal.style.display = 'flex';
      }
    });
  });

  closeBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const modalBox = btn.closest('.modal-overlay');
      if (modalBox) {
        modalBox.style.display = 'none';
      }
    });
  });

  // Close modal when clicking outside content
  window.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal-overlay')) {
      e.target.style.display = 'none';
    }
  });

  const profileHost = document.querySelector('.header-right');
  if (profileHost && !document.getElementById('dashboard-profile-menu')) {
    const isAdminPage = window.location.pathname.startsWith('/admin');
    const dashboardHref = isAdminPage ? '/admin/dashboard' : '/dashboard';
    const profileLabel = user.name || (isAdminPage ? 'Admin' : 'User');
    const existingName = document.getElementById(isAdminPage ? 'admin-name' : 'user-name');
    if (existingName) {
      existingName.textContent = profileLabel;
    }

    const menuWrapper = document.createElement('div');
    const initial = profileLabel.charAt(0).toUpperCase();
    menuWrapper.innerHTML = `
      <div class="profile-menu" id="dashboard-profile-menu">
        <button id="dashboard-profile-toggle" class="profile-toggle" type="button">
          <div class="profile-avatar">${initial}</div>
          <span>${profileLabel}</span>
          <span class="profile-toggle-icon">▼</span>
        </button>
        <div id="dashboard-profile-dropdown" class="profile-dropdown">
          <a href="${dashboardHref}" class="profile-dropdown-link">Dashboard</a>
          <a href="#" id="dashboard-profile-logout" class="profile-dropdown-link">Logout</a>
        </div>
      </div>
    `;
    profileHost.appendChild(menuWrapper.firstElementChild);

    const toggle = document.getElementById('dashboard-profile-toggle');
    const dropdown = document.getElementById('dashboard-profile-dropdown');
    const logout = document.getElementById('dashboard-profile-logout');
    const host = document.getElementById('dashboard-profile-menu');

    if (!toggle || !dropdown || !logout || !host) {
      return;
    }

    toggle.addEventListener('click', (event) => {
      event.stopPropagation();
      dropdown.classList.toggle('open');
    });

    logout.addEventListener('click', (event) => {
      event.preventDefault();
      window.API.logout();
    });

    document.addEventListener('click', (event) => {
      if (!host.contains(event.target)) {
        dropdown.classList.remove('open');
      }
    });
  }
});
