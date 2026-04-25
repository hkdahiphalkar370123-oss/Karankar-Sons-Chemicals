// cart.js - Shopping Cart Logic

class ShoppingCart {
  constructor() {
    this.items = [];
    this.isAuthenticated = !!localStorage.getItem('token');
    this.init();
  }

  resolveImageUrl(imageUrl) {
    if (!imageUrl) return 'assets/img/chemical_coating.png';
    if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
      return 'assets/img/chemical_coating.png';
    }
    return imageUrl;
  }

  async init() {
    this.injectCartHTML();
    this.bindEvents();
    if (this.isAuthenticated) {
      await this.refreshCart();
    } else {
      this.items = JSON.parse(localStorage.getItem('cartItems') || '[]');
      this.updateCartUI();
    }
  }

  injectCartHTML() {
    const cartHTML = `
      <div id="cart-slide-panel" class="cart-panel">
        <div class="cart-header">
          <h2>Your Cart</h2>
          <button id="close-cart-btn" class="cart-close">&times;</button>
        </div>
        <div id="cart-items-container" class="cart-items">
          <!-- Items will be injected here -->
        </div>
        <div class="cart-footer">
          <div class="cart-total" style="display:flex; justify-content:space-between; margin-bottom:0.4rem;">
            <span>Subtotal:</span>
            <span id="cart-subtotal-price">₹0</span>
          </div>
          <div class="cart-total" style="display:flex; justify-content:space-between;">
            <span>Total:</span>
            <span id="cart-total-price">₹0</span>
          </div>
          <button id="checkout-btn" class="btn btn-primary btn-block">View Cart</button>
        </div>
      </div>
      <div id="cart-overlay" style="display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.5); z-index:1999;"></div>
    `;
    document.body.insertAdjacentHTML('beforeend', cartHTML);
  }

  bindEvents() {
    const cartIconBtn = document.getElementById('nav-cart-btn') || document.getElementById('cart-icon-btn');
    const closeBtn = document.getElementById('close-cart-btn');
    const overlay = document.getElementById('cart-overlay');
    const checkoutBtn = document.getElementById('checkout-btn');

    if(cartIconBtn) {
      cartIconBtn.addEventListener('click', (e) => {
        e.preventDefault();
        this.toggleCart();
      });
    }
    if(closeBtn) closeBtn.addEventListener('click', () => this.toggleCart());
    if(overlay) overlay.addEventListener('click', () => this.toggleCart());
    if(checkoutBtn) {
      checkoutBtn.addEventListener('click', () => {
        if (!this.isAuthenticated) {
          Toast.warning('Please login to view your cart.');
          setTimeout(() => {
            window.location.href = '/login';
          }, 1500);
          return;
        }
        window.location.href = '/cart';
      });
    }

    // Global listener for Add to Cart buttons
    document.addEventListener('click', async (e) => {
      if(e.target.closest('.add-to-cart-btn')) {
        const btn = e.target.closest('.add-to-cart-btn');
        const id = btn.dataset.id;
        const name = btn.dataset.name;
        const price = Number(btn.dataset.price || 0);
        const imageURL = btn.dataset.image;
        
        // Check if there is a quantity input associated
        const container = btn.closest('.card, .package-card, .product-card');
        let qty = 1;
        if(container) {
          const qtyInput = container.querySelector('.qty-input');
          if(qtyInput) {
            qty = parseInt(qtyInput.value) || 1;
          }
        }

        await this.addItem({ id, quantity: qty, name, price, imageURL });
        this.toggleCart(true); // Open cart auto
      }
    });
  }

  showFeedback(message) {
    Toast.success(message);
  }

  toggleCart(forceOpen = false) {
    const panel = document.getElementById('cart-slide-panel');
    const overlay = document.getElementById('cart-overlay');
    if(forceOpen) {
      panel.classList.add('open');
      overlay.style.display = 'block';
    } else {
      panel.classList.toggle('open');
      overlay.style.display = panel.classList.contains('open') ? 'block' : 'none';
    }
  }

  saveGuestCart() {
    localStorage.setItem('cartItems', JSON.stringify(this.items));
    this.updateCartUI();
  }

  async refreshCart() {
    if (!this.isAuthenticated) {
      return;
    }
    try {
      const response = await window.API.getCart();
      this.items = (response.data.items || []).map((item) => ({
        id: item.product._id,
        name: item.product.productName,
        imageURL: this.resolveImageUrl(item.product.imageURL),
        price: item.price,
        quantity: item.quantity
      }));
      this.updateCartUI();
    } catch (error) {
      Toast.error('Failed to sync cart');
    }
  }

  async addItem(item) {
    try {
      if (this.isAuthenticated) {
        await window.API.addToCart({ productId: item.id, quantity: item.quantity });
        await this.refreshCart();
        Toast.success('Added to cart');
      } else {
        if ((!item.name || !item.price) && item.id) {
          try {
            const response = await window.API.getProductById(item.id);
            const product = response.data;
            const discount = product.discountPercent || 0;
            item.name = product.productName;
            item.imageURL = this.resolveImageUrl(product.imageURL);
            item.price = Number(product.pricePerUnit) * (1 - discount / 100);
          } catch (error) {
            item.name = item.name || 'Product';
            item.price = Number(item.price || 0);
          }
        }

        const existing = this.items.find((i) => i.id === item.id);
        if (existing) {
          existing.quantity += item.quantity;
        } else {
          this.items.push({
            id: item.id,
            name: item.name || 'Product',
            imageURL: this.resolveImageUrl(item.imageURL),
            price: Number(item.price || 0),
            quantity: item.quantity
          });
        }
        this.saveGuestCart();
        Toast.success('Added to cart');
      }
    } catch (error) {
      Toast.error('Failed to add item to cart');
    }
  }

  async removeItem(id) {
    try {
      if (this.isAuthenticated) {
        await window.API.removeCartItem(id);
        await this.refreshCart();
      } else {
        this.items = this.items.filter((i) => i.id !== id);
        this.saveGuestCart();
      }
      Toast.success('Item removed from cart');
    } catch (error) {
      Toast.error('Failed to remove item from cart');
    }
  }

  async updateQuantity(id, change) {
    try {
      const item = this.items.find(i => i.id === id);
      if(item) {
        const nextQuantity = item.quantity + change;
        if(nextQuantity <= 0) {
          await this.removeItem(id);
        } else {
          if (this.isAuthenticated) {
            await window.API.updateCart({ productId: id, quantity: nextQuantity });
            await this.refreshCart();
          } else {
            item.quantity = nextQuantity;
            this.saveGuestCart();
          }
        }
      }
    } catch (error) {
      Toast.error('Failed to update quantity');
    }
  }

  updateCartUI() {
    const container = document.getElementById('cart-items-container');
    const subtotalEl = document.getElementById('cart-subtotal-price');
    const totalEl = document.getElementById('cart-total-price');
    const badge = document.getElementById('cart-badge');

    if(!container) return;

    container.innerHTML = '';
    let total = 0;
    let totalItems = 0;

    if(this.items.length === 0) {
      container.innerHTML = '<p class="text-center text-muted" style="margin-top:2rem;">Your cart is empty.</p>';
    } else {
      this.items.forEach(item => {
        total += item.price * item.quantity;
        totalItems += item.quantity;

        const itemEl = document.createElement('div');
        itemEl.className = 'cart-item';
        const imageUrl = this.resolveImageUrl(item.imageURL);
        itemEl.innerHTML = `
          <div class="cart-item-info" style="display:flex; gap:0.85rem; align-items:flex-start;">
            <img src="${imageUrl}" alt="${item.name}" style="width:64px; height:64px; object-fit:cover; border-radius:10px; border:1px solid var(--border-color); flex-shrink:0;">
            <div style="flex:1;">
              <div class="cart-item-title">${item.name}</div>
              <div class="cart-item-price">₹${Number(item.price).toFixed(2)} x ${item.quantity} = <strong>₹${(item.price * item.quantity).toFixed(2)}</strong></div>
              <div class="cart-item-qty">
                <button class="qty-btn dec" data-id="${item.id}" type="button">-</button>
                <span>${item.quantity}</span>
                <button class="qty-btn inc" data-id="${item.id}" type="button">+</button>
              </div>
            </div>
          </div>
          <button class="cart-item-remove" data-id="${item.id}" type="button">Remove</button>
        `;
        container.appendChild(itemEl);
      });
    }

    if (subtotalEl) {
      subtotalEl.textContent = '₹' + total.toFixed(2);
    }
    totalEl.textContent = '₹' + total.toFixed(2);
    
    if(badge) {
      badge.textContent = totalItems;
      badge.classList.toggle('visible', totalItems > 0);
    }

    container.onclick = async (event) => {
      const incBtn = event.target.closest('.inc');
      const decBtn = event.target.closest('.dec');
      const removeBtn = event.target.closest('.cart-item-remove');

      if (incBtn) {
        await this.updateQuantity(incBtn.dataset.id, 1);
      } else if (decBtn) {
        await this.updateQuantity(decBtn.dataset.id, -1);
      } else if (removeBtn) {
        await this.removeItem(removeBtn.dataset.id);
      }
    };
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.cart = new ShoppingCart();
});
