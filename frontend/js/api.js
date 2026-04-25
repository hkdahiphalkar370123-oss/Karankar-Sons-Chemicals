const API_BASE_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:5000/api'
    : 'https://karankar-backend.onrender.com/api'; // Replace with your ACTUAL Render URL if different

const SOCKET_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:5000'
    : 'https://karankar-backend.onrender.com';

// Socket.io initialization
let socket;
const initSocket = () => {
    if (socket) return socket;
    
    // Check if io is defined (from script tag)
    if (typeof io !== 'undefined') {
        socket = io(SOCKET_URL);
        console.log('📡 Real-time connection initialized');
        
        const user = window.API.getCurrentUser();
        if (user && user.companyId) {
            socket.emit('join', `company_${user.companyId}`);
        }
        
        return socket;
    }
    return null;
};

// Utility to get auth token
const getToken = () => localStorage.getItem('token');

// Common Headers
const getHeaders = (isFormData = false) => {
    const headers = {};
    if (!isFormData) {
        headers['Content-Type'] = 'application/json';
    }
    const token = getToken();
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
};

// Generic Fetch Wrapper with Error Handling and Loading Indicators
const apiFetch = async (endpoint, method = 'GET', body = null, options = {}) => {
    const { 
        showLoading = true, 
        showError = true,
        showSuccess = false,
        successMessage = '',
        timeout = 30000 
    } = options;

    const isFormData = body instanceof FormData;
    const apiOptions = {
        method,
        headers: getHeaders(isFormData)
    };

    if (body) {
        apiOptions.body = isFormData ? body : JSON.stringify(body);
    }

    // Show loading indicator
    let loadingOverlay = null;
    if (showLoading) {
        LoadingIndicator.show();
    }

    try {
        // Set timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        apiOptions.signal = controller.signal;

        const response = await fetch(`${API_BASE_URL}${endpoint}`, apiOptions);
        clearTimeout(timeoutId);

        // Check content type before parsing as JSON
        const contentType = response.headers.get('content-type');
        let data;
        if (contentType && contentType.includes('application/json')) {
            data = await response.json();
        } else {
            const text = await response.text();
            console.error(`⚠️ API returned non-JSON response from ${endpoint}:`, text.slice(0, 200));
            throw new Error('Server returned an unexpected response format. Please check backend logs.');
        }

        // Hide loading
        if (showLoading) {
            LoadingIndicator.hide();
        }

        if (!response.ok) {
            const errorMessage = data.error || data.message || 'API request failed';
            
            console.error(`❌ API Error (${response.status}) at ${endpoint}:`, data);

            // Handle authentication errors
            if (response.status === 401) {
                clearAuthState();
                window.location.href = '/login';
                throw new Error('Session expired. Please login again.');
            }

            if (showError) {
                Toast.error(errorMessage);
            }

            const error = new Error(errorMessage);
            error.statusCode = response.status;
            error.response = data;
            throw error;
        }

        // Show success message if provided
        if (showSuccess && successMessage) {
            Toast.success(successMessage);
        }

        return data;
    } catch (err) {
        // Hide loading on error
        if (showLoading) {
            LoadingIndicator.hide();
        }

        // Handle specific error types
        if (err.name === 'AbortError') {
            const timeoutError = new Error('Request timeout. Please try again.');
            if (showError) {
                Toast.error('Request took too long. Please try again.');
            }
            throw timeoutError;
        }

        // Log error for debugging
        console.error('🌐 Network/API Error:', {
            url: `${API_BASE_URL}${endpoint}`,
            method,
            message: err.message,
            timestamp: new Date().toISOString()
        });

        throw err;
    }
};

const getCurrentUser = () => {
    try {
        return JSON.parse(localStorage.getItem('user') || 'null');
    } catch (error) {
        return null;
    }
};

const clearAuthState = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('cartItems');
    sessionStorage.clear();

    document.cookie.split(';').forEach((cookie) => {
        const eqPos = cookie.indexOf('=');
        const name = (eqPos > -1 ? cookie.slice(0, eqPos) : cookie).trim();
        if (name) {
            document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
        }
    });
};

const setAuthCookies = (token, role) => {
    const expiry = new Date();
    expiry.setDate(expiry.getDate() + 7);
    document.cookie = `token=${token}; expires=${expiry.toUTCString()}; path=/`;
    document.cookie = `user_role=${role}; expires=${expiry.toUTCString()}; path=/`;
};

const redirectToPublicHome = () => {
    window.location.href = '/';
};

const requireAuth = (role = null) => {
    const token = getToken();
    const user = getCurrentUser();
    if (!token || !user) {
        window.location.href = '/login.html';
        return null;
    }
    if (role && user.role !== role) {
        window.location.href = user.role === 'admin' ? '/admin/dashboard' : '/dashboard';
        return null;
    }
    return user;
};

// Expose API object
window.API = {
    login: async (email, password) => {
        const res = await apiFetch('/auth/login', 'POST', { email, password });
        if (res.success && res.data) {
            setAuthCookies(res.data.token, res.data.role);
        }
        return res;
    },
    register: async (payload) => {
        const res = await apiFetch('/auth/register', 'POST', payload);
        if (res.success && res.data) {
            setAuthCookies(res.data.token, res.data.role);
        }
        return res;
    },
    getMe: () => apiFetch('/auth/me', 'GET'),
    getCurrentUser,
    requireAuth,
    
    // Services
    getSites: (params = '') => apiFetch(`/sites${params ? `?${params}` : ''}`, 'GET'),
    getMySiteProgress: (params = '') => apiFetch(`/sites/progress/my${params ? `?${params}` : ''}`, 'GET'),
    createSite: (payload) => apiFetch('/sites', 'POST', payload),
    getSiteById: (id) => apiFetch(`/sites/${id}`, 'GET'),
    updateSite: (id, payload) => apiFetch(`/sites/${id}`, 'PUT', payload),
    deleteSite: (id) => apiFetch(`/sites/${id}`, 'DELETE'),
    updateSiteStatus: (id, status) => apiFetch(`/sites/${id}/status`, 'PUT', { status }),

    getProducts: (params = '') => apiFetch(`/products${params ? `?${params}` : ''}`, 'GET'),
    getProductById: (id) => apiFetch(`/products/${id}`, 'GET'),
    getCategories: () => apiFetch('/products/categories/list', 'GET'),
    createProduct: (formData) => apiFetch('/products', 'POST', formData), // Multipart
    updateProduct: (id, payload) => apiFetch(`/products/${id}`, 'PUT', payload),
    deleteProduct: (id) => apiFetch(`/products/${id}`, 'DELETE'),

    getCart: () => apiFetch('/cart', 'GET'),
    addToCart: (payload) => apiFetch('/cart/add', 'POST', payload),
    updateCart: (payload) => apiFetch('/cart/update', 'PUT', payload),
    removeCartItem: (productId) => apiFetch(`/cart/remove/${productId}`, 'DELETE'),
    clearCart: () => apiFetch('/cart/clear', 'DELETE'),

    placeOrder: (payload) => apiFetch('/orders', 'POST', payload),
    getOrders: (params = '') => apiFetch(`/orders${params ? `?${params}` : ''}`, 'GET'),
    getOrderById: (id) => apiFetch(`/orders/${id}`, 'GET'),
    updateOrderStatus: (id, status) => apiFetch(`/orders/${id}/status`, 'PUT', { status }),

    // Payments
    createPaymentOrder: (payload) => apiFetch('/payment/create-order', 'POST', payload),
    verifyPayment: (payload) => apiFetch('/payment/verify', 'POST', payload),
    reportPaymentFailure: (payload) => apiFetch('/payment/failure', 'POST', payload, { showError: false, showLoading: false }),
    retryPayment: (orderId) => apiFetch(`/payment/retry/${orderId}`, 'POST'),
    getPaymentDetails: (paymentId) => apiFetch(`/payment/${paymentId}`, 'GET'),
    getOrderPaymentStatus: (orderId) => apiFetch(`/payment/order/${orderId}`, 'GET'),

    getUsers: (params = '') => apiFetch(`/users${params ? `?${params}` : ''}`, 'GET'),
    createUser: (payload) => apiFetch('/users', 'POST', payload),
    getMyProfile: () => apiFetch('/users/me', 'GET'),
    updateMyProfile: (payload) => apiFetch('/users/me', 'PUT', payload),
    
    getServices: (params = '') => apiFetch(`/services${params ? `?${params}` : ''}`, 'GET'),
    createService: (payload) => apiFetch('/services', 'POST', payload),
    updateServiceStatus: (id, status) => apiFetch(`/services/${id}/status`, 'PUT', { status }),
    requestServiceFromOrder: (orderId) => apiFetch(`/services/request-from-order/${orderId}`, 'POST'),

    getQuotations: (params = '') => apiFetch(`/quotations${params ? `?${params}` : ''}`, 'GET'),
    createQuotation: (payload) => apiFetch('/quotations', 'POST', payload),
    updateQuotation: (id, payload) => apiFetch(`/quotations/${id}`, 'PUT', payload),
    deleteQuotation: (id) => apiFetch(`/quotations/${id}`, 'DELETE'),
    convertQuotation: (id) => apiFetch(`/quotations/${id}/convert`, 'POST'),

    getInvoices: (params = '') => apiFetch(`/invoices${params ? `?${params}` : ''}`, 'GET'),
    getInvoiceById: (id) => apiFetch(`/invoices/${id}`, 'GET'),
    generateInvoiceFromOrder: (orderId) => apiFetch(`/invoices/generate/${orderId}`, 'POST'),

    getAdminAnalytics: () => apiFetch('/analytics/admin', 'GET'),
    getDashboard: () => apiFetch('/dashboard', 'GET'),
    getUserAnalytics: () => apiFetch('/analytics/user', 'GET'),

    getNotifications: () => apiFetch('/notifications', 'GET'),
    getReports: () => apiFetch('/reports', 'GET'),

    initSocket,
    onEvent: (event, callback) => {
        const s = initSocket();
        if (s) s.on(event, callback);
    },

    logout: () => {
        clearAuthState();
        redirectToPublicHome();
    }
};
