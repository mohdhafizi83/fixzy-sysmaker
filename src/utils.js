const pluralize = require('pluralize');
const fs = require('fs');
const path = require('path');

function convertDateFormatToPhp(formatString) {
    if (!formatString) return 'd/m/Y'; // Safe default

    // Normalize the year in the input string so matching does not depend on the current year
    const normalizedFormat = formatString.replace(/\d{4}/, '9999');

    switch (normalizedFormat) {
        // Date Formats
        case '31/12/9999': return 'd/m/Y';
        case '12/31/9999': return 'm/d/Y';
        case '9999-12-31': return 'Y-m-d';
        case '31 December 9999': return 'd F Y';
        case '31 Dec 9999': return 'd M Y';
        case 'December 31, 9999': return 'F d, Y';
        case 'Dec 31, 9999': return 'M d, Y';

        // Time Formats
        case '11:59 PM': return 'h:i A';
        case '11:59:59 PM': return 'h:i:s A';
        case '23:59': return 'H:i';
        case '23:59:59': return 'H:i:s';

        // If no match, return a comprehensive default format
        default: return 'd/m/Y H:i:s';
    }
}

function getFormattedTimestamp(date, sequence) {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    const hh = String(date.getHours()).padStart(2, '0');
    const min = String(date.getMinutes()).padStart(2, '0');
    const ss = String(date.getSeconds()).padStart(2, '0');
    // Add sequence so files do not collide
    const seq = String(sequence).padStart(2, '0'); 
    return `${yyyy}_${mm}_${dd}_${hh}${min}${ss}${seq}`;
}

/**
 * Converts snake_case, kebab-case, camelCase, PascalCase, or odd/type strings to PascalCase.
 * Examples: 'user_profile' -> 'UserProfile', 'user-profile' -> 'UserProfile', 'userProfile' -> 'UserProfile', 'UserProfile' -> 'UserProfile', 'UsErProfile' -> 'UsErProfile', 'USER_NAME' -> 'UserName',
 */
function toPascalCase(str) {
    if (!str) return '';

    return str
        // STEP 1: Handle camelCase
        // If a lowercase letter is followed by an uppercase letter (e.g. rP in userProfile),
        // insert a space between them.
        // userProfile -> user Profile
        .replace(/([a-z])([A-Z])/g, '$1 $2')

        // STEP 2: Split by symbols (- _ or space)
        .split(/[-_\s]/)

        // STEP 3: Remove leftover blanks (if there are double spaces/underscores)
        .filter(word => word.length > 0)

        // STEP 4: Standardize (first letter uppercase, rest lowercase)
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())

        // STEP 5: Join back together
        .join('');
}

/**
 * Converts a snake_case string to camelCase.
 * Example: 'student_school' -> 'studentSchool'
 */
function toCamelCase(str) {
    if (!str) return '';
    const pascal = toPascalCase(str);
    return pascal.charAt(0).toLowerCase() + pascal.slice(1);
}

/**
 * Converts a snake_case string to plural PascalCase using correct English logic.
 * Example: 'activity_log' -> 'ActivityLogs'
 */
function toPluralPascalCase(str) {
    if (!str) return '';
    // Apply 'pluralize' to the original string before changing case
    return toPascalCase(pluralize.plural(str));
}

/**
 * Converts a snake_case string to plural camelCase using correct English logic.
 * Example: 'activity_log' -> 'activityLogs'
 */
function toPluralCamelCase(str) {
    if (!str) return '';
    // Apply 'pluralize' to the original string before changing case
    return toCamelCase(pluralize.plural(str));
}

/**
 * Converts a string to flatcase (e.g. User Profile -> userprofile).
 * Suitable for short code, permission strings, or internal slugs.
 */
function toFlatCase(str) {
    if (!str) return '';
    
    // Replace dash (-), underscore (_), AND space (\s) with nothing
    return str.replace(/[-_\s]/g, '').toLowerCase();
}

/**
 * Converts snake_case, kebab-case, camelCase, PascalCase strings to Title Case.
 * Examples: 'user_profile' -> 'User Profile', 'USER_PROFILE' -> 'User Profile', 'userProfile' -> 'User Profile', 'user-profile' -> 'User Profile'
 */
function toTitleCase(str) {
    if (!str) return '';
    
    return str
        // 1. Separate camelCase (firstName -> first Name)
        .replace(/([a-z])([A-Z])/g, '$1 $2')
        
        // 2. Replace underscores/dashes with spaces
        .replace(/[-_]/g, ' ')
        
        // 3. Split into words, remove excess spaces
        .split(' ')
        .filter(word => word.length > 0)
        
        // 4. Format: first letter uppercase, rest lowercase
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        
        // 5. Rejoin with spaces
        .join(' ');
}

function toSingularPascalCase(str) {
    if (!str) return '';
    // Apply 'pluralize.singular' to the original string before changing case
    return toPascalCase(pluralize.singular(str));
}

function toSingularCamelCase(str) {
    if (!str) return '';
    // Apply 'pluralize.singular' to the original string before changing case
    return toCamelCase(pluralize.singular(str));
}

function getFieldDefinitionForMigration(field) {
    const name = field.field_name;
    const type = field.data_type.toUpperCase();
    const length = field.length;

    // Data Type Mapping
    if (type === 'INT' || type === 'INTEGER') return `$table->integer('${name}')`;
    if (type === 'BIGINT') return `$table->bigInteger('${name}')`;
    if (type === 'TINYINT') return (length == 1) ? `$table->boolean('${name}')` : `$table->tinyInteger('${name}')`;
    if (type === 'SMALLINT') return `$table->smallInteger('${name}')`;
    if (type === 'VARCHAR') return `$table->string('${name}', ${length || 255})`;
    if (type === 'CHAR') return `$table->char('${name}', ${length || 255})`;
    if (type === 'TEXT') return `$table->text('${name}')`;
    if (type === 'MEDIUMTEXT') return `$table->mediumText('${name}')`;
    if (type === 'LONGTEXT') return `$table->longText('${name}')`;
    if (type === 'DATE') return `$table->date('${name}')`;
    if (type === 'DATETIME') return `$table->dateTime('${name}')`;
    if (type === 'TIMESTAMP') return `$table->timestamp('${name}')`;
    if (type === 'TIME') return `$table->time('${name}')`;
    if (type === 'DECIMAL') return `$table->decimal('${name}', 10, 2)`; // Default precision
    if (type === 'FLOAT') return `$table->float('${name}')`;
    if (type === 'DOUBLE') return `$table->double('${name}')`;
    if (type === 'BOOLEAN') return `$table->boolean('${name}')`;
    if (type === 'JSON') return `$table->json('${name}')`;
    
    if (type === 'ENUM') {
        const opts = field.options_list_values 
            ? field.options_list_values.split(';;').map(o => `'${o}'`).join(', ')
            : '';
        return `$table->enum('${name}', [${opts}])`;
    }

    return `$table->string('${name}')`; // Fallback
}

/**
 * Guesses the Faker format based on field name and data type.
 */
function getFakerFormatter(field) {
    const name = field.field_name.toLowerCase();
    const type = field.data_type.toUpperCase();
    const unique = (field.unique === 1 || field.is_unique === 1) ? '->unique()' : '';

    // 1. Name-based Guessing (Malay name variants kept: they match user-defined field names)
    if (name.includes('email')) return `fake()${unique}->safeEmail()`;
    if (name.includes('phone') || name.includes('tel')) return `fake()${unique}->phoneNumber()`;
    if (name.includes('name') || name.includes('nama')) return `fake()${unique}->name()`;
    if (name.includes('address') || name.includes('alamat')) return `fake()->address()`;
    if (name.includes('city') || name.includes('bandar')) return `fake()->city()`;
    if (name.includes('state') || name.includes('negeri')) return `fake()->state()`;
    if (name.includes('postcode') || name.includes('poskod')) return `fake()->postcode()`;
    if (name.includes('country') || name.includes('negara')) return `fake()->country()`;
    if (name.includes('company') || name.includes('syarikat')) return `fake()->company()`;
    if (name.includes('job') || name.includes('jawatan')) return `fake()->jobTitle()`;
    if (name.includes('title') || name.includes('tajuk')) return `fake()->sentence(4)`;
    if (name.includes('description') || name.includes('deskripsi')) return `fake()->paragraph()`;
    if (name.includes('password') || name.includes('kata_laluan')) return `'password'`; // static password for dev
    if (name.includes('url') || name.includes('link')) return `fake()->url()`;
    if (name.includes('ic_no') || name.includes('mykad')) return `fake()${unique}->numerify('######-##-####')`;
    if (name.includes('matrik') || name.includes('matric')) return `fake()${unique}->bothify('??#####')`;
    if (name.includes('slug')) return `fake()${unique}->slug()`;
    
    // 2. Type-based Guessing
    if (type === 'BOOLEAN' || type === 'TINYINT') return `fake()->boolean()`;
    if (type === 'DATE') return `fake()->date()`;
    if (type === 'DATETIME' || type === 'TIMESTAMP') return `fake()->dateTimeThisYear()`;
    if (type === 'TIME') return `fake()->time()`;
    if (type.includes('INT')) return `fake()->randomNumber()`; // INT, BIGINT, etc
    if (type === 'DECIMAL' || type === 'FLOAT' || type === 'DOUBLE') return `fake()->randomFloat(2, 10, 1000)`;
    if (type === 'TEXT' || type === 'LONGTEXT') return `fake()->text()`;
    if (type === 'JSON') return `['key' => 'value']`;

    // 3. Fallback
    return `fake()->word()`;
}

async function runStep(name, promise) {
    console.log(`  > Generating ${name}...`);
    const result = await promise;
    if (!result.success) {
        throw new Error(`Failed to generate ${name}: ${result.message}`);
    }
}

function getFilesRecursive(dir, fileList = [], relativePath = '') {
    const files = fs.readdirSync(dir);
    files.forEach(file => {
        const filePath = path.join(dir, file);
        const relPath = path.join(relativePath, file);
        const stat = fs.statSync(filePath);
        if (stat.isDirectory()) {
            if (file !== 'vendor' && file !== 'node_modules' && file !== '.git') { // Skip heavy folders
                getFilesRecursive(filePath, fileList, relPath);
            }
        } else {
            fileList.push(relPath);
        }
    });
    return fileList;
}

// Helper function for reading the current templates in src/render/engine.js (Nunjucks).
// readTemplate (string-replacement era) was removed after the Phase 2 migration.

/**
 * Converts JSON Filter Rules to PHP Eloquent code.
 * @param {object} rulesObj - Object of the form { logic: 'AND', rules: [...] }
 * @returns {string} PHP Query Builder string.
 */
function buildEloquentQueryFromRules(rulesObj) {
    if (!rulesObj || !rulesObj.rules || rulesObj.rules.length === 0) return '';

    const parts = [];
    
    rulesObj.rules.forEach(rule => {
        if (rule.type === 'group') {
            // Recursion for groups (Nested Logic)
            const nested = buildEloquentQueryFromRules(rule);
            if (nested) {
                parts.push(`$query->where(function($q) { ${nested.replace(/\$query->/g, '$q->')} });`);
            }
        } else {
            // Standard Rule
            const { field, operator, value } = rule;
            // Sanitize basic values (Basic escaping)
            let phpValue = `'${value}'`;
            if (value === 'null' || value === null) phpValue = 'null';
            else if (!isNaN(value) && value !== '') phpValue = value; // Number

            if (operator === 'IS NULL') {
                parts.push(`$query->whereNull('${field}')`);
            } else if (operator === 'IS NOT NULL') {
                parts.push(`$query->whereNotNull('${field}')`);
            } else if (operator === 'LIKE' || operator === 'NOT LIKE') {
                parts.push(`$query->where('${field}', '${operator}', '%${value}%')`);
            } else {
                parts.push(`$query->where('${field}', '${operator}', ${phpValue})`);
            }
        }
    });

    // Combine based on the parent logic (AND/OR)
    const method = rulesObj.logic === 'OR' ? 'orWhere' : 'where';
    
    // Note: Filament getEloquentQuery() starts with a Builder, so we chain (chaining)
    // Example output: ->where('status', 'pending')->where('amount', '>', 100)
    return parts.map(p => `->${p.replace('$query->', '')}`).join('');
}

// Export all these functions so they can be used by other files
module.exports = {
    convertDateFormatToPhp,
    getFormattedTimestamp,
    toPascalCase,
    toCamelCase,
    toPluralPascalCase,
    toPluralCamelCase,
    toFlatCase,
    toTitleCase,
    toSingularPascalCase,
    toSingularCamelCase,
    getFieldDefinitionForMigration,
    getFakerFormatter,
    getFilesRecursive,
    runStep,
    buildEloquentQueryFromRules
};
