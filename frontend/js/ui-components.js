/**
 * UI Components - Toast Notifications, Loading Indicators, Empty States, Skeleton Loaders
 */

// ==================== TOAST NOTIFICATIONS ====================

class Toast {
    constructor(message, type = 'info', duration = 3000) {
        this.message = message;
        this.type = type; // 'success', 'error', 'warning', 'info'
        this.duration = duration;
        this.element = null;
    }

    show() {
        // Remove any existing toasts of the same type
        const existing = document.querySelector(`.toast.${this.type}`);
        if (existing) {
            existing.remove();
        }

        // Create toast container if it doesn't exist
        let container = document.getElementById('toast-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'toast-container';
            document.body.appendChild(container);
        }

        // Create toast element
        this.element = document.createElement('div');
        this.element.className = `toast ${this.type}`;
        
        const icons = {
            success: '✓',
            error: '✕',
            warning: '⚠',
            info: 'ℹ'
        };

        this.element.innerHTML = `
            <div class="toast-content">
                <span class="toast-icon">${icons[this.type]}</span>
                <span class="toast-message">${this.escapeHtml(this.message)}</span>
                <button class="toast-close" aria-label="Close">×</button>
            </div>
        `;

        // Add event listeners
        this.element.querySelector('.toast-close').addEventListener('click', () => this.close());

        // Add to container
        container.appendChild(this.element);

        // Auto close
        if (this.duration > 0) {
            setTimeout(() => this.close(), this.duration);
        }

        return this;
    }

    close() {
        if (this.element) {
            this.element.classList.add('closing');
            setTimeout(() => {
                if (this.element && this.element.parentNode) {
                    this.element.parentNode.removeChild(this.element);
                }
            }, 300);
        }
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    static success(message, duration = 3000) {
        return new Toast(message, 'success', duration).show();
    }

    static error(message, duration = 5000) {
        return new Toast(message, 'error', duration).show();
    }

    static warning(message, duration = 4000) {
        return new Toast(message, 'warning', duration).show();
    }

    static info(message, duration = 3000) {
        return new Toast(message, 'info', duration).show();
    }
}

// ==================== LOADING INDICATORS ====================

class LoadingIndicator {
    static show(targetElement = null) {
        let container = targetElement || document.body;
        
        // Check if loading is already showing
        if (container.querySelector('.loading-overlay')) {
            return;
        }

        const overlay = document.createElement('div');
        overlay.className = 'loading-overlay';
        overlay.innerHTML = `
            <div class="loading-spinner">
                <div class="spinner-ring"></div>
                <div class="spinner-circle"></div>
                <p class="loading-text">Loading...</p>
            </div>
        `;

        container.appendChild(overlay);
        // Trigger animation
        setTimeout(() => overlay.classList.add('visible'), 10);
    }

    static hide(targetElement = null) {
        const container = targetElement || document.body;
        const overlay = container.querySelector('.loading-overlay');
        
        if (overlay) {
            overlay.classList.remove('visible');
            setTimeout(() => {
                if (overlay.parentNode) {
                    overlay.parentNode.removeChild(overlay);
                }
            }, 300);
        }
    }

    static showInline(targetElement, message = 'Loading...') {
        if (!targetElement) return;

        const spinner = document.createElement('div');
        spinner.className = 'inline-spinner';
        spinner.innerHTML = `
            <div class="spinner-small"></div>
            <span>${message}</span>
        `;

        targetElement.appendChild(spinner);
        return spinner;
    }

    static hideInline(spinnerElement) {
        if (spinnerElement && spinnerElement.parentNode) {
            spinnerElement.parentNode.removeChild(spinnerElement);
        }
    }
}

// ==================== SKELETON LOADERS ====================

class SkeletonLoader {
    static createProductSkeleton() {
        return `
            <div class="skeleton-card">
                <div class="skeleton skeleton-img"></div>
                <div class="skeleton skeleton-line" style="width: 80%; margin: 8px 0;"></div>
                <div class="skeleton skeleton-line" style="width: 60%; margin: 8px 0;"></div>
                <div class="skeleton skeleton-line" style="width: 40%; margin: 8px 0;"></div>
                <div class="skeleton skeleton-btn"></div>
            </div>
        `;
    }

    static createTableRowSkeleton(columns = 5) {
        let cells = '';
        for (let i = 0; i < columns; i++) {
            cells += `<td><div class="skeleton skeleton-line"></div></td>`;
        }
        return `<tr class="skeleton-row">${cells}</tr>`;
    }

    static createOrderSkeleton() {
        return `
            <div class="skeleton-order-card">
                <div class="skeleton skeleton-line" style="width: 40%; margin-bottom: 12px;"></div>
                <div class="skeleton skeleton-line" style="width: 70%; margin-bottom: 12px;"></div>
                <div class="skeleton skeleton-line" style="width: 60%; margin-bottom: 12px;"></div>
                <div class="skeleton skeleton-line" style="width: 30%;"></div>
            </div>
        `;
    }

    static show(container, count = 3, type = 'product') {
        if (!container) return;

        let skeletons = '';
        let skeletonTemplate;

        switch (type) {
            case 'product':
                skeletonTemplate = this.createProductSkeleton();
                break;
            case 'table':
                skeletonTemplate = this.createTableRowSkeleton();
                break;
            case 'order':
                skeletonTemplate = this.createOrderSkeleton();
                break;
            default:
                skeletonTemplate = this.createProductSkeleton();
        }

        for (let i = 0; i < count; i++) {
            skeletons += skeletonTemplate;
        }

        container.innerHTML = skeletons;
    }

    static hide(container) {
        if (container) {
            container.innerHTML = '';
        }
    }
}

// ==================== EMPTY STATES ====================

class EmptyState {
    static show(container, options = {}) {
        if (!container) return;

        const {
            title = 'No Data Available',
            description = 'There is nothing to display here',
            icon = '📭',
            action = null,
            actionText = 'Go Home'
        } = options;

        const emptyDiv = document.createElement('div');
        emptyDiv.className = 'empty-state';
        emptyDiv.innerHTML = `
            <div class="empty-state-content">
                <div class="empty-state-icon">${icon}</div>
                <h3 class="empty-state-title">${this.escapeHtml(title)}</h3>
                <p class="empty-state-description">${this.escapeHtml(description)}</p>
                ${action ? `<button class="btn btn-primary empty-state-action">${actionText}</button>` : ''}
            </div>
        `;

        container.innerHTML = '';
        container.appendChild(emptyDiv);

        if (action && typeof action === 'function') {
            emptyDiv.querySelector('.empty-state-action').addEventListener('click', action);
        }
    }

    static showProduct(container) {
        this.show(container, {
            title: 'No Products Found',
            description: 'We couldn\'t find any products matching your search',
            icon: '🛍️',
            actionText: 'View All Products'
        });
    }

    static showCart(container) {
        this.show(container, {
            title: 'Your Cart is Empty',
            description: 'Start shopping to add items to your cart',
            icon: '🛒',
            actionText: 'Continue Shopping',
            action: () => window.location.href = 'products.html'
        });
    }

    static showOrders(container) {
        this.show(container, {
            title: 'No Orders Yet',
            description: 'You haven\'t placed any orders yet',
            icon: '📦',
            actionText: 'Start Shopping',
            action: () => window.location.href = 'products.html'
        });
    }

    static showError(container, errorMessage = 'Something went wrong') {
        this.show(container, {
            title: 'Oops! Error',
            description: errorMessage,
            icon: '❌'
        });
    }

    static escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    static hide(container) {
        if (container) {
            const emptyState = container.querySelector('.empty-state');
            if (emptyState) {
                emptyState.remove();
            }
        }
    }
}

// ==================== PAGE LOADER ====================

class PageLoader {
    static init() {
        // Add loading event listeners to all forms and navigation links
        document.addEventListener('submit', (e) => {
            const form = e.target;
            if (form.classList.contains('loading-on-submit')) {
                LoadingIndicator.show();
            }
        });

        document.addEventListener('click', (e) => {
            const link = e.target.closest('a');
            if (link && link.classList.contains('loading-on-click') && link.href && !link.href.includes('#')) {
                LoadingIndicator.show();
            }
        });
    }
}

// ==================== CONFIRMATION MODAL ====================

class ConfirmModal {
    static show(title, message, onConfirm, onCancel = null) {
        // Check if modal already exists
        let modal = document.getElementById('confirm-modal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'confirm-modal';
            modal.className = 'confirm-modal';
            document.body.appendChild(modal);
        }

        modal.innerHTML = `
            <div class="confirm-modal-content">
                <h3>${this.escapeHtml(title)}</h3>
                <p>${this.escapeHtml(message)}</p>
                <div class="confirm-modal-actions">
                    <button class="btn btn-secondary" id="cancel-btn">Cancel</button>
                    <button class="btn btn-danger" id="confirm-btn">Confirm</button>
                </div>
            </div>
        `;

        modal.classList.add('visible');

        const confirmBtn = modal.querySelector('#confirm-btn');
        const cancelBtn = modal.querySelector('#cancel-btn');

        confirmBtn.addEventListener('click', () => {
            this.hide();
            onConfirm();
        });

        cancelBtn.addEventListener('click', () => {
            this.hide();
            if (onCancel) onCancel();
        });

        // Close on backdrop click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                this.hide();
                if (onCancel) onCancel();
            }
        });

        // Escape key
        const handleEscape = (e) => {
            if (e.key === 'Escape') {
                this.hide();
                if (onCancel) onCancel();
                document.removeEventListener('keydown', handleEscape);
            }
        };
        document.addEventListener('keydown', handleEscape);

        return modal;
    }

    static hide() {
        const modal = document.getElementById('confirm-modal');
        if (modal) {
            modal.classList.remove('visible');
        }
    }

    static escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// ==================== GLOBAL ERROR HANDLER ====================

window.handleUIError = (error, options = {}) => {
    const {
        showToast = true,
        showModal = false,
        fallbackMessage = 'An error occurred. Please try again.'
    } = options;

    let errorMessage = fallbackMessage;

    // Extract error message from various sources
    if (typeof error === 'string') {
        errorMessage = error;
    } else if (error?.response?.data?.error) {
        errorMessage = error.response.data.error;
    } else if (error?.message) {
        errorMessage = error.message;
    }

    console.error('[UI Error]', error);

    if (showToast) {
        Toast.error(errorMessage);
    }

    if (showModal) {
        ConfirmModal.show('Error', errorMessage, () => {});
    }

    return errorMessage;
};

// ==================== INITIALIZATION ====================

// Initialize page loader on DOM ready
document.addEventListener('DOMContentLoaded', () => {
    PageLoader.init();
    
    // Create toast container if it doesn't exist
    if (!document.getElementById('toast-container')) {
        const container = document.createElement('div');
        container.id = 'toast-container';
        document.body.appendChild(container);
    }
});

// Export for use in modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        Toast,
        LoadingIndicator,
        SkeletonLoader,
        EmptyState,
        PageLoader,
        ConfirmModal
    };
}
