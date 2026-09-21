// js/utils.js

/**
 * Search and replace '##variable.name##' placeholders
 * with actual values from the scope object.
 */
export function resolveVariables(configString, variableScope) {
    if (!configString || !variableScope) {
        return configString;
    }

    // Regex to find the ##variable.name## pattern
    const variableRegex = /##variable\.(\w+)##/g;

    return configString.replace(variableRegex, (match, variableName) => {
        if (Object.prototype.hasOwnProperty.call(variableScope, variableName)) {
            const value = variableScope[variableName];
            // Escape single quotes if it's a string to avoid SQL/JSON errors
            if (typeof value === 'string') {
                return value.replace(/'/g, "\\'"); 
            }
            return value;
        }
        console.warn(`Variable not found in scope: ${variableName}`);
        return match;
    });
}