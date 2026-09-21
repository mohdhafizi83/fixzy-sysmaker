// js/ui/tabHandlers.js

export function initializeTabSystems() {
    // Find all tab containers in the document
    const allTabContainers = document.querySelectorAll('.tabs-container');

    allTabContainers.forEach(container => {
        // :scope ensures we only select direct children of this container
        const tabLinks = container.querySelectorAll(':scope > .tabs-nav > .tab-link');
        
        tabLinks.forEach(link => {
            link.addEventListener('click', () => {
                const tabId = link.dataset.tab;
                const contentContainer = container.querySelector(':scope > .tabs-content');
                const targetPane = contentContainer.querySelector(`#${tabId}`);

                // Deactivate all links and panes at the same level
                link.closest('.tabs-nav').querySelectorAll('.tab-link').forEach(l => l.classList.remove('active'));
                contentContainer.querySelectorAll(':scope > .tab-pane').forEach(p => p.classList.remove('active'));

                // Activate the clicked link and its target panel
                link.classList.add('active');
                if (targetPane) {
                    targetPane.classList.add('active');

                    // After activating the main panel, check whether it has sub-tabs.
                    const nestedTabs = targetPane.querySelector('.tabs-container');
                    if (nestedTabs) {
                        // If so, find the first tab link inside that sub-tab.
                        const firstSubTabLink = nestedTabs.querySelector('.tabs-nav .tab-link');
                        if (firstSubTabLink) {
                            // Fire a click on the first sub-tab link to activate it.
                            firstSubTabLink.click();
                        }
                    }
                }
            });
        });

        // Make sure the first tab is always active on startup
        if (tabLinks.length > 0 && !container.querySelector('.tabs-nav > .tab-link.active')) {
            tabLinks[0].click();
        }
    });
}