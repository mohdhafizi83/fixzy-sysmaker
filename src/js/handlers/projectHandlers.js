// src/js/handlers/projectHandlers.js

import { appState, setIsCoreLockingEnabled } from '../state.js';
import { SaveManager } from '../saveManager.js';
import { showCustomDialog } from '../ui/modalHandlers.js';
import { setElementValue, setRadioValue } from '../ui/formHelpers.js';
//import { loadProjectData } from '../../renderer.js'; // Follow the path you fixed earlier

export function initializeThemeHandlers() {
    const themeSelect = document.getElementById('app-theme-select');
    const viewModeRadios = document.querySelectorAll('input[name="view_mode"]');

    if (themeSelect) {
        themeSelect.addEventListener('change', updatePreviewImage);
    }

    viewModeRadios.forEach(radio => {
        radio.addEventListener('change', updatePreviewImage);
    });

    // Call once to set the correct image when the app loads
    updatePreviewImage();
}

export function initializeLocalizationHandlers() {
    const dateFormatSelect = document.getElementById('app-date-format');
    const timeFormatSelect = document.getElementById('app-time-format');
    const previewInput = document.getElementById('app-date-preview');

    if (!dateFormatSelect || !timeFormatSelect || !previewInput) {
        console.warn("Localization handler elements not found. Skipping initialization.");
        return;
    }

    const currentYear = new Date().getFullYear();
    
    // Options for the dropdown
    const dateFormats = [
        `31/12/${currentYear}`,
        `12/31/${currentYear}`,
        `${currentYear}-12-31`,
        `31 December ${currentYear}`,
        `31 Dec ${currentYear}`,
        `December 31, ${currentYear}`,
        `Dec 31, ${currentYear}`
    ];
    const timeFormats = [ '11:59 PM', '11:59:59 PM', '23:59', '23:59:59' ];

    // Populate the dropdown dynamically
    dateFormatSelect.innerHTML = dateFormats.map(f => `<option value="${f}">${f}</option>`).join('');
    timeFormatSelect.innerHTML = timeFormats.map(f => `<option value="${f}">${f}</option>`).join('');

    // Function to update the preview
    const updateDateTimePreview = () => {
        const selectedDate = dateFormatSelect.value;
        const selectedTime = timeFormatSelect.value;
        previewInput.value = `${selectedDate} ${selectedTime}`;
    };

    // Attach event listeners
    dateFormatSelect.addEventListener('change', updateDateTimePreview);
    timeFormatSelect.addEventListener('change', updateDateTimePreview);

    // Call once for the initial setting
    updateDateTimePreview();
}

export function initializeSecurityTabHandlers() {
    const openBrowserBtn = document.getElementById('open-browser-btn');
    const appUrlInput = document.getElementById('app-url');

    const hideLoginCheckbox = document.getElementById('app-hide_login');

    if (hideLoginCheckbox) {
        hideLoginCheckbox.addEventListener('change', () => {
            if (hideLoginCheckbox.checked) {
                const message = "This will hide the 'Sign in' links and any membership features from visitors. " +
                    "However, you might still need to log in to the admin area to set the desired " +
                    "permissions for anonymous users. This is necessary sometimes when visitors " +
                    "are unable to access some tables.";
                showCustomDialog({ title: "Important Note!", message: message });
            }
        });
    }
	
    if (!openBrowserBtn || !appUrlInput) {
        console.warn("Security tab elements not found. Skipping initialization.");
        return;
    }

    openBrowserBtn.addEventListener('click', () => {
        const url = appUrlInput.value.trim();

        // Make sure the URL isn't empty before trying to open it
        if (url) {
            // Call the function exposed by preload.js
            window.electronAPI.openUrl(url);
        } else {
                showCustomDialog({
                    title: "Input Error",
                    message: "Application URL is empty."
                });
        }
    });
}

export function initializeClassSelectorHandlers() {
    // Group for Table View
    const tvSelect = document.getElementById('table-view-classes-select');
    const tvInput = document.getElementById('tbl-table-view-classes-input');

    // Group for Detail View
    const dvSelect = document.getElementById('detail-view-classes-select');
    const dvInput = document.getElementById('tbl-detail-view-classes-input');

    if (tvSelect && tvInput) {
        tvSelect.addEventListener('change', () => {
            tvInput.value = tvSelect.value;
            // ▼▼▼ UPDATE: Fire the 'input' event manually ▼▼▼
            tvInput.dispatchEvent(new Event('input', { bubbles: true }));
            // ▲▲▲ END UPDATE ▲▲▲
        });
    }

    if (dvSelect && dvInput) {
        dvSelect.addEventListener('change', () => {
            dvInput.value = dvSelect.value;
            // ▼▼▼ UPDATE: Fire the 'input' event manually ▼▼▼
            dvInput.dispatchEvent(new Event('input', { bubbles: true }));
            // ▲▲▲ END UPDATE ▲▲▲
        });
    }
}

export async function populateProjectDropdown() {
    const projectListContainer = document.getElementById('project-menu-list');
    let newProjectBtn = document.getElementById('new-project-btn-dropdown');
    const newProjectModal = document.getElementById('new-project-modal');

    if (!projectListContainer || !newProjectBtn || !newProjectModal) return;

    projectListContainer.querySelectorAll('.project-item').forEach(item => item.remove());

    const projects = await window.electronAPI.getAllProjects();

    projects.forEach(project => {
        const projectLink = document.createElement('a');
        projectLink.href = '#';
        projectLink.textContent = project.app_title;
        projectLink.className = 'project-item';
        if (project.is_active) {
            projectLink.classList.add('active-project');
        }
        
        projectLink.addEventListener('click', async (e) => {
            e.preventDefault();
            const overlay = document.getElementById('loading-overlay');
            try {
                if (overlay) overlay.classList.remove('loading-overlay-hidden');

                const newActiveProject = await window.electronAPI.setActiveProject(project.project_id);
                if (newActiveProject) {
                    //await loadProjectData(newActiveProject);
                    await SaveManager.refreshState();
                }
            } catch (error) {
                console.error("Failed to switch project:", error);
                showCustomDialog({ title: "Error", message: `Failed to switch project: ${error.message}` });
            } finally {
                if (overlay) overlay.classList.add('loading-overlay-hidden');
            }
        });

        projectListContainer.appendChild(projectLink);
    });

    // Use the cloneNode method to remove all old event listeners from the button
    // before adding the new, up-to-date event listener.
    const newProjectBtnClone = newProjectBtn.cloneNode(true);
    newProjectBtn.parentNode.replaceChild(newProjectBtnClone, newProjectBtn);
    newProjectBtn = newProjectBtnClone; // Repoint the variable to the new clone

    newProjectBtn.addEventListener('click', (e) => {
        e.preventDefault();
        showNewProjectModal();
    });
}

export function updateActionButtonsState() {
    // Changed the search from the sidebar to #table-list
    const activeLink = document.querySelector('#table-list a.active');
    const newFieldBtn = document.getElementById('btn-new-field');
    const moveUpBtn = document.getElementById('btn-move-up');
    const moveDownBtn = document.getElementById('btn-move-down');
    const deleteBtn = document.getElementById('btn-delete');
    
    // Logic: only enable the Field, Up, Down, Delete buttons if an item is selected
    const isDisabled = !(activeLink && activeLink.closest('.submenu, .has-submenu'));
    
    if (newFieldBtn) newFieldBtn.disabled = isDisabled;
    if (moveUpBtn) moveUpBtn.disabled = isDisabled;
    if (moveDownBtn) moveDownBtn.disabled = isDisabled;
    if (deleteBtn) deleteBtn.disabled = isDisabled;
}

/**
 * Shows or hides the lock overlay on the settings form.
 * @param {('table'|'field')} pageType - Page type ('table' or 'field').
 * @param {boolean} isLocked - Set 'true' to lock, 'false' to unlock.
 * @param {string} [message] - Message to display when locked.
 */
export function applyFormLock(pageType, isLocked, message = '') {
    const pageId = `${pageType}-settings-page`;
    const overlay = document.querySelector(`#${pageId} .form-lock-overlay`);
    const messageEl = document.getElementById(`${pageType}-lock-message`);
    const mainContent = document.querySelector('.main-content'); // <-- Reference to the main content

    if (!overlay || !messageEl || !mainContent) return;

    if (isLocked) {
        messageEl.textContent = message;
        overlay.classList.remove('hidden');
        mainContent.classList.add('no-scroll'); // <-- Lock scrolling
    } else {
        overlay.classList.add('hidden');
        mainContent.classList.remove('no-scroll'); // <-- Unlock scrolling
    }
}

export function initializeStackSelectorHandlers() {
    const baseStackSelect = document.getElementById('app-stack_base');
    const detailGroups = document.querySelectorAll('.stack-detail-group');
    const descriptionContainer = document.getElementById('stack-description-container');

    // Object containing all descriptions
    const stackDescriptions = {
        'core_php': 'A foundational stack using native PHP, Bootstrap for styling, and jQuery for client-side scripting. Ideal for simple, fast-loading applications without a complex framework.',
        'laravel_filament': 'A powerful combination using the Laravel framework with the Filament admin panel, which is built on the modern TALL stack (Tailwind CSS, Alpine.js, Livewire, Laravel).',
        'laravel_backpack': 'Uses the robust Laravel framework paired with the Backpack for Laravel admin panel, which leverages the classic Bootstrap and jQuery ecosystem for rapid development.',
        'ci4': 'A modern, lightweight PHP framework. CodeIgniter 4 is known for its speed, small footprint, and clear documentation, making it great for building full-featured web applications.',
        'ci3': 'The legacy version of the popular CodeIgniter framework. It remains a stable and reliable choice for many existing applications and developers familiar with its architecture.',
        'appgini': 'A low-code development tool that generates PHP applications from a MySQL database, enabling extremely fast creation of data-driven web apps.',
        'wordpress': "The world's most popular content management system (CMS). Built on PHP and MySQL, it's highly extensible with a vast ecosystem of plugins and themes.",
        'django': 'A high-level Python web framework that encourages rapid development and clean, pragmatic design. It follows the "batteries-included" philosophy, providing most common functionalities out of the box.',
        'flask': 'A Python microframework that provides the essentials for web development, giving developers the flexibility to choose their own tools and libraries for other tasks.',
        'aspnet_core': 'A cross-platform, high-performance, open-source framework by Microsoft for building modern, cloud-based, and Internet-connected applications with C#.',
        'ror': 'A server-side web application framework written in Ruby. Rails follows the model–view–controller (MVC) pattern, emphasizing convention over configuration to increase developer productivity.',
        'java_spring': 'A powerful Java-based framework for creating stand-alone, production-grade web applications. It focuses on simplicity, productivity, and solving enterprise-level problems.',
        'java_struts': 'An open-source MVC framework for creating elegant, modern Java web applications. It favors convention over configuration and is known for its robustness in enterprise environments.',
        'mean': 'A full-stack JavaScript solution for building fast, robust web applications. It comprises MongoDB (database), Express.js (backend), Angular (frontend), and Node.js (runtime).',
        'mern': 'Similar to the MEAN stack, but with React as the frontend library instead of Angular. It is one of the most popular stacks for building modern single-page applications.',
        'mevn': 'Another variation of the popular JavaScript stack, using Vue.js as its frontend framework. Vue is known for its gentle learning curve and high performance.',
        'pern': 'A powerful alternative to the MERN/MEAN stack that replaces the NoSQL MongoDB database with the relational PostgreSQL database, ideal for applications requiring complex queries and data integrity.'
    };

    const updateStackDetails = () => {
        if (!baseStackSelect) return;

        const selectedOption = baseStackSelect.selectedOptions[0];
        if (!selectedOption) return;
        
        const selectedValue = selectedOption.value;
        const selectedGroup = selectedOption.dataset.stackGroup;
        
        // Update description text
        if (descriptionContainer) {
            descriptionContainer.innerHTML = stackDescriptions[selectedValue] || '';
        }
        
        // Hide all detail groups first
        detailGroups.forEach(group => group.style.display = 'none');

        // Then, show only the relevant ones
        detailGroups.forEach(group => {
            const refGroups = group.dataset.stackRef.split(' ');
            if (refGroups.includes(selectedGroup)) {
                group.style.display = 'block';
            }
        });

        // Rename the visible selects to be included in the save logic
        document.querySelectorAll('.app-stack-database, .app-stack-theme').forEach(select => {
            if (select.closest('.stack-detail-group').style.display !== 'none') {
                 if(select.classList.contains('app-stack-database')) select.id = 'app-stack-database';
                 if(select.classList.contains('app-stack-theme')) select.id = 'app-stack-theme';
            } else {
                select.id = ''; // Remove ID to exclude from saving
            }
        });
    };

    if (baseStackSelect) {
        baseStackSelect.addEventListener('change', updateStackDetails);
        // Initial call to set the correct view on load
        updateStackDetails();
    }
}

/**
 * Adds logic to radio buttons to allow them to be deselected.
 * A standard radio button group doesn't allow having no option selected once a selection is made.
 */
export function initializeAuthRadioLogic() {
    const radios = document.querySelectorAll('input[name="app-module-auth-extra"]');
    if (!radios) return;

    radios.forEach(radio => {
        // We need to store the state on "mousedown" because by the time "click" fires,
        // the state will have already changed.
        radio.addEventListener('mousedown', function() {
            // Store the current checked state in a temporary property.
            this.wasChecked = this.checked;
        });

        radio.addEventListener('click', function() {
            // If the radio was already checked when the user pressed the mouse,
            // uncheck it now.
            if (this.wasChecked) {
                this.checked = false;
                // Manually trigger the 'change' event so our auto-save system picks it up.
                this.dispatchEvent(new Event('change', { bubbles: true }));
            }
        });
    });
}

export function showNewProjectModal() {
    configureNewProjectModal('user-initiated'); // <-- ADD THIS LINE

    const modal = document.getElementById('new-project-modal');
    const input = document.getElementById('new-project-name');

    if (modal && input) {
        modal.classList.remove('hidden');
        setTimeout(() => {
            input.focus();
        }, 50);
    }
}

/**
 * Configures the 'New Project' modal based on the scenario.
 * @param {string} scenario - 'first-run' or 'user-initiated'.
 */
export function configureNewProjectModal(scenario) {
    const modal = document.getElementById('new-project-modal');
    if (!modal) return;

    const titleEl = modal.querySelector('.modal-header h3');
    const closeBtn = modal.querySelector('#new-project-modal-close');

    if (scenario === 'first-run') {
        if (titleEl) titleEl.textContent = 'Welcome! Please Create Your First Project';
        if (closeBtn) closeBtn.style.display = 'none'; // Hide the X button
    } else { // 'user-initiated'
        if (titleEl) titleEl.textContent = 'Create New Project';
        if (closeBtn) closeBtn.style.display = 'block'; // Show the X button
    }
}

/**
 * Shows the SQL import error troubleshooting guide modal.
 */
export function showImportErrorGuide() {
    const modal = document.getElementById('sql-import-error-modal');
    if (!modal) return;

    const okBtn = document.getElementById('sql-import-error-ok-btn');
    const closeModal = () => modal.classList.add('hidden');
    
    // Use cloneNode to make sure old event listeners are removed
    const newOkBtn = okBtn.cloneNode(true);
    okBtn.parentNode.replaceChild(newOkBtn, okBtn);
    newOkBtn.addEventListener('click', closeModal);
    
    modal.classList.remove('hidden');
}

function updatePreviewImage() {
    const themeSelect = document.getElementById('app-theme-select');
    const previewImage = document.getElementById('theme-preview-image');
    const selectedViewRadio = document.querySelector('input[name="view_mode"]:checked');

    // Make sure all elements exist
    if (!themeSelect || !previewImage || !selectedViewRadio) {
        console.warn("Theme preview elements not found.");
        return;
    }

    const theme = themeSelect.value; // e.g. "bootstrap", "darkly"
    const viewMode = selectedViewRadio.value === 'table_view' ? 'TV' : 'DV'; // Convert to 'TV' or 'DV'

    // Build the new image filename
    previewImage.src = `../assets/images/northwind-${theme}-${viewMode}.png`;
}

