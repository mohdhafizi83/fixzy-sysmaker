// js/features/repeater.js
//
// Wires up the repeater field UI: toggles between "format as group" and
// "list values" controls depending on the chosen display style.

/**
 * Attaches repeater display-style toggle logic for the base field and repeaters 1-3.
 * @returns {void}
 */
export function initializeRepeaterHandlers() {
    /**
     * Binds the display-as select for one repeater slot so only the matching option group stays visible.
     * @param {number|null} index Repeater slot number, or null for the simple (unnumbered) variant.
     * @returns {void}
     */
    const setupRepeaterLogic = (index) => {
        const suffix = index ? `-${index}` : '-simple';
        
        const displayAsSelect = document.getElementById(`fld-repeater${suffix}-display-as`);
        const formatAsGroup = document.getElementById(`fld-repeater${suffix}-format-as-group`);
        const listValuesGroup = document.getElementById(`fld-repeater${suffix}-list-values-group`);

        if (!displayAsSelect || !formatAsGroup || !listValuesGroup) return;

        // Shows "format as group" for text_input and "list values" for dropdown_list.
        const toggleVisibility = () => {
            const selected = displayAsSelect.value;
            
            // Original style (simpler & modern)
            formatAsGroup.classList.toggle('hidden', selected !== 'text_input');
            listValuesGroup.classList.toggle('hidden', selected !== 'dropdown_list');
        };

        displayAsSelect.addEventListener('change', toggleVisibility);
        
        // My fix: make sure the UI is correct as soon as it loads
        toggleVisibility(); 
    };

    setupRepeaterLogic(null); 
    setupRepeaterLogic(1);
    setupRepeaterLogic(2);
    setupRepeaterLogic(3);
}