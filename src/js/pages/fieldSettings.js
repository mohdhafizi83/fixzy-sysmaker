// js/pages/fieldSettings.js

import { setElementValue, setRadioValue } from '../ui/formHelpers.js';
import { appState } from '../state.js';
import { SaveManager } from '../../renderer.js';
import { initializeValidationInputHandlers } from '../features/validation.js';
import { 
    populateParentTableDropdown,
    populateParentCaptionDropdowns,
    populateOtherFieldDropdown,
    populateFileOtherFieldDropdown,
    applyDataTypeRules,
    loadValidationTab 
} from '../uiHandlers.js';

export function populateFieldSettings(tableName, fieldName) {

    const maxLengthInput = document.getElementById('fld-max-length');
    if (maxLengthInput) maxLengthInput.dataset.userModified = 'false';
    	
    const allFieldPageControls = document.querySelectorAll(
        '#field-settings-page input, #field-settings-page select, #field-settings-page textarea, #field-settings-page button'
    );
    allFieldPageControls.forEach(control => {
        control.disabled = false;
    });
	
    const fieldData = appState.jsonData.database.table[tableName]?.fields[fieldName];

    if (!fieldData) {
        console.error(`Tiada data ditemui untuk medan: ${tableName}.${fieldName}`);
        return;
    }
    populateParentTableDropdown(tableName);
	
	setElementValue('fld-field-name', fieldData.field_name);
    setElementValue('fld-caption', fieldData.caption);
    setElementValue('fld-description', fieldData.description);
    setElementValue('fld-data-type', fieldData.data_type);
    setElementValue('fld-length', fieldData.length);
    
    const lengthInput = document.getElementById('fld-length');
    if (lengthInput) {
        lengthInput.dispatchEvent(new Event('input', { bubbles: true }));
    }
    
	setElementValue('fld-precision', fieldData.precision);
    setElementValue('fld-alignment', fieldData.alignment);
    setElementValue('fld-default-value', fieldData.default_value);
    
    setElementValue('fld-read-only', fieldData.read_only);
    
    setElementValue('fld-helper-text', fieldData.helper_text);
    setElementValue('fld-placeholder', fieldData.placeholder);
    setElementValue('fld-min-length', fieldData.min_length);
    // Jika max_length tiada nilai (cth: selepas import SQL), guna nilai length sebagai lalai.
    // Jika ada, guna nilai yang disimpan.
const maxLengthValue = fieldData.length;
    setElementValue('fld-max-length', maxLengthValue);
    setElementValue('fld-min-value', fieldData.min_value);
    setElementValue('fld-max-value', fieldData.max_value);
    setElementValue('fld-off-autocomplete', fieldData.off_autocomplete);
    setElementValue('fld-column-span-full', fieldData.column_span_full);
    
    setElementValue('fld-prefix', fieldData.prefix);
    setElementValue('fld-suffix', fieldData.suffix);
    setElementValue('fld-suffix-icon', fieldData.suffix_icon);
    setElementValue('fld-suffix-icon-color', fieldData.suffix_icon_color);
    
    setElementValue('fld-primary-key', fieldData.primary_key);
    setElementValue('fld-zero-fill', fieldData.zero_fill);
    setElementValue('fld-required', fieldData.required);
    setElementValue('fld-auto-increment', fieldData.auto_increment);
    setElementValue('fld-unique', fieldData.unique);
    setElementValue('fld-not-null', fieldData.not_null);
    setElementValue('fld-is-indexed', fieldData.is_indexed);
    setElementValue('fld-show-sum', fieldData.show_sum);
    setElementValue('fld-show-avg-summary', fieldData.show_avg_summary);
    setElementValue('fld-show-count-summary', fieldData.show_count_summary);
    setElementValue('fld-show-range-summary', fieldData.show_range_summary);
    setElementValue('fld-allow-sorting', fieldData.allow_sorting);
    setElementValue('fld-unsigned', fieldData.unsigned);
    setElementValue('fld-binary', fieldData.binary);
    setElementValue('fld-hide-in-tv', fieldData.hide_in_tv);
    setElementValue('fld-editable-in-tv', fieldData.editable_in_tv);
    setElementValue('fld-hide-in-dv', fieldData.hide_in_dv);
    setElementValue('fld-enable-global-filter', fieldData.enable_global_filter);
    setElementValue('fld-enable-individual-filter', fieldData.enable_individual_filter);
    setElementValue('fld-enable-range-filter', fieldData.enable_range_filter);
    setRadioValue('fld-display-type', fieldData.display_type || 'text_input');

    setElementValue('fld-tv-wrap-header', fieldData.tv_wrap_header);
    setElementValue('fld-tv-wrap-text', fieldData.tv_wrap_text);
    setElementValue('fld-tv-enable-toggle', fieldData.tv_enable_toggle);
    setElementValue('fld-tv-description-tooltips', fieldData.tv_description_tooltips);
    setElementValue('fld-tv-text-limit', fieldData.tv_text_limit);
    setElementValue('fld-tv-text-size', fieldData.tv_text_size);
    setElementValue('fld-tv-font-weight', fieldData.tv_font_weight);
    setElementValue('fld-tv-date-time-format', fieldData.tv_date_time_format);
    setElementValue('fld-tv-currency-code', fieldData.tv_currency_code);
    setElementValue('fld-tv-alignment', fieldData.tv_alignment);
    setElementValue('fld-tv-text-color', fieldData.tv_text_color);
    setElementValue('fld-tv-icon', fieldData.tv_icon);
    setElementValue('fld-tv-icon-color', fieldData.tv_icon_color);

    setElementValue('fld-lookup-parent-table', fieldData.lookup_parent_table);
    populateParentCaptionDropdowns(fieldData.lookup_parent_table);
    const parentTableSelect = document.getElementById('fld-lookup-parent-table');

    const updateAllFieldDependencies = () => {
        const isForeignKey = parentTableSelect.value !== '';
        const mediaType = document.querySelector('input[name="fld-media-type"]:checked').value;
        const isNotLinkType = mediaType !== 'link';
        const isImageType = mediaType === 'image';

        const elementsToControl = {
            displayAsGroup: document.getElementById('display-as-group'),
            optionsListSettings: document.getElementById('options-list-settings-group'),
            formatAsGroup: document.getElementById('format-as-group'),
            allowSorting: document.getElementById('fld-allow-sorting-group'),
            globalFilter: document.getElementById('fld-enable-global-filter-group'),
            individualFilter: document.getElementById('fld-enable-individual-filter-group'),
            rangeFilter: document.getElementById('fld-enable-range-filter-group'),
            showSum: document.getElementById('fld-show-sum-group'),
            showAvg: document.getElementById('fld-show-avg-summary-group'),
            showCount: document.getElementById('fld-show-count-summary-group'),
            showRange: document.getElementById('fld-show-range-summary-group'),
            wrapText: document.getElementById('fld-tv-wrap-text-group'),
            textLimit: document.getElementById('fld-tv-text-limit-group'),
            textSize: document.getElementById('fld-tv-text-size-group'),
            fontWeight: document.getElementById('fld-tv-font-weight-group'),
            textColor: document.getElementById('fld-tv-text-color-group'),
            // ▼▼▼ TAMBAHAN BAHARU DI SINI ▼▼▼
            iconGroup: document.getElementById('fld-tv-icon-group'),
            iconColorGroup: document.getElementById('fld-tv-icon-color-group')
        };

        const shouldHideDisplayGroups = isForeignKey || isNotLinkType;
        elementsToControl.displayAsGroup.classList.toggle('hidden', shouldHideDisplayGroups);
        elementsToControl.optionsListSettings.classList.toggle('hidden', shouldHideDisplayGroups);
        elementsToControl.formatAsGroup.classList.toggle('hidden', shouldHideDisplayGroups);

        const otherElementsToHide = [
            elementsToControl.allowSorting, elementsToControl.globalFilter, elementsToControl.individualFilter,
            elementsToControl.rangeFilter, elementsToControl.showSum, elementsToControl.showAvg, elementsToControl.showCount, elementsToControl.showRange, elementsToControl.wrapText,
            elementsToControl.textLimit, elementsToControl.textSize, elementsToControl.fontWeight, elementsToControl.textColor
        ];
        otherElementsToHide.forEach(el => {
            if (el) el.classList.toggle('hidden', isNotLinkType);
        });
        
        // ▼▼▼ PERUBAHAN DI SINI: Blok logik khas untuk 'Icon' dan 'Icon color' ▼▼▼
        if (elementsToControl.iconGroup) {
            elementsToControl.iconGroup.classList.toggle('hidden', isImageType);
        }
        if (elementsToControl.iconColorGroup) {
            elementsToControl.iconColorGroup.classList.toggle('hidden', isImageType);
        }
        // ▲▲▲ TAMAT PERUBAHAN ▲▲▲
        
        if (!shouldHideDisplayGroups) {
            const selectedDisplayRadio = document.querySelector('input[name="fld-display-type"]:checked');
            if (selectedDisplayRadio) {
                const selectedDisplayValue = selectedDisplayRadio.value;
                elementsToControl.formatAsGroup.classList.toggle('hidden', selectedDisplayValue !== 'text_input');
                elementsToControl.optionsListSettings.classList.toggle('hidden', selectedDisplayValue !== 'options_list');
            }
        }
    };

    if (!parentTableSelect.dataset.listenerAttached) {
        parentTableSelect.addEventListener('change', updateAllFieldDependencies);
        parentTableSelect.dataset.listenerAttached = 'true';
    }
    const mediaRadios = document.querySelectorAll('input[name="fld-media-type"]');
    if (mediaRadios.length > 0 && !mediaRadios[0].dataset.listenerAttached) {
        mediaRadios.forEach(radio => {
            radio.addEventListener('change', updateAllFieldDependencies);
            radio.dataset.listenerAttached = 'true';
        });
    }
    const displayTypeRadios = document.querySelectorAll('input[name="fld-display-type"]');
    if (displayTypeRadios.length > 0 && !displayTypeRadios[0].dataset.listenerAttached) {
        displayTypeRadios.forEach(radio => {
            radio.addEventListener('change', updateAllFieldDependencies);
            radio.dataset.listenerAttached = 'true';
        });
    }

    const mediaType = fieldData.media_type || 'link';
    setRadioValue('fld-media-type', mediaType);
    
    updateAllFieldDependencies();
    
    document.getElementById(`fld-media-${mediaType}`)?.dispatchEvent(new Event('click'));
    setElementValue('fld-media-link-behavior', fieldData.media_link_behavior);
    setElementValue('fld-media-link-display-as', fieldData.media_link_display_as);
    setElementValue('fld-media-link-other-field', fieldData.media_link_other_field);
    setElementValue('fld-allow-image-uploads', fieldData.allow_image_uploads);
    
    setElementValue('fld-image-storage-provider', fieldData.image_storage_provider);
    
    setElementValue('fld-max-file-size', fieldData.max_file_size);
    setElementValue('fld-delete-image-server', fieldData.delete_image_server);
    setElementValue('fld-dont-rename-image', fieldData.dont_rename_image);
    setElementValue('fld-tv-thumb-shape', fieldData.tv_thumb_shape);
    setElementValue('fld-dv-thumb-shape', fieldData.dv_thumb_shape);
    setElementValue('fld-tv-thumb-width', fieldData.tv_thumb_width);
    setElementValue('fld-tv-thumb-height', fieldData.tv_thumb_height);
    setElementValue('fld-tv-enable-zooming', fieldData.tv_enable_zooming);
    setElementValue('fld-tv-show-full-size', fieldData.tv_show_full_size);
    setElementValue('fld-dv-thumb-width', fieldData.dv_thumb_width);
    setElementValue('fld-dv-thumb-height', fieldData.dv_thumb_height);
    setElementValue('fld-dv-enable-zooming', fieldData.dv_enable_zooming);
    setElementValue('fld-dv-show-full-size', fieldData.dv_show_full_size);
    document.getElementById('fld-allow-image-uploads')?.dispatchEvent(new Event('change'));
    setElementValue('fld-allow-file-uploads', fieldData.allow_file_uploads);
    
    setElementValue('fld-file-storage-provider', fieldData.file_storage_provider);

    setElementValue('fld-file-types', fieldData.file_types);
    setElementValue('fld-file-max-size', fieldData.file_max_size);
    setElementValue('fld-delete-file-server', fieldData.delete_file_server);
    setElementValue('fld-dont-rename-file', fieldData.dont_rename_file);
    setElementValue('fld-file-behavior', fieldData.file_behavior);
    setElementValue('fld-file-display-as', fieldData.file_display_as);
    setElementValue('fld-file-other-field', fieldData.file_other_field);
    document.getElementById('fld-allow-file-uploads')?.dispatchEvent(new Event('change'));
    setElementValue('fld-display-gmap', fieldData.display_gmap);
    setRadioValue('fld-gmap-type', fieldData.gmap_type);
    setElementValue('fld-gmap-tv-width', fieldData.gmap_tv_width);
    setElementValue('fld-gmap-tv-height', fieldData.gmap_tv_height);
    setElementValue('fld-gmap-dv-height', fieldData.gmap_dv_height);
    document.getElementById('fld-display-gmap')?.dispatchEvent(new Event('change'));
    setElementValue('fld-accept-video-url', fieldData.accept_video_url);
    setElementValue('fld-youtube-tv-width', fieldData.youtube_tv_width);
    setElementValue('fld-youtube-tv-height', fieldData.youtube_tv_height);
    setElementValue('fld-youtube-dv-width', fieldData.youtube_dv_width);
    setElementValue('fld-youtube-dv-height', fieldData.youtube_dv_height);
    document.getElementById('fld-accept-video-url')?.dispatchEvent(new Event('change'));
    setElementValue('fld-lookup-caption-1', fieldData.lookup_caption_1);
    setElementValue('fld-lookup-separator', fieldData.lookup_separator);
    setElementValue('fld-lookup-caption-2', fieldData.lookup_caption_2);
    setRadioValue('fld-lookup-display-as', fieldData.lookup_display_as);
    
    setElementValue('fld-lookup-searchable', fieldData.lookup_searchable);
    setElementValue('fld-lookup-preload', fieldData.lookup_preload);

    // Cetuskan event 'change' untuk menjalankan logik tunjuk/sembunyi
    const displayAsRadios = document.querySelectorAll('input[name="fld-lookup-display-as"]');
    if (displayAsRadios.length > 0) {
        displayAsRadios[0].dispatchEvent(new Event('change', { bubbles: true }));
    }
    
    setElementValue('fld-lookup-inherit-permissions', fieldData.lookup_inherit_permissions);
    setElementValue('fld-lookup-link-behavior', fieldData.lookup_link_behavior);
    setElementValue('fld-lookup-custom-query-hidden', fieldData.lookup_custom_query);
    
    setElementValue('fld-boolean-label-true', fieldData.boolean_label_true);
    setElementValue('fld-boolean-label-false', fieldData.boolean_label_false);
    
    if (parentTableSelect && !parentTableSelect.value) {
        const relationship = appState.jsonData.database.relationships.find(rel => rel.child_table_name === tableName && rel.fk_child_field === fieldName);
        if (relationship) {
            const parentTable = relationship.parent_table_name;
            const parentPKField = relationship.parent_field;
            setElementValue('fld-lookup-parent-table', parentTable);
            parentTableSelect.dispatchEvent(new Event('change'));
            const parentTableFields = appState.jsonData.database.table[parentTable]?.fields;
            if (parentTableFields) {
                const fieldNames = Object.keys(parentTableFields);
                const pkIndex = fieldNames.indexOf(parentPKField);
                if (pkIndex > -1 && pkIndex < fieldNames.length - 1) {
                    const nextFieldName = fieldNames[pkIndex + 1];
                    setElementValue('fld-lookup-caption-1', nextFieldName);
                }
            }
        }
    }
    setElementValue('fld-options-list-values', fieldData.options_list_values);
    setRadioValue('fld-options-display', fieldData.options_display);
    const quickListSelect = document.getElementById('options-quick-list');
    if (quickListSelect) {
        const currentValue = fieldData.options_list_values || '';
        let matchFound = false;
        for (const option of quickListSelect.options) {
            if (option.value === currentValue) {
                option.selected = true;
                matchFound = true;
                break;
            }
        }
        if (!matchFound) {
            quickListSelect.value = '';
        }
    }
    setElementValue('fld-format-as', fieldData.format_as);
    
    setElementValue('fld-format-mask', fieldData.format_mask);
    
    // Isi data untuk Repeater-Simple
    setElementValue('fld-repeater-simple-display-as', fieldData.repeater_simple_display_as);
    setElementValue('fld-repeater-simple-format-as', fieldData.repeater_simple_format_as);
    setElementValue('fld-repeater-simple-list-values', fieldData.repeater_simple_list_values);
    
    // Isi data untuk Repeater (3 set)
    for (let i = 1; i <= 3; i++) {
        setElementValue(`fld-repeater-${i}-display-as`, fieldData[`repeater_${i}_display_as`]);
        setElementValue(`fld-repeater-${i}-format-as`, fieldData[`repeater_${i}_format_as`]);
        setElementValue(`fld-repeater-${i}-list-values`, fieldData[`repeater_${i}_list_values`]);
        setElementValue(`fld-repeater-${i}-required`, fieldData[`repeater_${i}_required`]);
    }

    setElementValue('fld-repeater-simple-required', fieldData.repeater_simple_required);

    // Cetuskan event untuk memastikan visibility bersarang adalah betul semasa data dimuatkan
    document.getElementById('fld-repeater-simple-display-as')?.dispatchEvent(new Event('change'));
    for (let i = 1; i <= 3; i++) {
        document.getElementById(`fld-repeater-${i}-display-as`)?.dispatchEvent(new Event('change'));
    }
    
    // Cetuskan event 'change' untuk memastikan 'Mask' dipaparkan dengan betul semasa data dimuatkan
    const formatAsSelect = document.getElementById('fld-format-as');
    if (formatAsSelect) {
        formatAsSelect.dispatchEvent(new Event('change', { bubbles: true }));
    }
    
    setElementValue('fld-calculated-enable', fieldData.calculated_enable);
    setElementValue('fld-calculated-query', fieldData.calculated_query);
	setElementValue('fld-algorithm-enable', fieldData.algorithm_enable);
	setElementValue('fld-algorithm-logic', fieldData.algorithm_logic);
	const algorithmEnableCheckbox = document.getElementById('fld-algorithm-enable');
	if (algorithmEnableCheckbox) {
		algorithmEnableCheckbox.dispatchEvent(new Event('change'));
	}
    
	applyDataTypeRules();
    setTimeout(() => {
        const queryTextarea = document.getElementById('fld-calculated-query');
        if (queryTextarea) {
            queryTextarea.disabled = false;
        }
    }, 50);
    const behaviorSelect = document.getElementById('fld-media-link-behavior');
    if (behaviorSelect) {
        behaviorSelect.dispatchEvent(new Event('change'));
    }
    
// ▼▼▼ PEMBETULAN DI SINI ▼▼▼
    // Panggil fungsi loadValidationTab dengan tableName (bukan tableId)
    const currentTableData = appState.jsonData.database.table[tableName];
    const currentFieldData = currentTableData?.fields[fieldName];

    if (currentTableData && currentFieldData) {
        // Hantar columnId dan tableName
        loadValidationTab(currentFieldData.field_id, tableName); 
    }
    // ▲▲▲ TAMAT PEMBETULAN ▲▲▲
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

}
