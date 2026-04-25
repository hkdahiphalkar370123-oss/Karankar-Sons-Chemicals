document.addEventListener('DOMContentLoaded', async () => {
  const user = window.API.requireAuth();
  if (!user) {
    return;
  }

  const container = document.getElementById('order-detail-container');
  const params = new URLSearchParams(window.location.search);
  const orderId = params.get('id');

  if (!orderId) {
    container.innerHTML = '<p>Order id is missing.</p>';
    return;
  }

  try {
    const response = await window.API.getOrderById(orderId);
    const order = response.data;
    const backHref = user.role === 'admin' ? '/admin/orders' : '/orders';
    const backLabel = user.role === 'admin' ? 'Back to Orders (Admin)' : 'Back to Orders';
    const rows = order.items.map((item) => `
      <tr>
        <td>${item.productName}</td>
        <td>${item.quantity}</td>
        <td>₹${item.unitPrice.toFixed(2)}</td>
        <td>₹${item.lineTotal.toFixed(2)}</td>
      </tr>
    `).join('');

    container.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:start; gap:1rem; margin-bottom:1.5rem;">
        <div>
          <h2 style="margin-bottom:0.3rem;">Order ${order.orderId}</h2>
          <div style="color:#666;">Placed on ${new Date(order.createdAt).toLocaleString()}</div>
          <div style="margin-top:0.5rem;"><strong>Status:</strong> ${order.status}</div>
        </div>
        <a class="btn btn-outline" href="${backHref}">${backLabel}</a>
      </div>

      <div style="margin-bottom: 1rem;">
        <h4 style="margin-bottom: 0.4rem;">Shipping Address</h4>
        <div>${order.shippingDetails.fullName}</div>
        <div>${order.shippingDetails.address}, ${order.shippingDetails.city} - ${order.shippingDetails.pincode}</div>
        <div>Phone: ${order.shippingDetails.phone}</div>
      </div>

      <div class="table-container">
        <table>
          <thead>
            <tr>
              <th>Product</th>
              <th>Quantity</th>
              <th>Unit Price</th>
              <th>Line Total</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>

      <div style="display:flex; justify-content:flex-end; margin-top: 1rem; font-size:1.2rem; font-weight:700;">
        Total Amount: ₹${order.totalAmount.toFixed(2)}
      </div>
    `;
  } catch (error) {
    container.innerHTML = `<p style="color:#c62828;">${error.message}</p>`;
  }
});
