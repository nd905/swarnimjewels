// ============================================================
//  SHOPPING CART SYSTEM - FIXED VERSION WITH DEBUG
//  Version: 2.0 - Bug Fixes + Better Reliability
//  Save this as: shopping-cart.js
//  Include in ALL pages: <script src="shopping-cart.js" defer></script>
// ============================================================

const ShoppingCart = {
    CART_KEY: 'swarnimCart',
    DEBUG: false, // Set to true for debugging

    // Debug logging
    log: function(message, data = null) {
        if (this.DEBUG) {
            console.log(`[ShoppingCart] ${message}`, data || '');
        }
    },

    // Check if localStorage is available
    isLocalStorageAvailable: function() {
        try {
            const test = '__storage_test__';
            localStorage.setItem(test, test);
            localStorage.removeItem(test);
            return true;
        } catch(e) {
            this.log('ERROR: localStorage not available', e);
            this.showNotification('⚠️ Cart requires cookies to be enabled in your browser.', 'error');
            return false;
        }
    },

    // Get cart from localStorage
    getCart: function() {
        if (!this.isLocalStorageAvailable()) return [];
        
        try {
            const cart = localStorage.getItem(this.CART_KEY);
            const parsedCart = cart ? JSON.parse(cart) : [];
            this.log('Cart loaded', parsedCart);
            return parsedCart;
        } catch(e) {
            this.log('ERROR: Failed to load cart', e);
            return [];
        }
    },

    // Save cart to localStorage
    saveCart: function(cart) {
        if (!this.isLocalStorageAvailable()) return false;
        
        try {
            localStorage.setItem(this.CART_KEY, JSON.stringify(cart));
            this.log('Cart saved', cart);
            this.updateCartCount();
            
            // Dispatch custom event so other pages know cart changed
            window.dispatchEvent(new CustomEvent('cartUpdated', { detail: cart }));
            return true;
        } catch(e) {
            this.log('ERROR: Failed to save cart', e);
            this.showNotification('⚠️ Failed to save cart. Your cart may be full.', 'error');
            return false;
        }
    },

    // Add item to cart
    addItem: function(product) {
        this.log('Adding item to cart', product);
        
        // Validate product data
        if (!product || !product.id) {
            this.log('ERROR: Invalid product - missing ID');
            this.showNotification('⚠️ Error: Invalid product data.', 'error');
            return false;
        }
        
        if (!product.name) {
            this.log('ERROR: Invalid product - missing name');
            product.name = 'Product';
        }
        
        if (!product.price || product.price <= 0) {
            this.log('ERROR: Invalid product - invalid price');
            this.showNotification('⚠️ Error: Invalid product price.', 'error');
            return false;
        }
        
        let cart = this.getCart();
        
        // Check if product already exists (always compare as strings — IDs may come in as numbers)
        const existingIndex = cart.findIndex(item => item.id === String(product.id));
        
        if (existingIndex > -1) {
            // Increase quantity
            cart[existingIndex].quantity = (cart[existingIndex].quantity || 1) + 1;
            this.log('Increased quantity', cart[existingIndex]);
        } else {
            // Add new item with proper structure
            const newItem = {
                id: String(product.id), // Ensure string
                name: String(product.name).trim(),
                price: parseFloat(product.price),
                image: product.image || 'https://via.placeholder.com/150',
                quantity: 1,
                addedAt: new Date().toISOString()
            };
            cart.push(newItem);
            this.log('Added new item', newItem);
        }
        
        this.saveCart(cart);
        this.showNotification('✅ Added to cart!', 'success');
        return true;
    },

    // Remove item from cart
    removeItem: function(productId) {
        this.log('Removing item', productId);
        let cart = this.getCart();
        const beforeLength = cart.length;
        cart = cart.filter(item => item.id !== String(productId));

        if (cart.length === beforeLength) {
            this.log('WARNING: Item not found', productId);
            return false; // Item wasn't in cart — don't save or notify
        }

        this.saveCart(cart);
        this.showNotification('Item removed', 'info');
        return true;
    },

    // Update quantity
    updateQuantity: function(productId, quantity) {
        this.log('Updating quantity', { productId, quantity });
        let cart = this.getCart();
        const index = cart.findIndex(item => item.id === String(productId));
        
        if (index > -1) {
            if (quantity <= 0) {
                cart.splice(index, 1);
                this.log('Removed item (quantity 0)');
            } else {
                cart[index].quantity = parseInt(quantity);
                this.log('Updated quantity', cart[index]);
            }
            this.saveCart(cart);
            return true;
        } else {
            this.log('WARNING: Item not found for quantity update', productId);
            return false;
        }
    },

    // Get cart count
    getCount: function() {
        const cart = this.getCart();
        const count = cart.reduce((total, item) => total + (parseInt(item.quantity) || 1), 0);
        this.log('Cart count', count);
        return count;
    },

    // Get cart total
    getTotal: function() {
        const cart = this.getCart();
        const total = cart.reduce((sum, item) => {
            return sum + (parseFloat(item.price) * (parseInt(item.quantity) || 1));
        }, 0);
        this.log('Cart total', total);
        return total;
    },

    // Clear cart
    clear: function() {
        this.log('Clearing cart');
        localStorage.removeItem(this.CART_KEY);
        this.updateCartCount();
        this.showNotification('Cart cleared', 'info');
    },

    // Update cart count badge
    updateCartCount: function() {
        const count = this.getCount();
        this.log('Updating cart badges', count);
        
        // Update all cart count elements
        const selectors = [
            '.cart-count',
            '.cart-badge', 
            '[data-cart-count]',
            '#cartCount',
            '.cart-counter'
        ];
        
        selectors.forEach(selector => {
            const elements = document.querySelectorAll(selector);
            elements.forEach(element => {
                element.textContent = count;
                element.style.display = count > 0 ? 'flex' : 'none';
                element.setAttribute('data-count', count);
            });
        });
        
        // Update page title if on cart page
        if (window.location.pathname.includes('cart.html')) {
            document.title = count > 0 ? `Cart (${count}) | Swarnim Jewels` : 'Cart | Swarnim Jewels';
        }
    },

    // Show notification
    showNotification: function(message, type = 'info') {
        this.log('Notification', { message, type });

        // Remove existing notifications
        const existing = document.querySelectorAll('.cart-notification');
        existing.forEach(el => el.remove());

        // Build safely — NO innerHTML with user-controlled content (XSS prevention)
        const notification = document.createElement('div');
        notification.className = `cart-notification cart-notification-${type}`;

        const inner = document.createElement('div');
        inner.style.cssText = [
            'position:fixed', 'top:20px', 'right:20px',
            `background:${type === 'success' ? '#4CAF50' : type === 'error' ? '#f44336' : '#2196F3'}`,
            'color:white', 'padding:15px 25px', 'border-radius:5px',
            'box-shadow:0 4px 12px rgba(0,0,0,0.3)', 'z-index:10000',
            "font-family:'Lato',sans-serif", 'font-size:14px',
            'font-weight:500', 'animation:slideInRight 0.3s ease'
        ].join(';');
        inner.textContent = message;   // ← textContent: safe, never executes HTML

        notification.appendChild(inner);
        document.body.appendChild(notification);
        
        // Auto remove after 3 seconds
        setTimeout(() => {
            notification.firstElementChild.style.animation = 'slideOutRight 0.3s ease';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    },

    // Initialize cart on page load
    init: function() {
        this.log('Initializing cart system');

        // Inject notification animation CSS FIRST (before any checks that may trigger notifications)
        if (!document.getElementById('sj-cart-styles')) {
            const style = document.createElement('style');
            style.id = 'sj-cart-styles';
            style.textContent = `
                @keyframes slideInRight {
                    from { transform: translateX(400px); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
                @keyframes slideOutRight {
                    from { transform: translateX(0); opacity: 1; }
                    to { transform: translateX(400px); opacity: 0; }
                }
            `;
            document.head.appendChild(style);
        }

        // Check localStorage availability
        if (!this.isLocalStorageAvailable()) {
            console.error('ShoppingCart: localStorage not available');
            return;
        }
        this.updateCartCount();
        
        // Listen for storage changes from other tabs
        window.addEventListener('storage', (e) => {
            if (e.key === this.CART_KEY) {
                this.log('Cart changed in another tab');
                this.updateCartCount();
                
                // Reload cart page if open
                if (window.location.pathname.includes('cart.html')) {
                    if (typeof loadCart === 'function') {
                        loadCart();
                    }
                }
            }
        });
        
        // Debug: Show cart contents in console
        this.log('Initial cart state', this.getCart());
        
        console.log('✅ ShoppingCart initialized successfully');
    }
};

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => ShoppingCart.init());
} else {
    ShoppingCart.init();
}

// Make it globally available
window.ShoppingCart = ShoppingCart;

// Export for modules (if needed)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ShoppingCart;
}
