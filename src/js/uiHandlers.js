// js/uiHandlers.js - VERSI LENGKAP & MUKTAMAD

import { allTableNames, jsonData } from './js.main.js';

// (Pastikan helper ini wujud di skop yang boleh diakses)
const setElementValue = (id, value) => {
    const element = document.getElementById(id);
    if (element) {
        if (element.type === 'checkbox' || element.type === 'radio') {
            element.checked = value === 1 || value === true;
        } else {
            element.value = value;
            // Secara paksa aktifkan elemen apabila datanya diisi
            element.disabled = false;
        }
    }
};

const setRadioValue = (name, value) => {
    const selector = `input[name="${name}"][value="${value}"]`;
    const element = document.querySelector(selector);
    if (element) {
        element.checked = true;
    }
};

// Pembolehubah untuk menjejaki kumpulan mana yang sedang diubah suai
let currentTargetMenuSelector = null;

/**
 * Mendapatkan senarai nama menu (jadual) yang telah digunakan dalam semua kumpulan.
 * @returns {string[]} Senarai nama menu yang telah digunakan.
 */
function getUsedMenuNames() {
    const usedTags = document.querySelectorAll('.menu-group-item .tag');
    // Ambil teks dari setiap tag dan buang butang 'x'
    return [...usedTags].map(tag => tag.childNodes[0].textContent.trim());
}

export function initializeMenuManagementHandlers() {
    const addGroupBtn = document.getElementById('app-add_menu_group');
    const menuGroupList = document.querySelector('.menu-group-list');
    const addMenuModal = document.getElementById('add-menu-modal');
    const availableMenusList = document.getElementById('available-menus-list');
    const modalCloseBtn = addMenuModal.querySelector('.modal-close');

    if (!addGroupBtn || !menuGroupList || !addMenuModal || !availableMenusList || !modalCloseBtn) {
        console.warn("Menu management elements not found. Skipping initialization.");
        return;
    }

    // 1. Logik untuk butang "Add Menu Group"
    addGroupBtn.addEventListener('click', () => {
        const newGroup = document.createElement('div');
        newGroup.className = 'menu-group-item';
        newGroup.innerHTML = `
            <input type="text" class="group-name-input" value="New Group">
            <div class="menu-selector">
                <button class="add-menu-btn" title="Add menu to this group">+</button>
            </div>
            <div class="group-actions">
                <button class="btn-sidebar-icon" title="Delete group">
                    <i class="fas fa-trash-alt"></i>
                </button>
            </div>
        `;
        menuGroupList.appendChild(newGroup);
    });

    // 2. Logik untuk butang '+' menggunakan event delegation
 menuGroupList.addEventListener('click', (event) => {
        const target = event.target;

        // Logik untuk butang '+'
        if (target.classList.contains('add-menu-btn')) {
            const usedNames = getUsedMenuNames();
            const availableTables = allTableNames.filter(name => !usedNames.includes(name));
            availableMenusList.innerHTML = '';
            availableTables.forEach(tableName => {
                const li = document.createElement('li');
                li.textContent = tableName;
                li.dataset.menuName = tableName;
                availableMenusList.appendChild(li);
            });
            currentTargetMenuSelector = target.parentElement;
            addMenuModal.classList.remove('hidden');
        }

        // Logik untuk padam tag (butang 'x')
        else if (target.classList.contains('remove-tag')) {
            // Dapatkan elemen 'tag' dan padamkannya
            const tagToRemove = target.closest('.tag');
            if (tagToRemove) {
                tagToRemove.remove();
            }
        }

        // Logik untuk padam kumpulan (ikon tong sampah)
        // Kita periksa sama ada ikon <i> atau butang <button> yang diklik
        else if (target.classList.contains('fa-trash-alt') || target.closest('.group-actions button')) {
            const groupToRemove = target.closest('.menu-group-item');
            if (groupToRemove && confirm('Are you sure you want to delete this menu group?')) {
                groupToRemove.remove();
            }
        }
    });

    // 3. Logik untuk memilih item dari modal
    availableMenusList.addEventListener('click', (event) => {
        if (event.target.tagName === 'LI') {
            const menuName = event.target.dataset.menuName;

            if (menuName && currentTargetMenuSelector) {
                // Cipta tag baharu
                const newTag = document.createElement('span');
                newTag.className = 'tag';
                newTag.innerHTML = `${menuName} <button class="remove-tag">&times;</button>`;

                // Masukkan tag baharu sebelum butang '+'
                const addBtn = currentTargetMenuSelector.querySelector('.add-menu-btn');
                currentTargetMenuSelector.insertBefore(newTag, addBtn);

                // Tutup modal dan reset target
                addMenuModal.classList.add('hidden');
                currentTargetMenuSelector = null;
            }
        }
    });

    // 4. Logik untuk menutup modal
    const closeModal = () => {
        addMenuModal.classList.add('hidden');
        currentTargetMenuSelector = null;
    };
    modalCloseBtn.addEventListener('click', closeModal);
    addMenuModal.addEventListener('click', (event) => {
        if (event.target === addMenuModal) {
            closeModal();
        }
    });
}
// =================================================================
// ▼▼▼ FUNGSI UNTUK MENGISI MODAL TETAPAN ▼▼▼
// =================================================================
async function populateSettingsModal() {
    const settings = await window.electronAPI.getAllSettings();
    if (!settings) {
        console.error("Tidak dapat memuatkan tetapan.");
        return;
    }

    const setValue = (id, value) => {
        const element = document.getElementById(id);
        if (element) {
            if (element.type === 'checkbox') {
                element.checked = value === '1';
            } else {
                element.value = value;
            }
        }
    };
    
    // General
    setValue('fizisys-check-updates', settings.check_updates);
    setValue('fizisys-autosave-interval', settings.autosave_interval);
    setValue('fizisys-show-begin-box', settings.show_begin_box);
    const iconSizeRadio = document.querySelector(`input[name="fizisys-icon-size"][value="${settings.icon_size}"]`);
    if (iconSizeRadio) iconSizeRadio.checked = true;
    setValue('fizisys-doc-root', settings.doc_root);
    setValue('fizisys-base-url', settings.base_url);
    // Field defaults
    setValue('fizisys-field-default-type', settings.field_default_type);
    setValue('fizisys-field-default-length', settings.field_default_length);
    // Table defaults
    setValue('fizisys-table-suggest-icon', settings.table_suggest_icon);
    setValue('fizisys-table-allow-csv', settings.table_allow_csv);
    setValue('fizisys-table-dv-separate-page', settings.table_dv_separate_page);
    setValue('fizisys-table-hide-save-as-copy', settings.table_hide_save_as_copy);
    setValue('fizisys-table-allow-add-from-homepage', settings.table_allow_add_from_homepage);
    setValue('fizisys-table-show-record-count', settings.table_show_record_count);
    // Project defaults
    setValue('fizisys-project-encoding', settings.project_encoding);
    setValue('fizisys-project-rtl', settings.project_rtl);
    setValue('fizisys-project-doxygen', settings.project_doxygen);
    setValue('fizisys-project-hide-footer', settings.project_hide_footer);
    setValue('fizisys-max-entries', settings.max_entries);
    setValue('fizisys-project-no-trim', settings.project_no_trim);
}


// =================================================================
// ▼▼▼ FUNGSI-FUNGSI UI YANG DIEKSPORT ▼▼▼
// =================================================================

export function updateActionButtonsState() {
    const activeLink = document.querySelector('.sidebar .nav-list a.active');
    const newFieldBtn = document.getElementById('btn-new-field');
    const moveUpBtn = document.getElementById('btn-move-up');
    const moveDownBtn = document.getElementById('btn-move-down');
    const deleteBtn = document.getElementById('btn-delete');
    const isDisabled = !(activeLink && activeLink.closest('.submenu'));
    if (newFieldBtn) newFieldBtn.disabled = isDisabled;
    if (moveUpBtn) moveUpBtn.disabled = isDisabled;
    if (moveDownBtn) moveDownBtn.disabled = isDisabled;
    if (deleteBtn) deleteBtn.disabled = isDisabled;
}

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

                    // ▼▼▼ KEMAS KINI UTAMA ADA DI SINI ▼▼▼
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

// ▼▼▼ FUNGSI-FUNGSI YANG HILANG SEBELUM INI KINI TELAH DIKEMBALIKAN ▼▼▼
export function populateSortByDropdown(tableName, elementId = 'tbl-default-sort-by') {
    const sortByDropdown = document.getElementById(elementId);
    if (!sortByDropdown || !jsonData) return;
    
    // Kosongkan senarai sedia ada
    sortByDropdown.innerHTML = (elementId === 'tbl-default-sort-by') ? '<option value="">None</option>' : '';
    
    const table = jsonData.database.table[tableName];
    if (table && table.fields) {
        for (const fieldName in table.fields) {
            const option = document.createElement('option');
            option.value = fieldName;
            option.textContent = fieldName;
            sortByDropdown.appendChild(option);
        }
    }
}

// js/uiHandlers.js

export function populateFocusFieldDropdown(tableName) {
    const defaultFocusDropdown = document.getElementById('tbl-default-focus');
    if (!defaultFocusDropdown || !jsonData) return;

    defaultFocusDropdown.innerHTML = ''; // Kosongkan senarai

    const table = jsonData.database.table[tableName];
    if (table && table.fields) {
        // ▼▼▼ KEMAS KINI UTAMA DI SINI ▼▼▼
        // 1. Dapatkan semua nama medan
        const allFieldNames = Object.keys(table.fields);

        // 2. Tapis untuk mendapatkan medan yang boleh disunting sahaja
        const editableFields = allFieldNames.filter(fieldName => {
            return table.fields[fieldName].read_only !== 1;
        });
        // ▲▲▲ TAMAT KEMAS KINI ▲▲▲

        const firstEditableField = editableFields.length > 0 ? editableFields[0] : '';
        
        defaultFocusDropdown.innerHTML = `<option value="${firstEditableField}">First editable field (${firstEditableField})</option><option value="__none__">Don't focus any field</option>`;
        
        // 3. Gunakan senarai yang telah ditapis untuk menjana opsyen
        editableFields.forEach(fieldName => {
            const option = document.createElement('option');
            option.value = fieldName;
            option.textContent = fieldName;
            defaultFocusDropdown.appendChild(option);
        });
    }
}

export function initializeModalHandlers() {
    const configBtn = document.getElementById('config-btn');
    const configModal = document.getElementById('config-modal');
    const configModalClose = document.getElementById('config-modal-close');
    
    // ▼▼▼ TAMBAH PENGISYTIHARAN INI ▼▼▼
    const configModalCancel = document.getElementById('config-modal-cancel');
    const configModalOk = document.getElementById('config-modal-ok');
    
    if (configBtn) {
        configBtn.addEventListener('click', async () => {
            await populateSettingsModal();
            configModal?.classList.remove('hidden');
        });
    }

    if (configModalClose) {
        configModalClose.addEventListener('click', () => {
            configModal?.classList.add('hidden');
        });
    }

    // ▼▼▼ TAMBAH DUA BLOK KOD INI ▼▼▼
    // Pengendali untuk butang 'Cancel'
    if (configModalCancel) {
        configModalCancel.addEventListener('click', () => {
            configModal?.classList.add('hidden');
        });
    }

    // Pengendali untuk butang 'OK'
    if (configModalOk) {
        configModalOk.addEventListener('click', () => {
            configModal?.classList.add('hidden');
        });
    }
    
    // Tambah pengendali modal lain jika perlu
}

export function initializeMediaTabHandlers() {
    const mediaRadios = document.querySelectorAll('input[name="fld-media-type"]');
    const allPanels = document.querySelectorAll('.media-options-panel');

    if (mediaRadios.length === 0) return;

    mediaRadios.forEach(radio => {
        radio.addEventListener('click', () => {
            // 1. Sembunyikan semua panel terlebih dahulu
            allPanels.forEach(panel => panel.classList.add('hidden'));

            // 2. Tentukan ID panel yang sepadan
            const radioValue = radio.value; // cth: "link", "image", "upload"
            let targetPanelId;

            // Kendalikan kes khas untuk 'File upload'
            if (radioValue === 'upload') {
                targetPanelId = 'file-upload-options-panel';
            } else {
                targetPanelId = `${radioValue}-options-panel`;
            }

            // 3. Cari dan paparkan panel sasaran
            const targetPanel = document.getElementById(targetPanelId);
            if (targetPanel) {
                targetPanel.classList.remove('hidden');
            }
        });
    });
}

/**
 * Memastikan tab Media mempunyai keadaan lalai yang bersih apabila dibuka.
 * Fungsi ini dipanggil dari sidebar.js apabila pengguna mengklik pada medan.
 */
export function setupMediaTab(tableName, fieldName) {
    // Isi dropdown 'The other field' untuk kedua-dua panel Link dan File
    populateOtherFieldDropdown(tableName, fieldName);
    populateFileOtherFieldDropdown(tableName, fieldName);

    // Sembunyikan panel bersyarat secara lalai
    const gmapDetails = document.getElementById('gmap-details');
    const youtubeDetails = document.getElementById('youtube-details');
    if (gmapDetails) gmapDetails.classList.add('hidden');
    if (youtubeDetails) youtubeDetails.classList.add('hidden');


    const linkRadio = document.getElementById('fld-media-link');
    const behaviorSelect = document.getElementById('fld-media-link-behavior');

    if (linkRadio) {
        linkRadio.checked = true;
        linkRadio.dispatchEvent(new Event('click'));
    }

    if (behaviorSelect) {
        behaviorSelect.dispatchEvent(new Event('change'));
    }
}

export function initializeOptionsListHandlers() {
    const quickListSelect = document.getElementById('options-quick-list');
    const valuesInput = document.getElementById('fld-options-list-values');

    if (quickListSelect && valuesInput) {
        quickListSelect.addEventListener('change', () => {
            if (quickListSelect.value) {
                valuesInput.value = quickListSelect.value;
            }
        });
    }
}

export function initializeLocalizationHandlers() {
    const dateOrderSelect = document.getElementById('app-date-order');
    const separatorSelect = document.getElementById('app-separator');
    const use24hrCheckbox = document.getElementById('app-use-24hr-format');
    const previewInput = document.getElementById('app-date-preview');

    // Pastikan semua elemen wujud sebelum meneruskan
    if (!dateOrderSelect || !separatorSelect || !use24hrCheckbox || !previewInput) {
        console.warn("Localization handler elements not found. Skipping initialization.");
        return;
    }

    const updateDateTimePreview = () => {
        const order = dateOrderSelect.value;
        const separator = separatorSelect.value;
        const is24hr = use24hrCheckbox.checked;

        // Gunakan tarikh dan masa yang tetap untuk pratonton
        const year = "2022";
        const month = "12";
        const day = "31";
        const time = is24hr ? "22:15" : "10:15 PM";

        let dateString;
        switch (order) {
            case 'ymd':
                dateString = `${year}${separator}${month}${separator}${day}`;
                break;
            case 'dmy':
                dateString = `${day}${separator}${month}${separator}${year}`;
                break;
            case 'mdy':
            default:
                dateString = `${month}${separator}${day}${separator}${year}`;
                break;
        }

        // Kemas kini nilai medan pratonton
        previewInput.value = `${dateString} ${time}`;
    };

    // Panggil fungsi apabila mana-mana kawalan diubah
    dateOrderSelect.addEventListener('change', updateDateTimePreview);
    separatorSelect.addEventListener('change', updateDateTimePreview);
    use24hrCheckbox.addEventListener('change', updateDateTimePreview);

    // Panggil sekali semasa muat untuk menetapkan nilai awal
    updateDateTimePreview();
}

export function updatePreviewImage() {
    const themeSelect = document.getElementById('app-theme-select');
    const previewImage = document.getElementById('theme-preview-image');
    const selectedViewRadio = document.querySelector('input[name="view_mode"]:checked');

    // Pastikan semua elemen wujud
    if (!themeSelect || !previewImage || !selectedViewRadio) {
        console.warn("Theme preview elements not found.");
        return;
    }

    const theme = themeSelect.value; // cth: "bootstrap", "darkly"
    const viewMode = selectedViewRadio.value === 'table_view' ? 'TV' : 'DV'; // Tukar kepada 'TV' atau 'DV'

    // Bina nama fail imej yang baharu
    previewImage.src = `images/northwind-${theme}-${viewMode}.png`;
}

export function initializeThemeHandlers() {
    const themeSelect = document.getElementById('app-theme-select');
    const viewModeRadios = document.querySelectorAll('input[name="view_mode"]');

    if (themeSelect) {
        themeSelect.addEventListener('change', updatePreviewImage);
    }

    viewModeRadios.forEach(radio => {
        radio.addEventListener('change', updatePreviewImage);
    });

    // Panggil sekali untuk tetapkan imej yang betul semasa aplikasi dimuatkan
    updatePreviewImage();
}

export function initializeSecurityTabHandlers() {
    const openBrowserBtn = document.getElementById('open-browser-btn');
    const appUrlInput = document.getElementById('app-url');

    if (!openBrowserBtn || !appUrlInput) {
        console.warn("Security tab elements not found. Skipping initialization.");
        return;
    }

    openBrowserBtn.addEventListener('click', () => {
        const url = appUrlInput.value.trim();

        // Pastikan URL tidak kosong sebelum cuba membukanya
        if (url) {
            // Panggil fungsi yang didedahkan oleh preload.js
            window.electronAPI.openUrl(url);
        } else {
            alert("Application URL is empty.");
        }
    });
}

export function initializeClassSelectorHandlers() {
    // Kumpulan untuk Table View
    const tvSelect = document.getElementById('table-view-classes-select');
    const tvInput = document.getElementById('tbl-table-view-classes-input');

    // Kumpulan untuk Detail View
    const dvSelect = document.getElementById('detail-view-classes-select');
    const dvInput = document.getElementById('tbl-detail-view-classes-input');

    if (tvSelect && tvInput) {
        tvSelect.addEventListener('change', () => {
            tvInput.value = tvSelect.value;
        });
    }

    if (dvSelect && dvInput) {
        dvSelect.addEventListener('change', () => {
            dvInput.value = dvSelect.value;
        });
    }
}

export function initializeAutoDefaultHandlers() {
    const autoDefaultBtn = document.getElementById('auto-default-btn');
    const autoDefaultModal = document.getElementById('auto-default-modal');
    const defaultValueInput = document.getElementById('fld-default-value');
    
    // Elemen di dalam modal
    const selectValue = document.getElementById('auto-default-select');
    const btnOk = document.getElementById('auto-default-ok');
    const btnCancel = document.getElementById('auto-default-cancel');
    const btnClose = document.getElementById('auto-default-close');

    // Pastikan semua elemen wujud
    if (!autoDefaultBtn || !autoDefaultModal || !defaultValueInput || !selectValue || !btnOk || !btnCancel || !btnClose) {
        console.warn("Auto-default handler elements not found. Skipping initialization.");
        return;
    }

    // Fungsi untuk menutup modal
    const closeModal = () => autoDefaultModal.classList.add('hidden');

    // 1. Apabila butang 'Auto >>' diklik, paparkan modal
    autoDefaultBtn.addEventListener('click', () => {
        autoDefaultModal.classList.remove('hidden');
    });

    // 2. Apabila butang 'Select' (OK) di dalam modal diklik
    btnOk.addEventListener('click', () => {
        // Salin nilai dari dropdown modal ke textbox 'Default'
        defaultValueInput.value = selectValue.value;
        // Tutup modal
        closeModal();
    });

    // 3. Sambungkan butang 'Cancel' dan 'X' untuk menutup modal
    btnCancel.addEventListener('click', closeModal);
    btnClose.addEventListener('click', closeModal);
}

export function initializeLinkOptionsHandlers() {
    const behaviorSelect = document.getElementById('fld-media-link-behavior');
    const displayAsGroup = document.getElementById('link-display-as-group');
    const displayAsSelect = document.getElementById('fld-media-link-display-as');
    const otherFieldGroup = document.getElementById('link-other-field-group');

    if (!behaviorSelect || !displayAsGroup || !displayAsSelect || !otherFieldGroup) {
        console.warn("Link options handler elements not found. Skipping initialization.");
        return;
    }

    // Listener untuk dropdown pertama: "Behavior..."
    behaviorSelect.addEventListener('change', () => {
        const value = behaviorSelect.value;
        if (value === 'web_link' || value === 'email_link') {
            displayAsGroup.classList.remove('hidden');
        } else {
            displayAsGroup.classList.add('hidden');
        }
        // Cetuskan 'change' pada dropdown kedua untuk memastikan keadaannya betul
        displayAsSelect.dispatchEvent(new Event('change'));
    });

    // Listener untuk dropdown kedua: "Display the link..."
    displayAsSelect.addEventListener('change', () => {
        // Hanya paparkan jika dropdown pertama membenarkannya
        if (!displayAsGroup.classList.contains('hidden') && displayAsSelect.value === 'other_field') {
            otherFieldGroup.classList.remove('hidden');
        } else {
            otherFieldGroup.classList.add('hidden');
        }
    });
}

function populateOtherFieldDropdown(tableName, currentFieldName) {
    const otherFieldSelect = document.getElementById('fld-media-link-other-field');
    if (!otherFieldSelect || !jsonData) return;

    // Kosongkan senarai sedia ada
    otherFieldSelect.innerHTML = '';

    const table = jsonData.database.table[tableName];
    if (table && table.fields) {
        // Dapatkan semua nama medan dan tapis keluar medan semasa
        const otherFields = Object.keys(table.fields).filter(f => f !== currentFieldName);

        otherFields.forEach(fieldName => {
            const option = document.createElement('option');
            option.value = fieldName;
            option.textContent = fieldName;
            otherFieldSelect.appendChild(option);
        });
    }
}

export function initializeImageOptionsHandlers() {
    const mainCheckbox = document.getElementById('fld-allow-image-uploads');
    const imageOptionsTabs = document.getElementById('image-options-tabs');

    const dependentControls = [
        document.getElementById('fld-max-file-size'),
        document.getElementById('fld-delete-image-server'),
        document.getElementById('fld-dont-rename-image'),
        document.getElementById('fld-tv-thumb-width'),
        document.getElementById('fld-tv-thumb-height'),
        document.getElementById('fld-tv-enable-zooming'),
        document.getElementById('fld-tv-show-full-size'),
        document.getElementById('fld-dv-thumb-width'),
        document.getElementById('fld-dv-thumb-height'),
        document.getElementById('fld-dv-enable-zooming'),
        document.getElementById('fld-dv-show-full-size')
    ];

    const tvShowFullSize = document.getElementById('fld-tv-show-full-size');
    const tvEnableZooming = document.getElementById('fld-tv-enable-zooming');
    const dvShowFullSize = document.getElementById('fld-dv-show-full-size');
    const dvEnableZooming = document.getElementById('fld-dv-enable-zooming');

    const toggleImageOptions = () => {
        const isEnabled = mainCheckbox.checked;
        imageOptionsTabs.classList.toggle('hidden', !isEnabled);
        dependentControls.forEach(control => {
            if (control) control.disabled = !isEnabled;
        });
        if(isEnabled) {
             handleZoomDependency();
        }
    };

    // ▼▼▼ KEMAS KINI FUNGSI INI ▼▼▼
    const handleZoomDependency = () => {
        if (tvShowFullSize && tvEnableZooming) {
            const isDisabled = tvShowFullSize.checked;
            tvEnableZooming.disabled = isDisabled;
            // Jika ia dinyahaktifkan, pastikan ia juga dinyah-tanda
            if (isDisabled) {
                tvEnableZooming.checked = false;
            }
        }
        if (dvShowFullSize && dvEnableZooming) {
            const isDisabled = dvShowFullSize.checked;
            dvEnableZooming.disabled = isDisabled;
            // Jika ia dinyahaktifkan, pastikan ia juga dinyah-tanda
            if (isDisabled) {
                dvEnableZooming.checked = false;
            }
        }
    };

    if (mainCheckbox) {
        mainCheckbox.addEventListener('change', toggleImageOptions);
    }
    if (tvShowFullSize) {
        tvShowFullSize.addEventListener('change', handleZoomDependency);
    }
    if (dvShowFullSize) {
        dvShowFullSize.addEventListener('change', handleZoomDependency);
    }
    
    if(mainCheckbox) {
        toggleImageOptions();
    }
}
function populateFileOtherFieldDropdown(tableName, currentFieldName) {
    const otherFieldSelect = document.getElementById('fld-file-other-field');
    if (!otherFieldSelect || !jsonData) return;

    otherFieldSelect.innerHTML = '';
    const table = jsonData.database.table[tableName];
    if (table && table.fields) {
        const otherFields = Object.keys(table.fields).filter(f => f !== currentFieldName);
        otherFields.forEach(fieldName => {
            const option = document.createElement('option');
            option.value = fieldName;
            option.textContent = fieldName;
            otherFieldSelect.appendChild(option);
        });
    }
}

export function initializeFileUploadOptionsHandlers() {
    // --- Bahagian 1: Logik Checkbox Utama ---
    const mainCheckbox = document.getElementById('fld-allow-file-uploads');
    const dependentControls = [
        document.getElementById('fld-file-types'),
        document.getElementById('fld-file-max-size'),
        document.getElementById('fld-delete-file-server'),
        document.getElementById('fld-dont-rename-file'),
        document.getElementById('fld-file-behavior'),
        document.getElementById('fld-file-display-as'),
        document.getElementById('fld-file-other-field')
    ];

    // --- Bahagian 2: Logik Dropdown Bersyarat ---
    const behaviorSelect = document.getElementById('fld-file-behavior');
    // Tetapkan 'Download link' sebagai nilai lalai
    if (behaviorSelect) {
        behaviorSelect.value = 'download_link';
    }
    const displayAsGroup = document.getElementById('fld-file-display-as-group');
    const displayAsSelect = document.getElementById('fld-file-display-as');
    const otherFieldGroup = document.getElementById('fld-file-other-field-group');

    const toggleAllOptions = () => {
        const isEnabled = mainCheckbox.checked;
        dependentControls.forEach(control => {
            if (control) control.disabled = !isEnabled;
        });
        // Cetuskan event pada dropdown untuk reset keadaan paparannya
        if (behaviorSelect) behaviorSelect.dispatchEvent(new Event('change'));
    };

    if (mainCheckbox) {
        mainCheckbox.addEventListener('change', toggleAllOptions);
    }

    // Pasang listener untuk dropdown bersyarat
    if (behaviorSelect) {
        behaviorSelect.addEventListener('change', () => {
            if (behaviorSelect.value === 'download_link') {
                displayAsGroup.classList.remove('hidden');
            } else {
                displayAsGroup.classList.add('hidden');
            }
            if (displayAsSelect) displayAsSelect.dispatchEvent(new Event('change'));
        });
    }

    if (displayAsSelect) {
        displayAsSelect.addEventListener('change', () => {
            if (!displayAsGroup.classList.contains('hidden') && displayAsSelect.value === 'other_field') {
                otherFieldGroup.classList.remove('hidden');
            } else {
                otherFieldGroup.classList.add('hidden');
            }
        });
    }

    // Tetapkan keadaan awal semasa muat
    if (mainCheckbox) {
        toggleAllOptions();
    }
}

export function initializeMediaVisibilityHandlers() {
    // --- Pengendali untuk Google Map ---
    const gmapCheckbox = document.getElementById('fld-display-gmap');
    const gmapDetails = document.getElementById('gmap-details');

    if (gmapCheckbox && gmapDetails) {
        gmapCheckbox.addEventListener('change', () => {
            gmapDetails.classList.toggle('hidden', !gmapCheckbox.checked);
        });
    }

    // --- Pengendali untuk YouTube Video ---
    const youtubeCheckbox = document.getElementById('fld-accept-video-url');
    const youtubeDetails = document.getElementById('youtube-details');

    if (youtubeCheckbox && youtubeDetails) {
        youtubeCheckbox.addEventListener('change', () => {
            youtubeDetails.classList.toggle('hidden', !youtubeCheckbox.checked);
        });
    }
}

// js/uiHandlers.js

// js/uiHandlers.js

export function populateParentChildTab(currentTableName) {
    const childList = document.getElementById('child-table-list');
    // Gunakan selector yang lebih kukuh untuk mencari kedua-dua panel
    const listPanel = childList.parentElement; 
    const optionsPanel = listPanel.nextElementSibling;

    const optionsTitle = document.getElementById('selected-child-table-name');
    const formElements = {
        showTab: document.getElementById('parentchild-show-tab'),
        showIcon: document.getElementById('parentchild-show-icon'),
        autocloseModal: document.getElementById('parentchild-autoclose-modal'),
        tabTitle: document.getElementById('parentchild-tab-title'),
        copyRecords: document.getElementById('parentchild-copy-records'),
        showLinkAbove: document.getElementById('parentchild-show-link-above'),
        showCount: document.getElementById('parentchild-show-count-in-tv'),
        allowAdd: document.getElementById('parentchild-allow-add-from-tv')
    };
    
    if (!childList || !jsonData.database.relationships || !optionsPanel) return;

    // Cari semua anak untuk jadual semasa
    const children = jsonData.database.relationships.filter(
        rel => rel.parent_table_name === currentTableName
    );

    // Kosongkan senarai
    childList.innerHTML = '';

    if (children.length === 0) {
        // KES 1: Tiada child table ditemui
        optionsPanel.classList.add('hidden'); // Sembunyikan panel borang
        const emptyMessage = `
            <div class="empty-state-label" style="padding: 1rem; text-align: left;">
                <p style="text-align: center; font-weight: 500;">This table has no child tables.</p>
                <span style="display: block; text-align: center; margin-top: 0.5rem; font-size: 0.85em;">
                    To create a relationship, select the foreign key field in the side menu and set the 'Parent table' in the 'Lookup field' tab.
                </span>
            </div>
        `;
        childList.innerHTML = emptyMessage;
    } else {
        // KES 2: Child table ditemui
        optionsPanel.classList.remove('hidden'); // PASTIKAN panel borang kelihatan

        Object.values(formElements).forEach(el => el.type === 'checkbox' ? el.checked = false : el.value = '');
        optionsTitle.textContent = '...';

        children.forEach(child => {
            const li = document.createElement('li');
            li.textContent = child.child_table_name;
            li.dataset.childName = child.child_table_name;
            childList.appendChild(li);
        });
        
        const populateForm = (childName) => {
            const relationData = children.find(c => c.child_table_name === childName);
            if (!relationData) return;
            optionsTitle.textContent = childName;
            formElements.showTab.checked = relationData.show_tab === 1;
            formElements.showIcon.checked = relationData.show_icon === 1;
            formElements.autocloseModal.checked = relationData.autoclose_modal === 1;
            formElements.tabTitle.value = relationData.tab_title || '';
            formElements.copyRecords.checked = relationData.copy_records === 1;
            formElements.showLinkAbove.checked = relationData.show_link_above === 1;
            formElements.showCount.checked = relationData.show_count_in_tv === 1;
            formElements.allowAdd.checked = relationData.allow_add_from_tv === 1;
        };

        // Elakkan menambah event listener berulang kali
        const newChildList = childList.cloneNode(true);
        childList.parentNode.replaceChild(newChildList, childList);

        newChildList.addEventListener('click', (event) => {
            if (event.target.tagName === 'LI') {
                newChildList.querySelectorAll('li').forEach(li => li.classList.remove('active'));
                event.target.classList.add('active');
                populateForm(event.target.dataset.childName);
            }
        });

        if (newChildList.firstChild) {
            newChildList.firstChild.click();
        }
    }
}

export function populateMainDashboard(projectData) {
    if (!projectData) {
        console.warn("Tiada data projek untuk dipaparkan di papan pemuka.");
        return;
    }

    // Tab: Localization
    setElementValue('app-title', projectData.app_title);
    setElementValue('app-date-order', projectData.date_order);
    setElementValue('app-separator', projectData.separator);
    setElementValue('app-char-encoding', projectData.char_encoding);
    setElementValue('app-language-select', projectData.language_select);
    setElementValue('app-timezone-select', projectData.timezone_select);
    setElementValue('app-use-24hr-format', projectData.use_24hr_format);
    setElementValue('app-enforce_mysql_encoding', projectData.enforce_mysql_encoding);
    
    // Tab: Theme
    setElementValue('app-theme-select', projectData.theme_select);
    setElementValue('app-use_3d_effects', projectData.use_3d_effects);
    setElementValue('app-rtl', projectData.rtl);
    setElementValue('app-compact', projectData.compact);
    
    // Tab: Menu management
    setRadioValue('app-menu_orientation', projectData.menu_orientation);
    setElementValue('app-menu_at_homepage', projectData.menu_at_homepage);
    setElementValue('app-tables-per-row', projectData.tables_per_row);
    setRadioValue('app-extra-wide', projectData.extra_wide);
    setElementValue('app-panel-height', projectData.panel_height);
    
    // Tab: Security & technical
    setElementValue('app-hide_login', projectData.hide_login);
    setElementValue('app-allow_sql_tool', projectData.allow_sql_tool);
    setElementValue('app-allow_server_status', projectData.allow_server_status);
    setElementValue('app-admins_group_access', projectData.admins_group_access);
    setElementValue('app-allow_table_view_sql', projectData.allow_table_view_sql);
    setElementValue('app-copy_children_async', projectData.copy_children_async);
    setElementValue('app-allow_pwa_install', projectData.allow_pwa_install);
    setElementValue('app-url', projectData.url);
    
    // Cetuskan event untuk kemas kini pratonton yang bergantung pada nilai ini
    document.getElementById('app-date-order')?.dispatchEvent(new Event('change'));
    document.getElementById('app-theme-select')?.dispatchEvent(new Event('change'));
}

export function populateTableSettings(tableName) {
	
	populateRecordOwnerDropdown(tableName);
		
    const tableData = jsonData.database.table[tableName];
    if (!tableData) {
        console.error(`Tiada data ditemui untuk jadual: ${tableName}`);
        return;
    }

    // Tab: Table view -> General
    setElementValue('tbl-table-view-title', tableData.table_view_title);
    setElementValue('tbl-table-description', tableData.table_description);

    // Tab: Table view -> Display & Data
    setElementValue('tbl-show-quick-search', tableData.show_quick_search);
    setElementValue('tbl-records-per-page', tableData.records_per_page);
    setElementValue('tbl-default-sort-by', tableData.default_sort_by);
    setElementValue('tbl-sort-descending', tableData.sort_descending);

    // Tab: Table view -> Permissions
    setElementValue('tbl-allow-sorting', tableData.allow_sorting);
    setElementValue('tbl-allow-filters', tableData.allow_filters);
    setElementValue('tbl-allow-csv-export', tableData.allow_csv_export);
    setElementValue('tbl-allow-print-view', tableData.allow_print_view);
    setElementValue('tbl-allow-user-save-filters', tableData.allow_user_save_filters);
    setElementValue('tbl-hide-homepage-link', tableData.hide_homepage_link);
    setElementValue('tbl-allow-mass-delete', tableData.allow_mass_delete);
    setElementValue('tbl-filter-before-view', tableData.filter_before_view);
    setElementValue('tbl-hide-nav-menu-link', tableData.hide_nav_menu_link);
    setElementValue('tbl-show-record-count', tableData.show_record_count);

    // Tab: Table view -> Template
    setElementValue('tbl-tv-template', tableData.tv_template);
    setElementValue('tbl-hide-field-captions', tableData.hide_field_captions);
    setElementValue('tbl-use-first-field-as-title', tableData.use_first_field_as_title);
    setElementValue('tbl-table-view-classes-input', tableData.table_view_classes_input);
    setElementValue('tbl-detail-view-classes-input', tableData.detail_view_classes_input);
    
    // Tab: Detail View -> General
    setElementValue('tbl-detail-view-title', tableData.detail_view_title);
    setElementValue('tbl-record-owner', tableData.record_owner);
    setElementValue('tbl-default-focus', tableData.default_focus);
    setElementValue('tbl-redirect-after-insert', tableData.redirect_after_insert);

    // Tab: Detail View -> Permissions
    setElementValue('tbl-enable-detail-view', tableData.enable_detail_view);
    setElementValue('tbl-delete-with-children', tableData.delete_with_children);
    setElementValue('tbl-dv-allow-print-view', tableData.dv_allow_print_view);
    setElementValue('tbl-dv-separate-page', tableData.dv_separate_page);
    setElementValue('tbl-dv-hide-save-as-copy', tableData.dv_hide_save_as_copy);
    setElementValue('tbl-dv-sticky-buttons', tableData.dv_sticky_buttons);
    setElementValue('tbl-dv-allow-add-from-homepage', tableData.dv_allow_add_from_homepage);
}

/**
 * Mengisi dropdown 'Parent table' dengan semua jadual lain dalam projek.
 * @param {string} currentTableName - Nama jadual semasa, untuk dikecualikan.
 */
function populateParentTableDropdown(currentTableName) {
    const parentTableSelect = document.getElementById('fld-lookup-parent-table');
    parentTableSelect.innerHTML = '<option value=""></option>'; // Kosongkan dan tambah opsyen lalai

    const otherTables = allTableNames.filter(name => name !== currentTableName);
    otherTables.forEach(tableName => {
        const option = document.createElement('option');
        option.value = tableName;
        option.textContent = tableName;
        parentTableSelect.appendChild(option);
    });
}

export function populateFieldSettings(tableName, fieldName) {
    const fieldData = jsonData.database.table[tableName]?.fields[fieldName];
    if (!fieldData) {
        console.error(`Tiada data ditemui untuk medan: ${tableName}.${fieldName}`);
        return;
    }
    populateParentTableDropdown(tableName);
    // Tab: General
    setElementValue('fld-caption', fieldData.caption);
    setElementValue('fld-description', fieldData.description);
    setElementValue('fld-data-type', fieldData.data_type);
    setElementValue('fld-length', fieldData.length);
	setElementValue('fld-precision', fieldData.precision);
    setElementValue('fld-max-chars-in-tv', fieldData.max_chars_in_tv);
    setElementValue('fld-alignment', fieldData.alignment);
    setElementValue('fld-default-value', fieldData.default_value);
    setElementValue('fld-read-only', fieldData.read_only);
    setElementValue('fld-primary-key', fieldData.primary_key);
    setElementValue('fld-zero-fill', fieldData.zero_fill);
    setElementValue('fld-required', fieldData.required);
    setElementValue('fld-rich-html', fieldData.rich_html);
    setElementValue('fld-auto-increment', fieldData.auto_increment);
    setElementValue('fld-unique', fieldData.unique);
    setElementValue('fld-show-sum', fieldData.show_sum);
    setElementValue('fld-text-area', fieldData.text_area);
    setElementValue('fld-unsigned', fieldData.unsigned);
    setElementValue('fld-no-filter', fieldData.no_filter);
    setElementValue('fld-binary', fieldData.binary);
    setElementValue('fld-check-box', fieldData.check_box);
    setElementValue('fld-hide-in-tv', fieldData.hide_in_tv);
    setElementValue('fld-hide-in-dv', fieldData.hide_in_dv);
    setElementValue('fld-enable-column-width', fieldData.enable_column_width);
    setElementValue('fld-column-width', fieldData.column_width);

    // Tab: Media
    // Tetapkan jenis media dan cetuskan 'click' untuk memaparkan panel yang betul
    const mediaType = fieldData.media_type || 'link'; // Lalai kepada 'link' jika tiada nilai
    setRadioValue('fld-media-type', mediaType);
    document.getElementById(`fld-media-${mediaType}`)?.dispatchEvent(new Event('click'));

    // Opsyen Link
    setElementValue('fld-media-link-behavior', fieldData.media_link_behavior);
    setElementValue('fld-media-link-display-as', fieldData.media_link_display_as);
    setElementValue('fld-media-link-other-field', fieldData.media_link_other_field);
    
    // Opsyen Imej
    setElementValue('fld-allow-image-uploads', fieldData.allow_image_uploads);
    setElementValue('fld-max-file-size', fieldData.max_file_size);
    setElementValue('fld-delete-image-server', fieldData.delete_image_server);
    setElementValue('fld-dont-rename-image', fieldData.dont_rename_image);
    setElementValue('fld-tv-thumb-width', fieldData.tv_thumb_width);
    setElementValue('fld-tv-thumb-height', fieldData.tv_thumb_height);
    setElementValue('fld-tv-enable-zooming', fieldData.tv_enable_zooming);
    setElementValue('fld-tv-show-full-size', fieldData.tv_show_full_size);
    setElementValue('fld-dv-thumb-width', fieldData.dv_thumb_width);
    setElementValue('fld-dv-thumb-height', fieldData.dv_thumb_height);
    setElementValue('fld-dv-enable-zooming', fieldData.dv_enable_zooming);
    setElementValue('fld-dv-show-full-size', fieldData.dv_show_full_size);

    // Cetuskan event untuk mengemas kini UI bersyarat (cth: enable/disable zooming)
    document.getElementById('fld-allow-image-uploads')?.dispatchEvent(new Event('change'));

    // Opsyen File Upload
    setElementValue('fld-allow-file-uploads', fieldData.allow_file_uploads);
    setElementValue('fld-file-types', fieldData.file_types);
    setElementValue('fld-file-max-size', fieldData.file_max_size);
    setElementValue('fld-delete-file-server', fieldData.delete_file_server);
    setElementValue('fld-dont-rename-file', fieldData.dont_rename_file);
    setElementValue('fld-file-behavior', fieldData.file_behavior);
    setElementValue('fld-file-display-as', fieldData.file_display_as);
    setElementValue('fld-file-other-field', fieldData.file_other_field);
    // Cetuskan event untuk mengemas kini UI bersyarat
    document.getElementById('fld-allow-file-uploads')?.dispatchEvent(new Event('change'));

    // Opsyen Google Map
    setElementValue('fld-display-gmap', fieldData.display_gmap);
    setRadioValue('fld-gmap-type', fieldData.gmap_type);
    setElementValue('fld-gmap-tv-width', fieldData.gmap_tv_width);
    setElementValue('fld-gmap-tv-height', fieldData.gmap_tv_height);
    setElementValue('fld-gmap-dv-height', fieldData.gmap_dv_height);
    // Cetuskan event untuk mengemas kini UI bersyarat
    document.getElementById('fld-display-gmap')?.dispatchEvent(new Event('change'));

    // Opsyen Youtube Video
    setElementValue('fld-accept-video-url', fieldData.accept_video_url);
    setElementValue('fld-youtube-tv-width', fieldData.youtube_tv_width);
    setElementValue('fld-youtube-tv-height', fieldData.youtube_tv_height);
    setElementValue('fld-youtube-dv-width', fieldData.youtube_dv_width);
    setElementValue('fld-youtube-dv-height', fieldData.youtube_dv_height);
    // Cetuskan event untuk mengemas kini UI bersyarat
    document.getElementById('fld-accept-video-url')?.dispatchEvent(new Event('change'));

    // Tab: Lookup field
    // 1. Tetapkan nilai yang disimpan untuk 'Parent table'
    setElementValue('fld-lookup-parent-table', fieldData.lookup_parent_table);
    

    // 2. Cetuskan event 'change' secara programatik
    const parentTableSelect = document.getElementById('fld-lookup-parent-table');
    if (parentTableSelect) {
        parentTableSelect.dispatchEvent(new Event('change'));
    }


    // 3. Sekarang, tetapkan nilai yang disimpan untuk dropdown 'caption'
    setElementValue('fld-lookup-caption-1', fieldData.lookup_caption_1);
    setElementValue('fld-lookup-separator', fieldData.lookup_separator);
    setElementValue('fld-lookup-caption-2', fieldData.lookup_caption_2);
    setRadioValue('fld-lookup-display-as', fieldData.lookup_display_as);
    setElementValue('fld-lookup-inherit-permissions', fieldData.lookup_inherit_permissions);
    setElementValue('fld-lookup-link-behavior', fieldData.lookup_link_behavior);

// Logik baharu untuk custom query
    setElementValue('fld-lookup-custom-query-hidden', fieldData.lookup_custom_query);

    // ▼▼▼ LOGIK PINTAR BAHARU UNTUK AUTO-DETECT FOREIGN KEY ▼▼▼
    // Hanya jalankan jika tiada 'Parent table' yang telah ditetapkan secara manual
    if (parentTableSelect && !parentTableSelect.value) {
        const relationship = jsonData.database.relationships.find(rel =>
            rel.child_table_name === tableName && rel.fk_child_field === fieldName
        );

        if (relationship) {
            const parentTable = relationship.parent_table_name;
            const parentPKField = relationship.parent_field;

            // 1. Tetapkan 'Parent table' secara automatik
            setElementValue('fld-lookup-parent-table', parentTable);
            parentTableSelect.dispatchEvent(new Event('change')); // Cetuskan untuk isi caption dropdown

            // 2. Cari medan seterusnya selepas Primary Key untuk dijadikan cadangan caption
            const parentTableFields = jsonData.database.table[parentTable]?.fields;
            if (parentTableFields) {
                const fieldNames = Object.keys(parentTableFields);
                const pkIndex = fieldNames.indexOf(parentPKField);

                // Pastikan PK ditemui dan ia bukan medan terakhir
                if (pkIndex > -1 && pkIndex < fieldNames.length - 1) {
                    const nextFieldName = fieldNames[pkIndex + 1];
                    setElementValue('fld-lookup-caption-1', nextFieldName);
                }
            }
        }
    }

    // Tab: Options list
    setElementValue('fld-options-list-values', fieldData.options_list_values);
    setRadioValue('fld-options-display', fieldData.options_display);

    // Tab: Data format
    setElementValue('fld-format-as', fieldData.format_as);

    // Tab: Calculated field
    setElementValue('fld-calculated-enable', fieldData.calculated_enable);
    setElementValue('fld-calculated-query', fieldData.calculated_query);
	
	applyDataTypeRules();
}

/**
 * Mengisi dropdown Parent Caption (Part 1 & 2) dengan senarai medan
 * dari jadual induk yang dipilih.
 * @param {string} parentTableName - Nama jadual induk yang dipilih.
 */
function populateParentCaptionDropdowns(parentTableName) {
    const caption1Select = document.getElementById('fld-lookup-caption-1');
    const caption2Select = document.getElementById('fld-lookup-caption-2');

    // Kosongkan kedua-dua dropdown
    caption1Select.innerHTML = '<option value=""></option>';
    caption2Select.innerHTML = '<option value=""></option>';

    if (parentTableName && jsonData.database.table[parentTableName]) {
        const parentFields = Object.keys(jsonData.database.table[parentTableName].fields);
        parentFields.forEach(fieldName => {
            const option1 = document.createElement('option');
            option1.value = fieldName;
            option1.textContent = fieldName;
            caption1Select.appendChild(option1);

            const option2 = document.createElement('option');
            option2.value = fieldName;
            option2.textContent = fieldName;
            caption2Select.appendChild(option2);
        });
    }
}

export function initializeLookupFieldHandlers() {
    const parentTableSelect = document.getElementById('fld-lookup-parent-table');

    if (parentTableSelect) {
        parentTableSelect.addEventListener('change', () => {
            const selectedTable = parentTableSelect.value;
            populateParentCaptionDropdowns(selectedTable);
        });
    }
}

export function populateMenuManagement(menuGroupsData) {
    const menuGroupList = document.querySelector('.menu-group-list');
    if (!menuGroupList) return;

    // Kosongkan senarai sedia ada
    menuGroupList.innerHTML = '';

    if (!menuGroupsData || menuGroupsData.length === 0) {
        // Jika tiada data, paparkan mesej
        const emptyMessage = `
            <div class="empty-state-label">
                <p>Tiada kumpulan menu dicipta.</p>
                <span>Klik butang 'Add Menu Group' untuk bermula.</span>
            </div>
        `;
        menuGroupList.innerHTML = emptyMessage;
        return;
    }

    // Bina setiap baris kumpulan menu
    menuGroupsData.forEach(group => {
        // Bina HTML untuk setiap tag menu di dalam kumpulan
        const tagsHtml = group.items.map(item => `
            <span class="tag">${item.table_name} <button class="remove-tag">&times;</button></span>
        `).join('');

        const groupElement = document.createElement('div');
        groupElement.className = 'menu-group-item';
        groupElement.innerHTML = `
            <input type="text" class="group-name-input" value="${group.group_name}">
            <div class="menu-selector">
                ${tagsHtml}
                <button class="add-menu-btn" title="Add menu to this group">+</button>
            </div>
            <div class="group-actions">
                <button class="btn-sidebar-icon" title="Delete group">
                    <i class="fas fa-trash-alt"></i>
                </button>
            </div>
        `;
        menuGroupList.appendChild(groupElement);
    });
}

// js/uiHandlers.js

// Fungsi bantuan untuk menjana query lalai
function generateDefaultLookupQuery() {
    const parentTable = document.getElementById('fld-lookup-parent-table').value;
    const caption1 = document.getElementById('fld-lookup-caption-1').value;
    const caption2 = document.getElementById('fld-lookup-caption-2').value;
    const separator = document.getElementById('fld-lookup-separator').value;

    if (!parentTable || !caption1) return '';

    let captionFields = `\`${parentTable}\`.\`${caption1}\``;
    if (caption2 && separator) {
        captionFields = `CONCAT(${captionFields}, '${separator}', \`${parentTable}\`.\`${caption2}\`)`;
    }

    // Dapatkan Primary Key dari jadual induk
    const parentTableData = jsonData.database.table[parentTable];
    const pkField = Object.keys(parentTableData.fields).find(f => parentTableData.fields[f].primary_key) || 'id';

    return `SELECT \`${parentTable}\`.\`${pkField}\`, ${captionFields} FROM \`${parentTable}\` ORDER BY 2`;
}

export function initializeAdvancedLookupHandlers() {
    const modal = document.getElementById('advanced-lookup-modal');
    const openBtn = document.getElementById('fld-lookup-advanced-btn');
    const closeBtn = document.getElementById('advanced-lookup-modal-close');
    const okBtn = document.getElementById('advanced-lookup-ok-btn');
    const cancelBtn = document.getElementById('advanced-lookup-cancel-btn');
    const resetBtn = document.getElementById('advanced-lookup-reset-btn');
    const queryTextarea = document.getElementById('fld-lookup-custom-query');
    const hiddenQueryInput = document.getElementById('fld-lookup-custom-query-hidden');

    const openModal = () => {
        let currentQuery = hiddenQueryInput.value;
        if (!currentQuery) {
            currentQuery = generateDefaultLookupQuery();
        }
        queryTextarea.value = currentQuery;
        modal.classList.remove('hidden');
    };

    const closeModal = () => modal.classList.add('hidden');

    const saveAndClose = () => {
        hiddenQueryInput.value = queryTextarea.value;
        closeModal();
    };

    openBtn.addEventListener('click', openModal);
    closeBtn.addEventListener('click', closeModal);
    cancelBtn.addEventListener('click', closeModal);
    okBtn.addEventListener('click', saveAndClose);
    resetBtn.addEventListener('click', () => {
        queryTextarea.value = generateDefaultLookupQuery();
    });
}

export function initializeHomepageMenuHandlers() {
    const menuAtHomepageCheckbox = document.getElementById('app-menu_at_homepage');
    const dependentOptions = document.querySelectorAll('.homepage-menu-option');

    if (!menuAtHomepageCheckbox || dependentOptions.length === 0) return;

    const toggleOptionsVisibility = () => {
        const isChecked = menuAtHomepageCheckbox.checked;
        dependentOptions.forEach(option => {
            // Gunakan style.display untuk kawalan terus
            option.style.display = isChecked ? '' : 'none';
        });
    };

    // Tambah listener pada checkbox
    menuAtHomepageCheckbox.addEventListener('change', toggleOptionsVisibility);

    // Panggil sekali semasa muat untuk menetapkan keadaan awal yang betul
    toggleOptionsVisibility();
}

// js/uiHandlers.js

// Fungsi ini akan dipanggil dari populateFieldSettings juga, jadi kita letakkan di luar
function applyDataTypeRules() {
    const dataTypeSelect = document.getElementById('fld-data-type');
    if (!dataTypeSelect) return;

    const selectedType = dataTypeSelect.value;

    // Kumpulkan semua elemen yang akan dikawal
    const elements = {
        precision: document.getElementById('fld-precision'),
        autoIncrement: document.getElementById('fld-auto-increment'),
        unsigned: document.getElementById('fld-unsigned'),
        zeroFill: document.getElementById('fld-zero-fill'),
        showSum: document.getElementById('fld-show-sum'),
        binary: document.getElementById('fld-binary'),
        mediaRadios: document.querySelectorAll('input[name="fld-media-type"]'),
        behaviorOptions: document.querySelectorAll('#fld-media-link-behavior option[value="web_link"], #fld-media-link-behavior option[value="email_link"]')
    };

    // 1. Reset: Aktifkan semua elemen secara lalai
    Object.values(elements).forEach(el => {
        if (el.forEach) { // Untuk NodeList seperti radio dan options
            el.forEach(item => {
                item.disabled = false;
                item.hidden = false;
            });
        } else if (el) { // Untuk elemen tunggal
            el.disabled = false;
        }
    });

    // 2. Kumpulan Data Type
    const numericAndDate = ['TINYINT', 'SMALLINT', 'MEDIUMINT', 'INT', 'BIGINT', 'FLOAT', 'DOUBLE', 'DECIMAL', 'DATE', 'DATETIME', 'TIMESTAMP', 'TIME', 'YEAR'];
    const integerOnly = ['TINYINT', 'SMALLINT', 'MEDIUMINT', 'INT', 'BIGINT'];
    const floatOnly = ['FLOAT', 'DOUBLE', 'DECIMAL'];
    const dateOnly = ['DATE', 'DATETIME', 'TIMESTAMP', 'TIME', 'YEAR'];
    const binaryString = ['CHAR', 'VARCHAR', 'TINYBLOB', 'BLOB', 'MEDIUMBLOB', 'LONGBLOB'];
    const textOnly = ['TINYTEXT', 'TEXT', 'MEDIUMTEXT', 'LONGTEXT'];

    // 3. Laksanakan Peraturan
    if (numericAndDate.includes(selectedType)) {
        elements.mediaRadios.forEach(radio => { if (radio.value !== 'link') radio.disabled = true; });
        elements.behaviorOptions.forEach(opt => opt.hidden = true);
    }
    if (integerOnly.includes(selectedType)) {
        if (elements.binary) elements.binary.disabled = true;
        if (elements.precision) elements.precision.disabled = true;
    }
    if (floatOnly.includes(selectedType)) {
        if (elements.binary) elements.binary.disabled = true;
        if (elements.autoIncrement) elements.autoIncrement.disabled = true;
        if (elements.precision) elements.precision.disabled = false; // Pastikan ia enabled
    }
    if (dateOnly.includes(selectedType)) {
        if (elements.autoIncrement) elements.autoIncrement.disabled = true;
        if (elements.unsigned) elements.unsigned.disabled = true;
        if (elements.zeroFill) elements.zeroFill.disabled = true;
        if (elements.showSum) elements.showSum.disabled = true;
        if (elements.binary) elements.binary.disabled = true;
        if (elements.precision) elements.precision.disabled = true;
    }
    if (binaryString.includes(selectedType) || textOnly.includes(selectedType)) {
        if (elements.autoIncrement) elements.autoIncrement.disabled = true;
        if (elements.unsigned) elements.unsigned.disabled = true;
        if (elements.zeroFill) elements.zeroFill.disabled = true;
        if (elements.showSum) elements.showSum.disabled = true;
        if (elements.precision) elements.precision.disabled = true;
    }
     if (binaryString.includes(selectedType)) {
         if (elements.binary) elements.binary.disabled = true;
     }
}

export function initializeDataTypeRules() {
    const dataTypeSelect = document.getElementById('fld-data-type');
    if (dataTypeSelect) {
        dataTypeSelect.addEventListener('change', applyDataTypeRules);
    }
}

// js/uiHandlers.js

function populateRecordOwnerDropdown(tableName) {
    const recordOwnerDropdown = document.getElementById('tbl-record-owner');
    if (!recordOwnerDropdown || !jsonData) return;

    // Kosongkan opsyen sedia ada
    recordOwnerDropdown.innerHTML = '';

    // 1. Tambah opsyen lalai
    const defaultOption = document.createElement('option');
    defaultOption.value = ''; // Nilai kosong untuk 'Current user'
    defaultOption.textContent = 'Current user (default)';
    recordOwnerDropdown.appendChild(defaultOption);

    // ▼▼▼ LOGIK YANG DIPERBAIKI ▼▼▼
    // 2. Cari dan tambah semua medan kunci asing (foreign key) berdasarkan data hubungan
    const relationships = jsonData.database.relationships || [];
    
    relationships.forEach(rel => {
        // Cari hubungan di mana jadual semasa adalah JADUAL ANAK (child)
        if (rel.child_table_name === tableName) {
            const fkFieldName = rel.fk_child_field;
            
            const lookupOption = document.createElement('option');
            lookupOption.value = fkFieldName;
            lookupOption.textContent = fkFieldName;
            recordOwnerDropdown.appendChild(lookupOption);
        }
    });
    // ▲▲▲ TAMAT LOGIK YANG DIPERBAIKI ▲▲▲
}

// js/uiHandlers.js

export function initializeFormDisplayRules() {
    // Kenal pasti ID checkbox yang eksklusif
    const exclusiveCheckboxIds = [
        'fld-text-area',    // Text area
        'fld-rich-html',    // Rich (HTML) area
        'fld-check-box'     // Check box
    ];

    const checkboxElements = exclusiveCheckboxIds.map(id => document.getElementById(id));

    // Tambah event listener pada setiap checkbox
    checkboxElements.forEach(checkbox => {
        if (!checkbox) return; // Langkau jika elemen tidak wujud

        checkbox.addEventListener('change', (event) => {
            const currentCheckbox = event.target;

            // Jika checkbox ini baru sahaja ditanda (checked)
            if (currentCheckbox.checked) {
                // Nyahtanda (uncheck) semua checkbox lain dalam kumpulan ini
                checkboxElements.forEach(otherCheckbox => {
                    if (otherCheckbox !== currentCheckbox) {
                        otherCheckbox.checked = false;
                    }
                });
            }
        });
    });
}

export function initializeCheckboxExclusivity() {
    const autoIncrementCheckbox = document.getElementById('fld-auto-increment');
    const requiredCheckbox = document.getElementById('fld-required');
    const primaryKeyCheckbox = document.getElementById('fld-primary-key');
    const readOnlyCheckbox = document.getElementById('fld-read-only'); // Dapatkan checkbox Read Only

    if (!autoIncrementCheckbox || !requiredCheckbox || !primaryKeyCheckbox || !readOnlyCheckbox) return;

    // Tindakan 1: Apabila pengguna memilih 'Auto Increment'
    autoIncrementCheckbox.addEventListener('change', () => {
        if (autoIncrementCheckbox.checked) {
            // Jika 'Auto Increment' ditanda, nyahtanda 'Required' dan tanda 'Read Only'
            requiredCheckbox.checked = false;
            readOnlyCheckbox.checked = true; // <-- TAMBAHAN BAHARU
        }
    });

    // Tindakan 2: Apabila pengguna memilih 'Required'
    requiredCheckbox.addEventListener('change', () => {
        // Hanya paparkan amaran jika 'Required' ditanda DAN 'Auto Increment' sedang aktif.
        if (requiredCheckbox.checked && autoIncrementCheckbox.checked) {
            
            let message = "Changing this option will disable 'Auto Increment'.\n\n";
            message += "- Auto Increment: The value is provided automatically by the database.\n";
            message += "- Required: The value must be provided manually by the user.\n\n";

            const isPrimaryKey = primaryKeyCheckbox.checked;
            if (isPrimaryKey) {
                message += "Recommendation: A Primary Key field should remain 'Auto Increment'.\n\n";
            }

            message += "Are you sure you want to switch to 'Required'?";

            const userConfirmed = confirm(message);

            if (userConfirmed) {
                autoIncrementCheckbox.checked = false;
            } else {
                requiredCheckbox.checked = false;
            }
        }
    });
	
    // Tindakan 3: Apabila pengguna cuba mengubah 'Read Only'
    readOnlyCheckbox.addEventListener('change', () => {
        // Jika pengguna cuba nyahtanda 'Read Only'...
        if (!readOnlyCheckbox.checked) {
            // ...ketika 'Auto Increment' sedang ditanda...
            if (autoIncrementCheckbox.checked) {
                // Paparkan amaran dan batalkan perubahan
                alert("A field with 'Auto Increment' must remain 'Read Only'.");
                readOnlyCheckbox.checked = true;
            }
        }
    });
}

// js/uiHandlers.js

export function initializePrimaryKeyHandlers() {
    const primaryKeyCheckbox = document.getElementById('fld-primary-key');
    const autoIncrementCheckbox = document.getElementById('fld-auto-increment');

    if (!primaryKeyCheckbox || !autoIncrementCheckbox) return;

    // Listener untuk Primary Key
    primaryKeyCheckbox.addEventListener('change', () => {
        // Hanya paparkan amaran jika pengguna cuba NYAH-TANDA
        if (!primaryKeyCheckbox.checked) {
            const message = "Warning: Changing a Primary Key can affect table relationships and data integrity.\n\nAre you sure you want to proceed?";
            const userConfirmed = confirm(message);

            // Jika pengguna batal, tandakan semula checkbox tersebut
            if (!userConfirmed) {
                primaryKeyCheckbox.checked = true;
            }
        }
    });

    // Listener untuk Auto Increment
    autoIncrementCheckbox.addEventListener('change', () => {
        // Hanya paparkan amaran jika pengguna cuba NYAH-TANDA
        if (!autoIncrementCheckbox.checked) {
            const message = "Warning: Disabling Auto Increment on a key field requires you to manage unique values manually, which can lead to data errors.\n\nAre you sure you want to disable it?";
            const userConfirmed = confirm(message);

            // Jika pengguna batal, tandakan semula checkbox tersebut
            if (!userConfirmed) {
                autoIncrementCheckbox.checked = true;
            }
        }
    });
}