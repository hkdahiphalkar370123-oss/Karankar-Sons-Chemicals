/**
 * Pagination UI Component
 * Creates pagination controls for list views
 * Usage: new Pagination(containerId, currentPage, totalPages, onPageChange)
 */

class Pagination {
    constructor(containerId, currentPage, totalPages, onPageChange) {
        this.containerId = containerId;
        this.currentPage = currentPage;
        this.totalPages = totalPages;
        this.onPageChange = onPageChange;
    }

    /**
     * Render pagination controls
     */
    render() {
        const container = document.getElementById(this.containerId);
        if (!container) return;

        // Clear existing content
        container.innerHTML = '';

        if (this.totalPages <= 1) {
            return; // No pagination needed for single page
        }

        const paginationHTML = this.getPaginationHTML();
        container.innerHTML = paginationHTML;

        // Attach event listeners
        this.attachEventListeners();
    }

    /**
     * Generate pagination HTML based on current page and total pages
     */
    getPaginationHTML() {
        let html = '<div class="pagination-controls">';

        // Previous button
        html += this.currentPage > 1
            ? `<button class="pagination-btn pagination-prev" data-page="${this.currentPage - 1}">← Previous</button>`
            : '<button class="pagination-btn pagination-prev" disabled>← Previous</button>';

        // Page numbers
        const pageNumbers = this.getPageNumbers();
        pageNumbers.forEach(page => {
            if (page === '...') {
                html += '<span class="pagination-ellipsis">...</span>';
            } else {
                const isActive = page === this.currentPage;
                html += `<button class="pagination-btn pagination-page ${isActive ? 'active' : ''}" data-page="${page}">${page}</button>`;
            }
        });

        // Next button
        html += this.currentPage < this.totalPages
            ? `<button class="pagination-btn pagination-next" data-page="${this.currentPage + 1}">Next →</button>`
            : '<button class="pagination-btn pagination-next" disabled>Next →</button>';

        // Info text
        html += `<span class="pagination-info">Page ${this.currentPage} of ${this.totalPages}</span>`;

        html += '</div>';
        return html;
    }

    /**
     * Calculate which page numbers to display
     * Shows: first, last, current, and 2 pages around current
     */
    getPageNumbers() {
        const pages = [];
        const maxPagesToShow = 5;

        if (this.totalPages <= maxPagesToShow) {
            // Show all pages if total is small
            for (let i = 1; i <= this.totalPages; i++) {
                pages.push(i);
            }
        } else {
            // Always show first page
            pages.push(1);

            // Calculate range around current page
            const startPage = Math.max(2, this.currentPage - 1);
            const endPage = Math.min(this.totalPages - 1, this.currentPage + 1);

            if (startPage > 2) {
                pages.push('...');
            }

            for (let i = startPage; i <= endPage; i++) {
                pages.push(i);
            }

            if (endPage < this.totalPages - 1) {
                pages.push('...');
            }

            // Always show last page
            pages.push(this.totalPages);
        }

        return pages;
    }

    /**
     * Attach click event listeners to pagination buttons
     */
    attachEventListeners() {
        const buttons = document.querySelectorAll('.pagination-btn');
        buttons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                if (!btn.disabled) {
                    const page = parseInt(btn.dataset.page);
                    if (this.onPageChange && typeof this.onPageChange === 'function') {
                        this.onPageChange(page);
                    }
                }
            });
        });
    }

    /**
     * Update pagination with new values
     */
    update(currentPage, totalPages) {
        this.currentPage = currentPage;
        this.totalPages = totalPages;
        this.render();
    }
}

/**
 * Pagination Info Component
 * Shows summary of items being displayed
 * Usage: new PaginationInfo(containerId, currentPage, pageSize, totalItems)
 */
class PaginationInfo {
    constructor(containerId, currentPage, pageSize, totalItems) {
        this.containerId = containerId;
        this.currentPage = currentPage;
        this.pageSize = pageSize;
        this.totalItems = totalItems;
    }

    render() {
        const container = document.getElementById(this.containerId);
        if (!container) return;

        const start = (this.currentPage - 1) * this.pageSize + 1;
        const end = Math.min(this.currentPage * this.pageSize, this.totalItems);

        if (this.totalItems === 0) {
            container.innerHTML = '<p class="pagination-info-text">No items found</p>';
        } else {
            container.innerHTML = `<p class="pagination-info-text">Showing <strong>${start}-${end}</strong> of <strong>${this.totalItems}</strong> items</p>`;
        }
    }

    update(currentPage, pageSize, totalItems) {
        this.currentPage = currentPage;
        this.pageSize = pageSize;
        this.totalItems = totalItems;
        this.render();
    }
}

/**
 * Quick Jump Component
 * Allows users to jump to a specific page
 * Usage: new QuickJump(containerId, totalPages, onJump)
 */
class QuickJump {
    constructor(containerId, totalPages, onJump) {
        this.containerId = containerId;
        this.totalPages = totalPages;
        this.onJump = onJump;
    }

    render() {
        const container = document.getElementById(this.containerId);
        if (!container) return;

        const html = `
            <div class="quick-jump">
                <label for="page-input">Go to page:</label>
                <input 
                    type="number" 
                    id="page-input" 
                    min="1" 
                    max="${this.totalPages}" 
                    placeholder="Enter page #"
                    class="page-input"
                />
                <button class="quick-jump-btn">Go</button>
            </div>
        `;

        container.innerHTML = html;
        this.attachEventListeners();
    }

    attachEventListeners() {
        const input = document.getElementById('page-input');
        const btn = document.querySelector('.quick-jump-btn');

        const handleJump = () => {
            const page = parseInt(input.value);
            if (page >= 1 && page <= this.totalPages && this.onJump) {
                this.onJump(page);
                input.value = '';
            }
        };

        btn.addEventListener('click', handleJump);
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                handleJump();
            }
        });
    }
}
