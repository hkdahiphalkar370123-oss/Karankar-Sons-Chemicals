document.addEventListener('DOMContentLoaded', async () => {
  const grid = document.getElementById('products-grid');
  const searchInput = document.getElementById('product-search');
  const clearSearchBtn = document.getElementById('product-search-clear');
  const filterInput = document.getElementById('product-filter');

  let allProducts = [];
  let currentPage = 1;
  let totalPages = 1;
  let currentCategory = '';
  let currentSearchTerm = '';
  let searchTimer = null;

  const effectivePrice = (product) => {
    const discount = product.discountPercent || 0;
    return product.pricePerUnit * (1 - discount / 100);
  };

  const resolveImageUrl = (imageUrl) => {
    if (!imageUrl) return 'assets/img/chemical_coating.png';
    // If it's a full URL (like Unsplash), use it directly
    if (imageUrl.startsWith('http')) {
      return imageUrl;
    }
    // If it's a relative path starting with /, use as is
    if (imageUrl.startsWith('/')) return imageUrl;
    // Default fallback
    return imageUrl;
  };

  const renderProducts = () => {
    if (!grid) {
      return;
    }

    grid.innerHTML = '';
    if (allProducts.length === 0) {
      EmptyState.showProduct(grid);
      return;
    }

    allProducts.forEach((p) => {
      const price = effectivePrice(p);
      const imageUrl = resolveImageUrl(p.imageURL);
      const card = document.createElement('div');
      card.className = 'card product-card';
      card.style.display = 'flex';
      card.style.flexDirection = 'column';
      card.innerHTML = `
        <div style="height: 180px; background: url('${imageUrl}') center/cover;"></div>
        <div style="padding: 1.25rem; flex-grow: 1; display: flex; flex-direction: column;">
          <span style="font-size: 0.75rem; color: var(--primary-color); font-weight: bold; margin-bottom: 0.5rem; text-transform: uppercase;">${p.category}</span>
          <h3 style="font-size: 1.1rem; margin-bottom: 0.5rem;">${p.productName}</h3>
          <p style="color: #666; font-size: 0.9rem; flex-grow: 1;">${p.description || ''}</p>
          <div style="margin-top: 1rem; border-top: 1px solid var(--border-color); padding-top: 1rem;">
            <div style="font-size: 0.9rem; color: #555; margin-bottom: 0.5rem;">Price: ₹${price.toFixed(2)} / ${p.quantityUnit}</div>
            <div style="font-size:0.85rem; color:${p.stockQuantity > 0 ? '#2e7d32' : '#d32f2f'}; margin-bottom: 0.5rem;">${p.stockQuantity > 0 ? `Stock: ${p.stockQuantity}` : 'Out of stock'}</div>
            <div class="qty-selector">
              <label style="font-size: 0.9rem;">Qty:</label>
              <input type="number" value="1" min="1" max="${Math.max(1, p.stockQuantity)}" class="qty-input" data-price="${price}">
              <span style="font-size: 0.9rem;">${p.quantityUnit}</span>
            </div>
            <div class="total-price">Total: ₹${price.toFixed(2)}</div>
            <div style="display:flex; gap: 0.5rem;">
              <button class="btn btn-outline product-detail-btn" style="width: 100%;" data-id="${p._id}">Details</button>
              <button
                class="btn btn-primary add-to-cart-btn"
                style="width: 100%;"
                data-id="${p._id}"
                data-name="${(p.productName || '').replace(/\"/g, '&quot;')}"
                data-price="${price.toFixed(2)}"
                data-image="${imageUrl}"
                ${p.stockQuantity <= 0 ? 'disabled' : ''}
              >Add to Cart</button>
            </div>
          </div>
        </div>
      `;
      grid.appendChild(card);
    });

    document.querySelectorAll('.qty-input').forEach((input) => {
      input.addEventListener('input', (e) => {
        const qty = Math.max(1, parseInt(e.target.value, 10) || 1);
        const price = parseFloat(e.target.getAttribute('data-price'));
        const totalNode = e.target.closest('.qty-selector').nextElementSibling;
        totalNode.textContent = `Total: ₹${(qty * price).toFixed(2)}`;
      });
    });

    document.querySelectorAll('.product-detail-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        window.location.href = `product-detail.html?id=${btn.dataset.id}`;
      });
    });

    // Render pagination after products
    renderPagination();
  };

  const updateClearButton = () => {
    if (!clearSearchBtn) {
      return;
    }

    clearSearchBtn.classList.toggle('visible', Boolean(currentSearchTerm));
  };

  const debounceSearch = () => {
    if (searchTimer) {
      clearTimeout(searchTimer);
    }

    searchTimer = setTimeout(() => {
      currentPage = 1;
      loadProducts();
    }, 300);
  };

  const renderPagination = () => {
    let paginationContainer = document.getElementById('products-pagination');
    if (!paginationContainer) {
      // Create pagination container if it doesn't exist
      const container = grid.parentElement;
      paginationContainer = document.createElement('div');
      paginationContainer.id = 'products-pagination';
      container.appendChild(paginationContainer);
    }

    if (totalPages > 1) {
      const pagination = new Pagination('products-pagination', currentPage, totalPages, (page) => {
        currentPage = page;
        window.scrollTo({ top: 0, behavior: 'smooth' });
        loadProducts();
      });
      pagination.render();
    } else {
      paginationContainer.innerHTML = '';
    }
  };

  const loadProducts = async () => {
    const params = new URLSearchParams();
    currentCategory = filterInput ? filterInput.value : '';
    currentSearchTerm = searchInput ? searchInput.value.trim() : '';

    if (currentCategory) {
      params.set('category', currentCategory);
    }
    if (currentSearchTerm) {
      params.set('q', currentSearchTerm);
    }

    // Add pagination parameters
    params.set('page', currentPage);
    params.set('limit', 10); // 10 products per page

    try {
      // Show skeleton loaders
      if (grid) {
        SkeletonLoader.show(grid, 6, 'product');
      }

      const statusEl = document.getElementById('connection-status');
      const response = await window.API.getProducts(params.toString());
      
      if (statusEl) {
        statusEl.style.background = '#e8f5e9';
        statusEl.style.color = '#2e7d32';
        statusEl.innerHTML = `🟢 Connected to: ${new URL(window.API_BASE_URL || 'https://karankar-backend.onrender.com/api').hostname}`;
      }

      allProducts = response.data || [];
      
      // Extract pagination metadata if available
      if (response.pagination) {
        totalPages = response.pagination.totalPages || 1;
        currentPage = response.pagination.currentPage || 1;
      } else {
        // Fallback for legacy responses without pagination
        totalPages = 1;
        currentPage = 1;
      }
      
      renderProducts();
    } catch (error) {
      const statusEl = document.getElementById('connection-status');
      if (statusEl) {
        statusEl.style.background = '#ffebee';
        statusEl.style.color = '#c62828';
        statusEl.innerHTML = `🔴 Connection Failed: ${error.message}`;
      }
      if (grid) {
        EmptyState.showError(grid, `Connection Error: ${error.message}. <br><br><b>Check if your Render URL in js/api.js is correct and FRONTEND_URL is set on Render.</b>`);
      }
    }
  };

  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      currentSearchTerm = e.target.value.trim();
      updateClearButton();
      debounceSearch();
    });
  }

  if (clearSearchBtn) {
    clearSearchBtn.addEventListener('click', () => {
      if (!searchInput) {
        return;
      }

      searchInput.value = '';
      currentSearchTerm = '';
      updateClearButton();
      currentPage = 1;
      loadProducts();
      searchInput.focus();
    });
  }

  if (filterInput) {
    filterInput.addEventListener('change', () => {
      currentPage = 1; // Reset to first page on filter change
      loadProducts();
    });
  }

  updateClearButton();

  await loadProducts();
});
