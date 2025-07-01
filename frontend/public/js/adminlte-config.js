// adminlte-config.js - AdminLTE 4 Configuration for Financial Bot

// AdminLTE Configuration Object
const AdminLTEConfig = {
    // Theme Settings
    theme: {
        variant: 'light', // light, dark, auto
        sidebarTheme: 'dark', // light, dark
        navbarTheme: 'light', // light, dark
        accentColor: 'primary', // primary, secondary, success, info, warning, danger
    },
    
    // Layout Settings
    layout: {
        sidebarMini: true,
        sidebarCollapse: false,
        navbarFixed: true,
        footerFixed: false,
        contentFixed: false,
    },
    
    // Component Settings
    components: {
        tooltip: true,
        popover: true,
        toast: true,
        modal: true,
    },
    
    // Animation Settings
    animations: {
        sidebarToggle: 300,
        cardCollapse: 300,
        tooltipDelay: 100,
    },
    
    // API Settings
    api: {
        baseUrl: 'http://localhost:3001/api',
        timeout: 10000,
        retryAttempts: 3,
        retryDelay: 1000,
    },
    
    // Dashboard Settings
    dashboard: {
        autoRefresh: true,
        refreshInterval: 30000, // 30 seconds
        chartAnimations: true,
        realTimeUpdates: true,
    },
    
    // Notification Settings
    notifications: {
        position: 'top-end',
        duration: 4000,
        showProgress: true,
        pauseOnHover: true,
    },
    
    // Table Settings
    tables: {
        responsive: true,
        pagination: true,
        search: true,
        pageSize: 25,
        showInfo: true,
    },
    
    // Form Settings
    forms: {
        validation: true,
        autoSave: false,
        autoComplete: true,
        dateFormat: 'YYYY-MM-DD',
        currencyFormat: 'IDR',
    },
    
    // Security Settings
    security: {
        sessionTimeout: 3600000, // 1 hour
        maxRetries: 5,
        lockoutTime: 300000, // 5 minutes
    },
    
    // Performance Settings
    performance: {
        lazyLoading: true,
        imageCompression: true,
        cacheEnabled: true,
        compressionLevel: 6,
    },
    
    // Mobile Settings
    mobile: {
        swipeGestures: true,
        touchFriendly: true,
        autoCollapseMenu: true,
        mobileBreakpoint: 768,
    },
    
    // Debug Settings
    debug: {
        enabled: false,
        logLevel: 'error', // error, warn, info, debug
        showPerformanceMetrics: false,
        consoleOutput: true,
    }
};

// AdminLTE Helper Functions
const AdminLTEHelpers = {
    
    // Initialize AdminLTE with custom config
    init: function(customConfig = {}) {
        const config = { ...AdminLTEConfig, ...customConfig };
        
        // Apply theme settings
        this.applyTheme(config.theme);
        
        // Initialize components
        this.initComponents(config.components);
        
        // Setup event listeners
        this.setupEventListeners(config);
        
        // Enable debugging if needed
        if (config.debug.enabled) {
            this.enableDebugMode(config.debug);
        }
        
        console.log('📊 AdminLTE 4 Financial Dashboard initialized');
        return config;
    },
    
    // Apply theme settings
    applyTheme: function(themeConfig) {
        const body = document.body;
        
        // Apply main theme
        body.setAttribute('data-bs-theme', themeConfig.variant);
        
        // Apply sidebar theme
        const sidebar = document.querySelector('.app-sidebar');
        if (sidebar) {
            sidebar.setAttribute('data-bs-theme', themeConfig.sidebarTheme);
        }
        
        // Apply navbar theme
        const navbar = document.querySelector('.app-header');
        if (navbar) {
            navbar.classList.add(`navbar-${themeConfig.navbarTheme}`);
        }
        
        // Apply accent color
        document.documentElement.style.setProperty('--bs-primary', this.getAccentColor(themeConfig.accentColor));
    },
    
    // Get accent color hex value
    getAccentColor: function(color) {
        const colors = {
            primary: '#0d6efd',
            secondary: '#6c757d',
            success: '#198754',
            info: '#0dcaf0',
            warning: '#ffc107',
            danger: '#dc3545'
        };
        return colors[color] || colors.primary;
    },
    
    // Initialize Bootstrap components
    initComponents: function(componentConfig) {
        if (componentConfig.tooltip) {
            this.initTooltips();
        }
        
        if (componentConfig.popover) {
            this.initPopovers();
        }
        
        if (componentConfig.toast) {
            this.initToasts();
        }
        
        if (componentConfig.modal) {
            this.initModals();
        }
    },
    
    // Initialize tooltips
    initTooltips: function() {
        const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"], [title]'));
        tooltipTriggerList.map(function(tooltipTriggerEl) {
            return new bootstrap.Tooltip(tooltipTriggerEl, {
                delay: { show: 100, hide: 100 },
                placement: 'auto'
            });
        });
    },
    
    // Initialize popovers
    initPopovers: function() {
        const popoverTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="popover"]'));
        popoverTriggerList.map(function(popoverTriggerEl) {
            return new bootstrap.Popover(popoverTriggerEl);
        });
    },
    
    // Initialize toasts
    initToasts: function() {
        const toastElList = [].slice.call(document.querySelectorAll('.toast'));
        toastElList.map(function(toastEl) {
            return new bootstrap.Toast(toastEl, {
                animation: true,
                autohide: true,
                delay: 4000
            });
        });
    },
    
    // Initialize modals
    initModals: function() {
        const modalElList = [].slice.call(document.querySelectorAll('.modal'));
        modalElList.map(function(modalEl) {
            return new bootstrap.Modal(modalEl, {
                backdrop: true,
                keyboard: true,
                focus: true
            });
        });
    },
    
    // Setup event listeners
    setupEventListeners: function(config) {
        // Sidebar toggle
        document.addEventListener('click', function(e) {
            if (e.target.matches('[data-lte-toggle="sidebar"]')) {
                e.preventDefault();
                AdminLTEHelpers.toggleSidebar();
            }
        });
        
        // Mobile menu auto-collapse
        if (config.mobile.autoCollapseMenu) {
            document.addEventListener('click', function(e) {
                if (window.innerWidth <= config.mobile.mobileBreakpoint) {
                    if (e.target.closest('.sidebar-menu .nav-link')) {
                        AdminLTEHelpers.collapseSidebar();
                    }
                }
            });
        }
        
        // Auto-refresh setup
        if (config.dashboard.autoRefresh) {
            this.setupAutoRefresh(config.dashboard.refreshInterval);
        }
    },
    
    // Toggle sidebar
    toggleSidebar: function() {
        const wrapper = document.querySelector('.app-wrapper');
        if (wrapper) {
            wrapper.classList.toggle('sidebar-collapse');
            localStorage.setItem('sidebar-collapse', wrapper.classList.contains('sidebar-collapse'));
        }
    },
    
    // Collapse sidebar
    collapseSidebar: function() {
        const wrapper = document.querySelector('.app-wrapper');
        if (wrapper) {
            wrapper.classList.add('sidebar-collapse');
        }
    },
    
    // Expand sidebar
    expandSidebar: function() {
        const wrapper = document.querySelector('.app-wrapper');
        if (wrapper) {
            wrapper.classList.remove('sidebar-collapse');
        }
    },
    
    // Setup auto-refresh
    setupAutoRefresh: function(interval) {
        setInterval(() => {
            if (typeof window.updateDashboard === 'function' && window.isApiConnected) {
                const activeTab = document.querySelector('.tab-content.active');
                if (activeTab && activeTab.id === 'dashboard-tab') {
                    window.updateDashboard();
                }
            }
        }, interval);
    },
    
    // Show notification
    showNotification: function(message, type = 'success', options = {}) {
        const defaultOptions = {
            position: AdminLTEConfig.notifications.position,
            duration: AdminLTEConfig.notifications.duration,
            showProgress: AdminLTEConfig.notifications.showProgress
        };
        
        const finalOptions = { ...defaultOptions, ...options };
        
        // Create toast notification
        const toastHtml = `
            <div class="toast" role="alert" aria-live="assertive" aria-atomic="true">
                <div class="toast-header">
                    <i class="fas fa-${this.getIconForType(type)} text-${type} me-2"></i>
                    <strong class="me-auto">Financial Bot</strong>
                    <small class="text-muted">now</small>
                    <button type="button" class="btn-close" data-bs-dismiss="toast"></button>
                </div>
                <div class="toast-body">
                    ${message}
                </div>
            </div>
        `;
        
        // Add to toast container
        let toastContainer = document.querySelector('.toast-container');
        if (!toastContainer) {
            toastContainer = document.createElement('div');
            toastContainer.className = `toast-container position-fixed ${finalOptions.position} p-3`;
            toastContainer.style.zIndex = '1080';
            document.body.appendChild(toastContainer);
        }
        
        toastContainer.insertAdjacentHTML('beforeend', toastHtml);
        
        // Initialize and show toast
        const toastElement = toastContainer.lastElementChild;
        const toast = new bootstrap.Toast(toastElement, {
            autohide: true,
            delay: finalOptions.duration
        });
        
        toast.show();
        
        // Remove from DOM after hiding
        toastElement.addEventListener('hidden.bs.toast', function() {
            toastElement.remove();
        });
    },
    
    // Get icon for notification type
    getIconForType: function(type) {
        const icons = {
            success: 'check-circle',
            error: 'exclamation-circle',
            warning: 'exclamation-triangle',
            info: 'info-circle'
        };
        return icons[type] || 'info-circle';
    },
    
    // Loading states
    showLoading: function(element, text = 'Loading...') {
        if (typeof element === 'string') {
            element = document.querySelector(element);
        }
        
        if (element) {
            element.innerHTML = `
                <div class="text-center p-4">
                    <div class="spinner-border text-primary" role="status">
                        <span class="visually-hidden">${text}</span>
                    </div>
                    <p class="mt-2 text-muted">${text}</p>
                </div>
            `;
        }
    },
    
    // Hide loading
    hideLoading: function(element) {
        // This would be handled by the specific content loading functions
    },
    
    // Format currency for Indonesian Rupiah
    formatCurrency: function(amount) {
        return new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: 'IDR',
            minimumFractionDigits: 0
        }).format(amount);
    },
    
    // Format date for Indonesian locale
    formatDate: function(date, format = 'short') {
        const options = {
            short: { day: '2-digit', month: '2-digit', year: 'numeric' },
            long: { day: 'numeric', month: 'long', year: 'numeric' },
            full: { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }
        };
        
        return new Intl.DateTimeFormat('id-ID', options[format]).format(new Date(date));
    },
    
    // Validate form data
    validateForm: function(formElement) {
        if (typeof formElement === 'string') {
            formElement = document.querySelector(formElement);
        }
        
        if (!formElement) return false;
        
        const inputs = formElement.querySelectorAll('input[required], select[required], textarea[required]');
        let isValid = true;
        
        inputs.forEach(input => {
            if (!input.value.trim()) {
                input.classList.add('is-invalid');
                isValid = false;
            } else {
                input.classList.remove('is-invalid');
                input.classList.add('is-valid');
            }
        });
        
        return isValid;
    },
    
    // Enable debug mode
    enableDebugMode: function(debugConfig) {
        window.AdminLTEDebug = {
            config: AdminLTEConfig,
            logLevel: debugConfig.logLevel,
            
            log: function(level, message, data = null) {
                if (this.shouldLog(level)) {
                    const timestamp = new Date().toISOString();
                    console[level](`[${timestamp}] AdminLTE: ${message}`, data || '');
                }
            },
            
            shouldLog: function(level) {
                const levels = ['error', 'warn', 'info', 'debug'];
                const currentLevelIndex = levels.indexOf(this.logLevel);
                const messageLevelIndex = levels.indexOf(level);
                return messageLevelIndex <= currentLevelIndex;
            }
        };
        
        // Performance monitoring
        if (debugConfig.showPerformanceMetrics) {
            this.enablePerformanceMonitoring();
        }
    },
    
    // Enable performance monitoring
    enablePerformanceMonitoring: function() {
        if (window.performance) {
            window.addEventListener('load', function() {
                setTimeout(() => {
                    const perfData = window.performance.timing;
                    const loadTime = perfData.loadEventEnd - perfData.navigationStart;
                    const domReady = perfData.domContentLoadedEventEnd - perfData.navigationStart;
                    
                    console.log('📊 Performance Metrics:');
                    console.log(`Total Load Time: ${loadTime}ms`);
                    console.log(`DOM Ready Time: ${domReady}ms`);
                    console.log(`Time to Interactive: ${perfData.loadEventEnd - perfData.fetchStart}ms`);
                }, 0);
            });
        }
    },
    
    // Storage helpers
    storage: {
        set: function(key, value) {
            try {
                localStorage.setItem(`financial-bot-${key}`, JSON.stringify(value));
                return true;
            } catch (e) {
                console.error('Failed to save to localStorage:', e);
                return false;
            }
        },
        
        get: function(key, defaultValue = null) {
            try {
                const item = localStorage.getItem(`financial-bot-${key}`);
                return item ? JSON.parse(item) : defaultValue;
            } catch (e) {
                console.error('Failed to read from localStorage:', e);
                return defaultValue;
            }
        },
        
        remove: function(key) {
            try {
                localStorage.removeItem(`financial-bot-${key}`);
                return true;
            } catch (e) {
                console.error('Failed to remove from localStorage:', e);
                return false;
            }
        }
    }
};

// Auto-initialize when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    // Load saved preferences
    const savedSidebarState = AdminLTEHelpers.storage.get('sidebar-collapse', false);
    if (savedSidebarState) {
        document.querySelector('.app-wrapper')?.classList.add('sidebar-collapse');
    }
    
    const savedTheme = AdminLTEHelpers.storage.get('theme', 'light');
    const customConfig = {
        theme: {
            ...AdminLTEConfig.theme,
            variant: savedTheme
        }
    };
    
    // Initialize AdminLTE
    AdminLTEHelpers.init(customConfig);
});

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { AdminLTEConfig, AdminLTEHelpers };
} else {
    window.AdminLTEConfig = AdminLTEConfig;
    window.AdminLTEHelpers = AdminLTEHelpers;
}