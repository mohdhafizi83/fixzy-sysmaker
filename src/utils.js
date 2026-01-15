const pluralize = require('pluralize');

function convertDateFormatToPhp(formatString) {
    if (!formatString) return 'd/m/Y'; // Lalai yang selamat

    // Normalkan tahun dalam rentetan input supaya padanan tidak bergantung pada tahun semasa
    const normalizedFormat = formatString.replace(/\d{4}/, '9999');

    switch (normalizedFormat) {
        // Format Tarikh
        case '31/12/9999': return 'd/m/Y';
        case '12/31/9999': return 'm/d/Y';
        case '9999-12-31': return 'Y-m-d';
        case '31 December 9999': return 'd F Y';
        case '31 Dec 9999': return 'd M Y';
        case 'December 31, 9999': return 'F d, Y';
        case 'Dec 31, 9999': return 'M d, Y';

        // Format Masa
        case '11:59 PM': return 'h:i A';
        case '11:59:59 PM': return 'h:i:s A';
        case '23:59': return 'H:i';
        case '23:59:59': return 'H:i:s';

        // Jika tiada padanan, kembalikan format lalai yang komprehensif
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
    // Tambah sequence supaya fail tidak bertembung masa
    const seq = String(sequence).padStart(2, '0'); 
    return `${yyyy}_${mm}_${dd}_${hh}${min}${ss}${seq}`;
}

/**
 * Menukar rentetan snake_case atau kebab-case kepada PascalCase.
 * Contoh: 'pelajar_sekolah' -> 'PelajarSekolah'
 */
function toPascalCase(str) {
    if (!str) return '';
    return str.split(/[-_]/).map(word => word.charAt(0).toUpperCase() + word.slice(1)).join('');
}

/**
 * Menukar rentetan snake_case kepada camelCase.
 * Contoh: 'pelajar_sekolah' -> 'pelajarSekolah'
 */
function toCamelCase(str) {
    if (!str) return '';
    const pascal = toPascalCase(str);
    return pascal.charAt(0).toLowerCase() + pascal.slice(1);
}

/**
 * Menukar rentetan snake_case kepada Plural PascalCase menggunakan logik Bahasa Inggeris yang betul.
 * Contoh: 'activity_log' -> 'ActivityLogs'
 */
function toPluralPascalCase(str) {
    if (!str) return '';
    // Gunakan 'pluralize' pada rentetan asal sebelum menukar kes
    return toPascalCase(pluralize.plural(str));
}

/**
 * Menukar rentetan snake_case kepada Plural camelCase menggunakan logik Bahasa Inggeris yang betul.
 * Contoh: 'activity_log' -> 'activityLogs'
 */
function toPluralCamelCase(str) {
    if (!str) return '';
    // Gunakan 'pluralize' pada rentetan asal sebelum menukar kes
    return toCamelCase(pluralize.plural(str));
}

/**
 * Menukar rentetan kepada flatcase (lowercase tanpa sempang atau garis bawah).
 * Contoh: 'pelajar_sekolah' -> 'pelajarsekolah'
 */
function toFlatCase(str) {
    if (!str) return '';
    return str.replace(/[-_]/g, '').toLowerCase();
}

function toTitleCase(str) {
    if (!str) return '';
    return str.replace(/_/g, ' ').replace(/\b\w/g, char => char.toUpperCase());
}

function toSingularPascalCase(str) {
    if (!str) return '';
    // Gunakan 'pluralize.singular' pada rentetan asal sebelum menukar kes
    return toPascalCase(pluralize.singular(str));
}

function toSingularCamelCase(str) {
    if (!str) return '';
    // Gunakan 'pluralize.singular' pada rentetan asal sebelum menukar kes
    return toCamelCase(pluralize.singular(str));
}

function getFieldDefinitionForMigration(field) {
    const name = field.field_name;
    const type = field.data_type.toUpperCase();
    const length = field.max_length;

    // Pemetaan Jenis Data
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
 * Meneka format Faker berdasarkan nama medan dan jenis data.
 */
function getFakerFormatter(field) {
    const name = field.field_name.toLowerCase();
    const type = field.data_type.toUpperCase();
    const unique = (field.unique === 1 || field.is_unique === 1) ? '->unique()' : '';

    // 1. Tekaan berdasarkan Nama Medan (Name-based Guessing)
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
    
    // 2. Tekaan berdasarkan Jenis Data (Type-based Guessing)
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

// Eksport semua fungsi ini supaya boleh digunakan oleh fail lain
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
    getFakerFormatter
};