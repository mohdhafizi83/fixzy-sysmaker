// src/js/ui/toast.js

export function showToast(message, type = 'success') {
    // 1. Find or create the container
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        document.body.appendChild(container);
    }

    // 2. Create the toast element
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    // Icon based on type
    let iconClass = 'fa-check-circle';
    if (type === 'error') iconClass = 'fa-exclamation-circle';
    if (type === 'info') iconClass = 'fa-spinner fa-spin';

    toast.innerHTML = `<i class="fas ${iconClass}"></i> <span>${message}</span>`;

    // 3. Insert into the DOM
    container.appendChild(toast);

    // 4. Entry animation
    requestAnimationFrame(() => {
        toast.classList.add('show');
    });

    // 5. Auto-remove after 3 seconds (errors stay a bit longer)
    const duration = type === 'error' ? 5000 : 3000;

    setTimeout(() => {
        toast.classList.remove('show');
        // Wait for the CSS animation to finish before removing from the DOM
        toast.addEventListener('transitionend', () => {
            toast.remove();
        });
    }, duration);
}