// js/ui/tabHandlers.js

export function initializeTabSystems() {
    // Cari semua bekas tab dalam dokumen
    const allTabContainers = document.querySelectorAll('.tabs-container');

    allTabContainers.forEach(container => {
        // :scope memastikan kita hanya memilih anak-anak terus dari bekas ini
        const tabLinks = container.querySelectorAll(':scope > .tabs-nav > .tab-link');
        
        tabLinks.forEach(link => {
            link.addEventListener('click', () => {
                const tabId = link.dataset.tab;
                const contentContainer = container.querySelector(':scope > .tabs-content');
                const targetPane = contentContainer.querySelector(`#${tabId}`);

                // Nyahaktifkan semua link dan pane pada tahap yang sama
                link.closest('.tabs-nav').querySelectorAll('.tab-link').forEach(l => l.classList.remove('active'));
                contentContainer.querySelectorAll(':scope > .tab-pane').forEach(p => p.classList.remove('active'));

                // Aktifkan link yang diklik dan panel sasarannya
                link.classList.add('active');
                if (targetPane) {
                    targetPane.classList.add('active');

                    // Selepas mengaktifkan panel utama, semak jika ia mempunyai sub-tab.
                    const nestedTabs = targetPane.querySelector('.tabs-container');
                    if (nestedTabs) {
                        // Jika ada, cari pautan tab pertama dalam sub-tab itu.
                        const firstSubTabLink = nestedTabs.querySelector('.tabs-nav .tab-link');
                        if (firstSubTabLink) {
                            // Cetuskan klik pada pautan sub-tab pertama untuk mengaktifkannya.
                            firstSubTabLink.click();
                        }
                    }
                }
            });
        });

        // Pastikan tab pertama sentiasa aktif semasa permulaan
        if (tabLinks.length > 0 && !container.querySelector('.tabs-nav > .tab-link.active')) {
            tabLinks[0].click();
        }
    });
}