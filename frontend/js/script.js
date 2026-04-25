// script.js - General Public Pages Logic

const updateCartBadge = (count) => {
  const badge = document.getElementById('cart-badge');
  if (!badge) return;

  badge.textContent = count;
  if (count > 0) {
    badge.classList.add('visible');
  } else {
    badge.classList.remove('visible');
  }
};

const syncCart = async () => {
  try {
    const res = await window.API.getCart();
    if (res.success && res.data) {
      const count = res.data.items.reduce((sum, item) => sum + item.quantity, 0);
      updateCartBadge(count);
    }
  } catch (error) {
    console.error('Failed to sync cart:', error);
  }
};

// Auto sync on load
syncCart();

// Export for other scripts
window.syncCart = syncCart;

document.addEventListener('DOMContentLoaded', () => {
  // Mobile Menu Toggle
  const menuToggle = document.querySelector('.menu-toggle');
  const navLinks = document.querySelector('.nav-links');

  if (menuToggle && navLinks) {
    menuToggle.addEventListener('click', () => {
      navLinks.classList.toggle('active');
    });
  }

  const setupProfileDropdown = () => {
    const linksContainer = document.querySelector('.nav-links');
    if (!linksContainer) {
      return;
    }

    const token = localStorage.getItem('token');
    const user = JSON.parse(localStorage.getItem('user') || 'null');
    if (!token || !user) {
      return;
    }

    const loginLink = linksContainer.querySelector('a[href="login.html"]');
    if (loginLink) {
      const loginLi = loginLink.closest('li');
      if (loginLi) {
        loginLi.remove();
      }
    }

    const existingMenu = document.getElementById('profile-menu-item');
    if (existingMenu) {
      return;
    }

    const dashboardHref = user.role === 'admin' ? '/admin/dashboard' : '/dashboard';
    const profileLabel = user.name || (user.role === 'admin' ? 'Admin' : 'User');
    const initial = profileLabel.charAt(0).toUpperCase();
    const li = document.createElement('li');
    li.id = 'profile-menu-item';
    li.className = 'profile-menu';
    li.innerHTML = `
      <button id="profile-menu-toggle" class="profile-toggle" type="button">
        <div class="profile-avatar">${initial}</div>
        <span>${profileLabel}</span>
        <span class="profile-toggle-icon">▼</span>
      </button>
      <div id="profile-dropdown" class="profile-dropdown">
        <a href="${dashboardHref}" class="profile-dropdown-link">Dashboard</a>
        <a href="#" id="profile-logout" class="profile-dropdown-link">Logout</a>
      </div>
    `;
    linksContainer.appendChild(li);

    const toggle = document.getElementById('profile-menu-toggle');
    const dropdown = document.getElementById('profile-dropdown');
    const logoutBtn = document.getElementById('profile-logout');

    if (toggle && dropdown) {
      toggle.addEventListener('click', (event) => {
        event.stopPropagation();
        dropdown.classList.toggle('open');
      });
    }

    if (logoutBtn) {
      logoutBtn.addEventListener('click', (event) => {
        event.preventDefault();
        window.API.logout();
      });
    }

    document.addEventListener('click', (event) => {
      if (!li.contains(event.target)) {
        dropdown.classList.remove('open');
      }
    });
  };

  setupProfileDropdown();

  const estimateNavLink = document.getElementById('nav-estimate-link');
  const estimateSection = document.getElementById('estimate-section');
  if (estimateNavLink && estimateSection) {
    estimateNavLink.addEventListener('click', (event) => {
      event.preventDefault();
      estimateSection.scrollIntoView({ behavior: 'smooth' });
    });
  }

  // Set active link in Navbar
  const currentPath = window.location.pathname.split('/').pop();
  const links = document.querySelectorAll('.nav-links a');
  
  links.forEach(link => {
    const linkPath = link.getAttribute('href');
    if (linkPath === currentPath || (currentPath === '' && linkPath === 'index.html')) {
      link.style.color = 'var(--primary-color)';
    }
  });

  // Scrollspy for active link highlighting
  const sections = document.querySelectorAll('section');
  const navItems = document.querySelectorAll('.nav-links a');

  window.addEventListener('scroll', () => {
    let current = '';
    sections.forEach(section => {
      const sectionTop = section.offsetTop;
      const sectionHeight = section.clientHeight;
      if (pageYOffset >= sectionTop - 150) {
        current = section.getAttribute('id');
      }
    });

    navItems.forEach(li => {
      li.style.color = 'var(--secondary-color)';
      if (li.getAttribute('href').includes(current) && current !== null && current !== '') {
        li.style.color = 'var(--primary-color)';
      }
    });
  });

  const estimateForm = document.getElementById('estimate-form');
  if (estimateForm) {
    const surfaceSelect = document.getElementById('est-surface');
    const areaInput = document.getElementById('est-area');
    const areaError = document.getElementById('est-area-error');
    const estimateSurfaceValue = document.getElementById('estimate-surface-value');
    const estimateAreaValue = document.getElementById('estimate-area-value');
    const estimatePriceValue = document.getElementById('estimate-price-value');
    const estimateCostValue = document.getElementById('estimate-cost-value');
    const estimateMessage = document.getElementById('estimate-msg');
    const estimateCta = document.getElementById('estimate-cta');

    const surfacePricing = {
      'Roof Waterproofing': 35,
      'Terrace Waterproofing': 40,
      'Bathroom Waterproofing': 55,
      'Basement Waterproofing': 60,
      'Wall Crack Repair': 30,
      'Water Tank Waterproofing': 50
    };

    const setEstimateMessage = (message) => {
      if (!estimateMessage) return;
      estimateMessage.textContent = message;
      estimateMessage.style.display = message ? 'block' : 'none';
    };

    const updateEstimate = () => {
      const surfaceType = surfaceSelect.value;
      const area = Number(areaInput.value);
      const pricePerSqft = surfacePricing[surfaceType] || 0;
      const validArea = Number.isFinite(area) && area > 0;

      areaInput.setCustomValidity(validArea ? '' : 'Please enter a valid area in sq.ft');
      if (areaError) {
        areaError.textContent = validArea || !areaInput.value ? '' : 'Please enter a valid area in sq.ft';
      }

      estimateSurfaceValue.textContent = surfaceType || '-';
      estimateAreaValue.textContent = validArea ? `${area.toFixed(2)} sq.ft` : '0 sq.ft';
      estimatePriceValue.textContent = `₹${pricePerSqft.toFixed(0)}`;

      const estimatedCost = validArea ? area * pricePerSqft : 0;
      estimateCostValue.textContent = `₹${estimatedCost.toFixed(2)}`;

      return { surfaceType, area: validArea ? area : 0, pricePerSqft, estimatedCost };
    };

    surfaceSelect.addEventListener('change', updateEstimate);
    areaInput.addEventListener('input', updateEstimate);
    areaInput.addEventListener('blur', () => {
      if (!areaInput.value || Number(areaInput.value) <= 0) {
        areaInput.setCustomValidity('Please enter a valid area in sq.ft');
        if (areaError) {
          areaError.textContent = 'Please enter a valid area in sq.ft';
        }
      }
    });

    estimateForm.addEventListener('submit', (e) => {
      e.preventDefault();
      updateEstimate();
      setEstimateMessage('This is an approximate calculator only. Final quotation will be provided after site inspection.');
    });

    if (estimateCta) {
      estimateCta.addEventListener('click', () => {
        const state = updateEstimate();
        if (!state.surfaceType || !state.area) {
          areaInput.reportValidity();
          return;
        }

        window.location.href = '/service-booking';
      });
    }

    updateEstimate();
  }

  // Handle Contact Form Submission
  const contactForm = document.getElementById('contact-form');
  if (contactForm) {
    contactForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const msgBox = document.getElementById('contact-msg');
      
      // Simulate API Call
      const btn = contactForm.querySelector('button[type="submit"]');
      const originalText = btn.textContent;
      btn.textContent = 'Sending...';
      btn.disabled = true;

      setTimeout(() => {
        msgBox.style.display = 'block';
        msgBox.style.backgroundColor = '#d1fae5';
        msgBox.style.color = '#065f46';
        msgBox.style.border = '1px solid #34d399';
        msgBox.textContent = 'Message sent successfully! Thank you for reaching out.';
        
        contactForm.reset();
        btn.textContent = originalText;
        btn.disabled = false;

        setTimeout(() => { msgBox.style.display = 'none'; }, 5000);
      }, 800);
    });
  }
});
