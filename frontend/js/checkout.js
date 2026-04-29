document.addEventListener('DOMContentLoaded', async () => {
  const user = window.API.requireAuth();
  if (!user) {
    return;
  }

  const itemsContainer = document.getElementById('checkout-items');
  const subtotalEl = document.getElementById('checkout-subtotal');
  const totalEl = document.getElementById('checkout-total');
  const messageEl = document.getElementById('checkout-msg');
  const submitButton = document.getElementById('checkout-submit');

  let currentCart = null;

  const setMessage = (message, type = 'info') => {
    if (!messageEl) {
      return;
    }

    messageEl.textContent = message;
    messageEl.style.color = type === 'error' ? '#b42318' : type === 'success' ? '#067647' : '#1d4ed8';
  };

  const setSubmitting = (isSubmitting) => {
    if (!submitButton) {
      return;
    }

    submitButton.disabled = isSubmitting;
    submitButton.textContent = isSubmitting ? 'Preparing payment...' : 'Pay with Razorpay';
  };

  const loadRazorpaySdk = () => new Promise((resolve, reject) => {
    if (window.Razorpay) {
      resolve(window.Razorpay);
      return;
    }

    const existingScript = document.querySelector('script[src="https://checkout.razorpay.com/v1/checkout.js"]');
    if (existingScript) {
      existingScript.addEventListener('load', () => resolve(window.Razorpay));
      existingScript.addEventListener('error', () => reject(new Error('Unable to load Razorpay checkout script')));
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => resolve(window.Razorpay);
    script.onerror = () => reject(new Error('Unable to load Razorpay checkout script'));
    document.head.appendChild(script);
  });

  const renderCart = (items) => {
    let total = 0;
    itemsContainer.innerHTML = '';

    if (!items.length) {
      EmptyState.showCart(itemsContainer);
      subtotalEl.textContent = '₹0';
      totalEl.textContent = '₹0';
      return;
    }

    items.forEach((item) => {
      const line = Number(item.price || 0) * Number(item.quantity || 0);
      total += line;
      const row = document.createElement('div');
      row.style.cssText = 'display:flex; justify-content:space-between; margin-bottom: 0.6rem;';
      row.innerHTML = `<span>${item.product.productName} x ${item.quantity}</span><strong>₹${line.toFixed(2)}</strong>`;
      itemsContainer.appendChild(row);
    });

    subtotalEl.textContent = `₹${total.toFixed(2)}`;
    totalEl.textContent = `₹${total.toFixed(2)}`;
  };

  const loadCart = async () => {
    try {
      const cartRes = await window.API.getCart();
      currentCart = cartRes.data;
      renderCart(currentCart.items || []);
      return currentCart;
    } catch (error) {
      Toast.error('Failed to load cart');
      throw error;
    }
  };

  try {
    const profileRes = await window.API.getMyProfile();
    const profile = profileRes.data || {};
    document.getElementById('c-fullName').value = profile.name || '';
    document.getElementById('c-address').value = profile.address || '';
    document.getElementById('c-phone').value = profile.phone || '';
    document.getElementById('c-city').value = profile.city || '';
    document.getElementById('c-pincode').value = profile.pincode || '';

    await loadCart();
  } catch (error) {
    setMessage('Failed to load checkout details', 'error');
    Toast.error('Failed to load checkout details');
  }

  document.getElementById('checkout-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    const serviceRequired = document.getElementById('c-service-required').checked;
    const shippingDetails = {
      fullName: document.getElementById('c-fullName').value,
      address: document.getElementById('c-address').value,
      phone: document.getElementById('c-phone').value,
      city: document.getElementById('c-city').value,
      pincode: document.getElementById('c-pincode').value
    };

    const serviceRequest = {
      required: serviceRequired,
      projectType: document.getElementById('c-project-type').value,
      workType: document.getElementById('c-work-type').value || 'General Work',
      expectedEndDate: document.getElementById('c-service-end').value || null
    };

    try {
      setSubmitting(true);
      setMessage('Processing your order...', 'info');

      const orderRes = await window.API.createPaymentOrder({ shippingDetails, serviceRequest });
      
      if (orderRes.success) {
        setMessage('Order placed successfully! Redirecting...', 'success');
        Toast.success('Order placed successfully');
        
        setTimeout(() => {
          window.location.href = '/orders';
        }, 1500);
      } else {
        throw new Error(orderRes.message || 'Failed to place order');
      }
    } catch (error) {
      setSubmitting(false);
      setMessage(error.message || 'Failed to place order', 'error');
      Toast.error(error.message || 'Failed to place order');
    }
  });
});