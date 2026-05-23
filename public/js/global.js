/**
 * StayBnB - Global JavaScript Utilities
 * Production-ready enhancements for better UX
 */

(function() {
  'use strict';

  // ==========================================
  // FOCUS TRAP FOR MODALS
  // ==========================================
  window.FocusTrap = {
    active: null,
    
    create(element) {
      const focusableSelector = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
      const focusableElements = element.querySelectorAll(focusableSelector);
      const firstFocusable = focusableElements[0];
      const lastFocusable = focusableElements[focusableElements.length - 1];
      
      const trap = (e) => {
        if (e.key !== 'Tab') return;
        
        if (e.shiftKey) {
          if (document.activeElement === firstFocusable) {
            lastFocusable.focus();
            e.preventDefault();
          }
        } else {
          if (document.activeElement === lastFocusable) {
            firstFocusable.focus();
            e.preventDefault();
          }
        }
      };
      
      element.addEventListener('keydown', trap);
      this.active = { element, trap, firstFocusable };
      firstFocusable?.focus();
      
      return this;
    },
    
    release() {
      if (this.active) {
        this.active.element.removeEventListener('keydown', this.active.trap);
        this.active = null;
      }
    }
  };

  // ==========================================
  // FORM VALIDATION HELPERS
  // ==========================================
  window.FormValidation = {
    patterns: {
      email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
      phone: /^[6-9]\d{9}$/,
      password: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/,
      name: /^[a-zA-Z\s]{2,50}$/,
      pincode: /^\d{6}$/
    },
    
    validate(input, type) {
      const value = input.value.trim();
      const pattern = this.patterns[type];
      
      if (!pattern) return true;
      return pattern.test(value);
    },
    
    showError(input, message) {
      this.clearError(input);
      input.classList.add('border-red-500', 'focus:ring-red-500', 'focus:border-red-500');
      input.classList.remove('border-gray-300', 'focus:ring-rose-500', 'focus:border-rose-500');
      
      const errorDiv = document.createElement('p');
      errorDiv.className = 'form-error text-xs text-red-500 mt-1';
      errorDiv.textContent = message;
      input.parentNode.appendChild(errorDiv);
    },
    
    clearError(input) {
      input.classList.remove('border-red-500', 'focus:ring-red-500', 'focus:border-red-500');
      input.classList.add('border-gray-300', 'focus:ring-rose-500', 'focus:border-rose-500');
      
      const error = input.parentNode.querySelector('.form-error');
      if (error) error.remove();
    },
    
    showSuccess(input) {
      this.clearError(input);
      input.classList.add('border-emerald-500');
    }
  };

  // ==========================================
  // LOADING STATE MANAGER
  // ==========================================
  window.LoadingState = {
    show(element, text = 'Loading...') {
      if (!element) return;
      
      element.dataset.originalContent = element.innerHTML;
      element.disabled = true;
      element.classList.add('btn-loading');
      element.innerHTML = `<span class="opacity-0">${element.innerHTML}</span>`;
      
      return () => this.hide(element);
    },
    
    hide(element) {
      if (!element || !element.dataset.originalContent) return;
      
      element.disabled = false;
      element.classList.remove('btn-loading');
      element.innerHTML = element.dataset.originalContent;
      delete element.dataset.originalContent;
    }
  };

  // ==========================================
  // INTERSECTION OBSERVER FOR ANIMATIONS
  // ==========================================
  const observeAnimations = () => {
    const observerOptions = {
      threshold: 0.1,
      rootMargin: '0px 0px -50px 0px'
    };
    
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('animate-in');
          observer.unobserve(entry.target);
        }
      });
    }, observerOptions);
    
    document.querySelectorAll('[data-animate]').forEach(el => {
      observer.observe(el);
    });
  };

  // ==========================================
  // SMOOTH SCROLL POLYFILL & ENHANCEMENTS
  // ==========================================
  window.smoothScrollTo = (target, offset = 0) => {
    const element = typeof target === 'string' ? document.querySelector(target) : target;
    if (!element) return;
    
    const top = element.getBoundingClientRect().top + window.pageYOffset - offset;
    window.scrollTo({ top, behavior: 'smooth' });
  };

  // ==========================================
  // DATE FORMATTING HELPERS
  // ==========================================
  window.DateHelpers = {
    format(date, options = {}) {
      const d = new Date(date);
      const defaults = { day: 'numeric', month: 'short', year: 'numeric' };
      return d.toLocaleDateString('en-IN', { ...defaults, ...options });
    },
    
    relative(date) {
      const d = new Date(date);
      const now = new Date();
      const diffMs = now - d;
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      
      if (diffDays === 0) return 'Today';
      if (diffDays === 1) return 'Yesterday';
      if (diffDays < 7) return `${diffDays} days ago`;
      if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
      if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
      return `${Math.floor(diffDays / 365)} years ago`;
    },
    
    formatRange(start, end) {
      const startDate = new Date(start);
      const endDate = new Date(end);
      const startMonth = startDate.toLocaleDateString('en-IN', { month: 'short' });
      const endMonth = endDate.toLocaleDateString('en-IN', { month: 'short' });
      
      if (startMonth === endMonth) {
        return `${startDate.getDate()} - ${endDate.getDate()} ${startMonth}`;
      }
      return `${startDate.getDate()} ${startMonth} - ${endDate.getDate()} ${endMonth}`;
    }
  };

  // ==========================================
  // CURRENCY FORMATTING
  // ==========================================
  window.formatCurrency = (amount, currency = 'INR') => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  // ==========================================
  // DEBOUNCE & THROTTLE
  // ==========================================
  window.debounce = (func, wait = 300) => {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  };

  window.throttle = (func, limit = 300) => {
    let inThrottle;
    return function executedFunction(...args) {
      if (!inThrottle) {
        func(...args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    };
  };

  // ==========================================
  // LOCAL STORAGE HELPERS
  // ==========================================
  window.Storage = {
    set(key, value, ttl = null) {
      const item = {
        value,
        timestamp: Date.now(),
        ttl: ttl ? ttl * 1000 : null
      };
      localStorage.setItem(key, JSON.stringify(item));
    },
    
    get(key) {
      const item = localStorage.getItem(key);
      if (!item) return null;
      
      try {
        const parsed = JSON.parse(item);
        if (parsed.ttl && Date.now() - parsed.timestamp > parsed.ttl) {
          localStorage.removeItem(key);
          return null;
        }
        return parsed.value;
      } catch {
        return null;
      }
    },
    
    remove(key) {
      localStorage.removeItem(key);
    },
    
    clear() {
      localStorage.clear();
    }
  };

  // ==========================================
  // COPY TO CLIPBOARD
  // ==========================================
  window.copyToClipboard = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      if (window.Toast) {
        Toast.success('Copied!', 'Text copied to clipboard');
      }
      return true;
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      if (window.Toast) {
        Toast.success('Copied!', 'Text copied to clipboard');
      }
      return true;
    }
  };

  // ==========================================
  // SHARE API WRAPPER
  // ==========================================
  window.sharePage = async (data) => {
    const shareData = {
      title: data.title || document.title,
      text: data.text || '',
      url: data.url || window.location.href
    };
    
    try {
      if (navigator.share) {
        await navigator.share(shareData);
        return true;
      } else {
        // Fallback: copy URL to clipboard
        await copyToClipboard(shareData.url);
        return true;
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error('Share failed:', err);
      }
      return false;
    }
  };

  // ==========================================
  // KEYBOARD NAVIGATION HELPERS
  // ==========================================
  const setupKeyboardNavigation = () => {
    // Close modals/dropdowns with Escape
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        // Close any open dropdowns
        document.querySelectorAll('[data-dropdown-open="true"]').forEach(dropdown => {
          dropdown.classList.add('hidden');
          dropdown.dataset.dropdownOpen = 'false';
        });
        
        // Close any open modals
        document.querySelectorAll('.modal-overlay.active').forEach(modal => {
          modal.classList.remove('active');
          FocusTrap.release();
        });
      }
    });
    
    // Arrow key navigation for lists
    document.addEventListener('keydown', (e) => {
      if (!['ArrowUp', 'ArrowDown'].includes(e.key)) return;
      
      const list = document.activeElement?.closest('[role="listbox"], [role="menu"]');
      if (!list) return;
      
      const items = Array.from(list.querySelectorAll('[role="option"], [role="menuitem"]'));
      const currentIndex = items.indexOf(document.activeElement);
      
      if (currentIndex === -1) return;
      
      e.preventDefault();
      const nextIndex = e.key === 'ArrowDown' 
        ? Math.min(currentIndex + 1, items.length - 1)
        : Math.max(currentIndex - 1, 0);
      
      items[nextIndex].focus();
    });
  };

  // ==========================================
  // NETWORK STATUS HANDLER
  // ==========================================
  const setupNetworkStatus = () => {
    let wasOffline = false;
    
    const updateStatus = () => {
      if (!navigator.onLine) {
        wasOffline = true;
        if (window.Toast) {
          Toast.warning('Offline', 'You are currently offline. Some features may be unavailable.');
        }
      } else if (wasOffline) {
        wasOffline = false;
        if (window.Toast) {
          Toast.success('Back Online', 'Your connection has been restored.');
        }
      }
    };
    
    window.addEventListener('online', updateStatus);
    window.addEventListener('offline', updateStatus);
  };

  // ==========================================
  // AUTO-RESIZE TEXTAREAS
  // ==========================================
  const setupAutoResizeTextareas = () => {
    document.querySelectorAll('textarea[data-auto-resize]').forEach(textarea => {
      const resize = () => {
        textarea.style.height = 'auto';
        textarea.style.height = textarea.scrollHeight + 'px';
      };
      
      textarea.addEventListener('input', resize);
      resize(); // Initial resize
    });
  };

  // ==========================================
  // INITIALIZE ON DOM READY
  // ==========================================
  document.addEventListener('DOMContentLoaded', () => {
    observeAnimations();
    setupKeyboardNavigation();
    setupNetworkStatus();
    setupAutoResizeTextareas();
    
    // Add loaded class to body for CSS animations
    document.body.classList.add('loaded');
    
    // Setup form submit loading states
    document.querySelectorAll('form[data-loading]').forEach(form => {
      form.addEventListener('submit', function(e) {
        const submitBtn = this.querySelector('button[type="submit"]');
        if (submitBtn) {
          LoadingState.show(submitBtn);
        }
      });
    });
    
    // Setup click-outside handler for dropdowns
    document.addEventListener('click', (e) => {
      document.querySelectorAll('[data-dropdown]').forEach(dropdown => {
        const trigger = dropdown.querySelector('[data-dropdown-trigger]');
        const menu = dropdown.querySelector('[data-dropdown-menu]');
        
        if (!dropdown.contains(e.target) && menu) {
          menu.classList.add('hidden');
        }
      });
    });
    
    console.log('🏠 StayBnB UI initialized');
  });

})();
