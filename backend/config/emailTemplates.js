// Email Templates for Karankar Chemicals

const getBaseTemplate = (content, subject) => {
    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${subject}</title>
        <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #2c3e50; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
            .content { background-color: #ecf0f1; padding: 30px; border: 1px solid #bdc3c7; }
            .footer { background-color: #34495e; color: white; padding: 20px; text-align: center; border-radius: 0 0 5px 5px; font-size: 12px; }
            .button { background-color: #3498db; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; margin: 15px 0; }
            .button:hover { background-color: #2980b9; }
            .info-box { background-color: #fff; padding: 15px; margin: 15px 0; border-left: 4px solid #3498db; }
            .order-details { width: 100%; border-collapse: collapse; margin: 15px 0; }
            .order-details th { background-color: #34495e; color: white; padding: 10px; text-align: left; }
            .order-details td { padding: 10px; border-bottom: 1px solid #bdc3c7; }
            .order-details tr:nth-child(even) { background-color: #f9f9f9; }
            .total-row { font-weight: bold; background-color: #ecf0f1; }
            .success { color: #27ae60; }
            .error { color: #e74c3c; }
            .company-info { text-align: center; font-size: 12px; color: #7f8c8d; margin-top: 20px; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>Karankar Chemicals</h1>
                <p>Premium Waterproofing & Chemical Solutions</p>
            </div>
            <div class="content">
                ${content}
            </div>
            <div class="footer">
                <p>&copy; 2026 Karankar Chemicals. All rights reserved.</p>
                <p>If you have any questions, please contact us at support@karankarchemicals.com</p>
                <p>This is an automated email. Please do not reply directly.</p>
            </div>
        </div>
    </body>
    </html>
    `;
};

// Registration Confirmation Email
const registrationEmail = (userName, userEmail) => {
    const content = `
        <h2>Welcome to Karankar Chemicals! <span class="success">✓</span></h2>
        <p>Hi ${userName},</p>
        <p>Thank you for registering with Karankar Chemicals. Your account has been successfully created!</p>
        
        <div class="info-box">
            <h3>Account Details:</h3>
            <p><strong>Email:</strong> ${userEmail}</p>
            <p><strong>Account Status:</strong> <span class="success">Active</span></p>
            <p><strong>Created:</strong> ${new Date().toLocaleDateString('en-IN')}</p>
        </div>
        
        <p>You can now:</p>
        <ul>
            <li>Browse our product catalog</li>
            <li>Place orders for products and services</li>
            <li>Track your orders in real-time</li>
            <li>Manage your profile and addresses</li>
            <li>View invoices and payment history</li>
        </ul>
        
        <a href="${process.env.FRONTEND_URL || 'http://localhost:5000'}/dashboard" class="button">Go to Dashboard</a>
        
        <div class="info-box">
            <p><strong>Need Help?</strong></p>
            <p>If you have any questions or need assistance, please don't hesitate to contact us at <strong>support@karankarchemicals.com</strong> or call us at <strong>+91-XXXX-XXXX-XX</strong></p>
        </div>
    `;
    return getBaseTemplate(content, 'Welcome to Karankar Chemicals');
};

// Order Confirmation Email
const orderConfirmationEmail = (userName, orderId, orderDate, items, totalAmount) => {
    const itemsHtml = items.map(item => `
        <tr>
            <td>${item.productName}</td>
            <td>${item.quantity}</td>
            <td>₹${item.unitPrice.toFixed(2)}</td>
            <td>₹${item.lineTotal.toFixed(2)}</td>
        </tr>
    `).join('');

    const content = `
        <h2>Order Confirmation <span class="success">✓</span></h2>
        <p>Hi ${userName},</p>
        <p>Thank you for placing an order with us! We've received your order and will start processing it soon.</p>
        
        <div class="info-box">
            <h3>Order Details:</h3>
            <p><strong>Order ID:</strong> ${orderId}</p>
            <p><strong>Order Date:</strong> ${new Date(orderDate).toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
            <p><strong>Status:</strong> <span class="success">Pending</span></p>
        </div>
        
        <h3>Items Ordered:</h3>
        <table class="order-details">
            <thead>
                <tr>
                    <th>Product Name</th>
                    <th>Quantity</th>
                    <th>Unit Price</th>
                    <th>Total</th>
                </tr>
            </thead>
            <tbody>
                ${itemsHtml}
                <tr class="total-row">
                    <td colspan="3">Total Amount</td>
                    <td>₹${totalAmount.toFixed(2)}</td>
                </tr>
            </tbody>
        </table>
        
        <a href="${process.env.FRONTEND_URL || 'http://localhost:5000'}/dashboard/orders" class="button">Track Order</a>
        
        <div class="info-box">
            <p><strong>Next Steps:</strong></p>
            <p>You will receive a payment confirmation email once you complete the payment. After payment verification, your order will move to processing and you'll be notified about shipping.</p>
        </div>
    `;
    return getBaseTemplate(content, 'Order Confirmation');
};

// Payment Confirmation Email
const paymentConfirmationEmail = (userName, orderId, amount, paymentId, transactionId) => {
    const content = `
        <h2>Payment Confirmation <span class="success">✓</span></h2>
        <p>Hi ${userName},</p>
        <p>Your payment has been successfully received and verified!</p>
        
        <div class="info-box" style="background-color: #d5f4e6; border-left-color: #27ae60;">
            <h3 style="color: #27ae60;">Payment Successful</h3>
            <p><strong>Order ID:</strong> ${orderId}</p>
            <p><strong>Payment ID:</strong> ${paymentId}</p>
            <p><strong>Transaction ID:</strong> ${transactionId}</p>
            <p><strong>Amount Paid:</strong> ₹${amount.toFixed(2)}</p>
            <p><strong>Date:</strong> ${new Date().toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
        </div>
        
        <div class="info-box">
            <p><strong>What Happens Next?</strong></p>
            <ul>
                <li>Your order will be processed immediately</li>
                <li>You will receive shipping details via email</li>
                <li>Track your order status anytime in your dashboard</li>
                <li>You can download your invoice at any time</li>
            </ul>
        </div>
        
        <a href="${process.env.FRONTEND_URL || 'http://localhost:5000'}/dashboard/orders" class="button">View Order Status</a>
        
        <div class="info-box">
            <p><strong>Thank You!</strong></p>
            <p>We appreciate your business and look forward to serving you. If you have any questions about your order, please don't hesitate to contact our support team.</p>
        </div>
    `;
    return getBaseTemplate(content, 'Payment Confirmed');
};

// Invoice Email
const invoiceEmail = (userName, orderId, invoiceId, amount, items, dueDate) => {
    const itemsHtml = items.map(item => `
        <tr>
            <td>${item.productName}</td>
            <td>${item.quantity}</td>
            <td>₹${item.unitPrice.toFixed(2)}</td>
            <td>₹${item.lineTotal.toFixed(2)}</td>
        </tr>
    `).join('');

    const content = `
        <h2>Invoice Generated <span class="success">✓</span></h2>
        <p>Hi ${userName},</p>
        <p>Your invoice for order ${orderId} has been generated and is attached to this email.</p>
        
        <div class="info-box">
            <h3>Invoice Details:</h3>
            <p><strong>Invoice Number:</strong> ${invoiceId}</p>
            <p><strong>Order ID:</strong> ${orderId}</p>
            <p><strong>Issue Date:</strong> ${new Date().toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
            <p><strong>Due Date:</strong> ${new Date(dueDate).toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
        </div>
        
        <h3>Items:</h3>
        <table class="order-details">
            <thead>
                <tr>
                    <th>Product Name</th>
                    <th>Quantity</th>
                    <th>Unit Price</th>
                    <th>Total</th>
                </tr>
            </thead>
            <tbody>
                ${itemsHtml}
                <tr class="total-row">
                    <td colspan="3">Invoice Amount</td>
                    <td>₹${amount.toFixed(2)}</td>
                </tr>
            </tbody>
        </table>
        
        <a href="${process.env.FRONTEND_URL || 'http://localhost:5000'}/dashboard/invoices" class="button">Download Invoice</a>
        
        <div class="info-box">
            <p><strong>Payment Required?</strong></p>
            <p>If your order is pending payment, please log in to your dashboard and complete the payment to processyour order.</p>
        </div>
    `;
    return getBaseTemplate(content, 'Invoice Generated');
};

// Service Booking Confirmation Email
const serviceBookingEmail = (userName, bookingId, serviceName, expectedDate, amount, location) => {
    const content = `
        <h2>Service Booking Confirmed <span class="success">✓</span></h2>
        <p>Hi ${userName},</p>
        <p>Your service booking has been successfully created! Our team will contact you soon to confirm the details.</p>
        
        <div class="info-box">
            <h3>Booking Details:</h3>
            <p><strong>Booking ID:</strong> ${bookingId}</p>
            <p><strong>Service:</strong> ${serviceName}</p>
            <p><strong>Expected Date:</strong> ${new Date(expectedDate).toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
            <p><strong>Location:</strong> ${location}</p>
            <p><strong>Amount:</strong> ₹${amount.toFixed(2)}</p>
            <p><strong>Status:</strong> <span class="success">Pending Confirmation</span></p>
        </div>
        
        <div class="info-box">
            <p><strong>What Happens Next?</strong></p>
            <ul>
                <li>Our team will review your booking request</li>
                <li>We'll call you at the provided phone number to confirm the date and time</li>
                <li>You'll receive a confirmation email once details are finalized</li>
                <li>Our technicians will arrive at your specified location</li>
            </ul>
        </div>
        
        <a href="${process.env.FRONTEND_URL || 'http://localhost:5000'}/dashboard/bookings" class="button">View Booking Details</a>
        
        <div class="info-box">
            <p><strong>Questions?</strong></p>
            <p>If you need to make changes or have any questions, please contact us immediately at <strong>support@karankarchemicals.com</strong></p>
        </div>
    `;
    return getBaseTemplate(content, 'Service Booking Confirmed');
};

// Admin Notification Email (New Order)
const adminOrderNotificationEmail = (orderId, customerName, customerEmail, amount, items) => {
    const itemsHtml = items.map(item => `
        <tr>
            <td>${item.productName}</td>
            <td>${item.quantity}</td>
            <td>₹${item.unitPrice.toFixed(2)}</td>
            <td>₹${item.lineTotal.toFixed(2)}</td>
        </tr>
    `).join('');

    const content = `
        <h2>New Order Received</h2>
        <p>A new order has been placed in your system.</p>
        
        <div class="info-box" style="background-color: #fff3cd; border-left-color: #ffc107;">
            <h3>Order Summary:</h3>
            <p><strong>Order ID:</strong> ${orderId}</p>
            <p><strong>Customer Name:</strong> ${customerName}</p>
            <p><strong>Customer Email:</strong> ${customerEmail}</p>
            <p><strong>Order Date:</strong> ${new Date().toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
            <p><strong>Total Amount:</strong> ₹${amount.toFixed(2)}</p>
        </div>
        
        <h3>Items Ordered:</h3>
        <table class="order-details">
            <thead>
                <tr>
                    <th>Product Name</th>
                    <th>Quantity</th>
                    <th>Unit Price</th>
                    <th>Total</th>
                </tr>
            </thead>
            <tbody>
                ${itemsHtml}
                <tr class="total-row">
                    <td colspan="3">Total</td>
                    <td>₹${amount.toFixed(2)}</td>
                </tr>
            </tbody>
        </table>
        
        <p>Please log in to your admin dashboard to process this order.</p>
    `;
    return getBaseTemplate(content, 'New Order Notification');
};

module.exports = {
    registrationEmail,
    orderConfirmationEmail,
    paymentConfirmationEmail,
    invoiceEmail,
    serviceBookingEmail,
    adminOrderNotificationEmail
};
