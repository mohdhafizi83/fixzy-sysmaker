// src/js/ui/toast.js

export function showToast(message, type = 'success') {
    // 1. Cari atau Cipta Container
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        document.body.appendChild(container);
    }

    // 2. Cipta Elemen Toast
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    // Ikon berdasarkan jenis
    let iconClass = 'fa-check-circle';
    if (type === 'error') iconClass = 'fa-exclamation-circle';
    if (type === 'info') iconClass = 'fa-spinner fa-spin';

    toast.innerHTML = `<i class="fas ${iconClass}"></i> <span>${message}</span>`;

    // 3. Masukkan ke dalam DOM
    container.appendChild(toast);

    // 4. Animasi Masuk
    requestAnimationFrame(() => {
        toast.classList.add('show');
    });

    // 5. Auto-Hapus selepas 3 saat (kecuali error mungkin nak lama sikit)
    const duration = type === 'error' ? 5000 : 3000;

    setTimeout(() => {
        toast.classList.remove('show');
        // Tunggu animasi CSS tamat baru buang dari DOM
        toast.addEventListener('transitionend', () => {
            toast.remove();
        });
    }, duration);
}