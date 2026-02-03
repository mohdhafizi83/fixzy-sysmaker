// js/utils.js

/**
 * Mencari dan menggantikan placeholder '##variable.nama##'
 * dengan nilai sebenar daripada objek skop.
 */
export function resolveVariables(configString, variableScope) {
    if (!configString || !variableScope) {
        return configString;
    }

    // Regex untuk mencari corak ##variable.nama##
    const variableRegex = /##variable\.(\w+)##/g;

    return configString.replace(variableRegex, (match, variableName) => {
        if (Object.prototype.hasOwnProperty.call(variableScope, variableName)) {
            const value = variableScope[variableName];
            // Escape single quotes jika ia string untuk elak ralat SQL/JSON
            if (typeof value === 'string') {
                return value.replace(/'/g, "\\'"); 
            }
            return value;
        }
        console.warn(`Pembolehubah tidak ditemui dalam skop: ${variableName}`);
        return match;
    });
}