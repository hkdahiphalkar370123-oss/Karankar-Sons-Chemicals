document.addEventListener('DOMContentLoaded', async () => {
  const container = document.getElementById('product-detail-container');
  const params = new URLSearchParams(window.location.search);
  const productId = params.get('id');

  if (!productId) {
    container.innerHTML = '<p>Invalid product link.</p>';
    return;
  }

  const effectivePrice = (product) => {
    const discount = product.discountPercent || 0;
    return product.pricePerUnit * (1 - discount / 100);
  };

  const resolveImageUrl = (imageUrl) => {
    if (!imageUrl) return 'assets/img/chemical_coating.png';
    if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
      return 'assets/img/chemical_coating.png';
    }
    if (imageUrl.startsWith('/')) return imageUrl;
    return imageUrl;
  };

  try {
    const response = await window.API.getProductById(productId);
    const product = response.data;
    const price = effectivePrice(product);
    const imageUrl = resolveImageUrl(product.imageURL);

    container.innerHTML = `
      <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; align-items:start;">
        <img src="${imageUrl}" alt="${product.productName}" style="width:100%; border-radius:12px; height:360px; object-fit:cover;" />
        <div>
          <h2 style="margin-bottom: 0.5rem;">${product.productName}</h2>
          <div style="font-size: 0.9rem; color: #666; margin-bottom: 1rem;">Category: ${product.category}</div>
          <p style="margin-bottom: 1rem;">${product.description || 'No description available.'}</p>
          <div style="display:flex; gap:1rem; margin-bottom: 1rem;">
            <span><strong>Unit:</strong> ${product.quantityUnit}</span>
            <span style="color:${product.stockQuantity > 0 ? '#2e7d32' : '#d32f2f'};"><strong>Stock:</strong> ${product.stockQuantity}</span>
          </div>
          <div style="font-size:1.4rem; color:var(--primary-color); font-weight:700; margin-bottom: 1rem;">₹${price.toFixed(2)}</div>
          <div class="qty-selector" style="display:flex; align-items:center; gap:0.5rem; margin-bottom: 1rem;">
            <label for="detail-qty">Qty:</label>
            <input id="detail-qty" class="qty-input" type="number" min="1" max="${Math.max(1, product.stockQuantity)}" value="1" style="width:80px;" />
            <span>${product.quantityUnit}</span>
          </div>
          <div style="display:flex; gap:0.6rem;">
            <a class="btn btn-outline" href="products.html">Back to Products</a>
            <button
              class="btn btn-primary add-to-cart-btn"
              data-id="${product._id}"
              data-name="${(product.productName || '').replace(/\"/g, '&quot;')}"
              data-price="${price.toFixed(2)}"
              data-image="${imageUrl}"
              ${product.stockQuantity <= 0 ? 'disabled' : ''}
            >Add to Cart</button>
          </div>
        </div>
      </div>
    `;
  } catch (error) {
    container.innerHTML = `<p style="color:#c62828;">${error.message}</p>`;
  }
});
