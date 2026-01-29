// js/features/repeater.js

export function initializeRepeaterHandlers() {
    const setupRepeaterLogic = (index) => {
        const suffix = index ? `-${index}` : '-simple';
        
        const displayAsSelect = document.getElementById(`fld-repeater${suffix}-display-as`);
        const formatAsGroup = document.getElementById(`fld-repeater${suffix}-format-as-group`);
        const listValuesGroup = document.getElementById(`fld-repeater${suffix}-list-values-group`);

        if (!displayAsSelect || !formatAsGroup || !listValuesGroup) return;

        const toggleVisibility = () => {
            const selected = displayAsSelect.value;
            
            // Gaya Asal (Lebih Ringkas & Moden)
            formatAsGroup.classList.toggle('hidden', selected !== 'text_input');
            listValuesGroup.classList.toggle('hidden', selected !== 'dropdown_list');
        };

        displayAsSelect.addEventListener('change', toggleVisibility);
        
        // Pembaikan Saya: Pastikan UI betul sebaik sahaja ia dimuatkan
        toggleVisibility(); 
    };

    setupRepeaterLogic(null); 
    setupRepeaterLogic(1);
    setupRepeaterLogic(2);
    setupRepeaterLogic(3);
}