// Validation type configuration for Filament/Laravel
// Used by uiHandlers.js to generate the validation UI form

export const VALIDATION_RULES_CONFIG = [
    // --- Basic Rules ---
    /*     {
        type: 'required',
        label: 'Required',
        desc: 'Field must not be empty.',
        inputs: 'none'
        },
        {
        type: 'nullable',
        label: 'Nullable',
        desc: 'The field value can be empty.',
        inputs: 'none'
        },
        {
        type: 'filled',
        label: 'Filled',
        desc: 'The field must not be empty when it is present.',
        inputs: 'none'
    }, */
    
    // --- String & Format Rules ---
    {
        type: 'string',
        label: 'String',
        desc: 'The field must be a string.',
        inputs: 'none'
    },
    {
        type: 'alpha',
        label: 'Alpha',
        desc: 'The field must be entirely alphabetic characters.',
        inputs: 'none'
    },
    {
        type: 'alpha_dash',
        label: 'Alpha Dash',
        desc: 'The field may have alphanumeric characters, as well as dashes and underscores.',
        inputs: 'none'
    },
    {
        type: 'alpha_num',
        label: 'Alpha Numeric',
        desc: 'The field must be entirely alphanumeric characters.',
        inputs: 'none'
    },
    {
        type: 'ascii',
        label: 'ASCII',
        desc: 'The field must be entirely 7-bit ASCII characters.',
        inputs: 'none'
    },
    /*     {
        type: 'email',
        label: 'Email',
        desc: 'Field must be a valid email address.',
        inputs: 'none'
    }, */
    {
        type: 'active_url',
        label: 'Active URL',
        desc: 'The field must have a valid A or AAAA record.',
        inputs: 'none'
    },
    {
        type: 'ip',
        label: 'IP Address',
        desc: 'The field must be an IP address.',
        inputs: 'none'
    },
    {
        type: 'ipv4',
        label: 'IP Address v4',
        desc: 'The field must be an IP address v4.',
        inputs: 'none'
    },
    {
        type: 'ipv6',
        label: 'IP Address v6',
        desc: 'The field must be an IP address v6.',
        inputs: 'none'
    },
    {
        type: 'mac_address',
        label: 'MAC Address',
        desc: 'The field must be a MAC address.',
        inputs: 'none'
    },
    {
        type: 'hex_color',
        label: 'Hex Color',
        desc: 'The field value must be a valid color in hexadecimal format.',
        inputs: 'none'
    },
    {
        type: 'json',
        label: 'JSON',
        desc: 'The field must be a valid JSON string.',
        inputs: 'none'
    },
    {
        type: 'ulid',
        label: 'ULID',
        desc: 'Valid Universally Unique Lexicographically Sortable Identifier.',
        inputs: 'none'
    },
    {
        type: 'uuid',
        label: 'UUID',
        desc: 'Valid RFC 4122 universally unique identifier.',
        inputs: 'none'
    },

    // --- Comparison Rules (Field vs Field) ---
    /*     {
        type: 'confirmed',
        label: 'Confirmed',
        desc: 'Field must have a matching field of {field}_confirmation.',
        inputs: 'none'
    }, */
    {
        type: 'same',
        label: 'Same As',
        desc: 'The field value must be the same as below field.',
        inputs: 'dropdown_field'
    },
    {
        type: 'different',
        label: 'Different',
        desc: 'The field value must be different to below field.',
        inputs: 'dropdown_field'
    },
    {
        type: 'gt',
        label: 'Greater Than (Field)',
        desc: 'The field value must be greater than below field.',
        inputs: 'dropdown_field'
    },
    {
        type: 'gte',
        label: 'Greater Than or Equal (Field)',
        desc: 'The field value must be greater than or equal to below field.',
        inputs: 'dropdown_field'
    },
    {
        type: 'lt',
        label: 'Less Than (Field)',
        desc: 'The field value must be less than below field.',
        inputs: 'dropdown_field'
    },
    {
        type: 'lte',
        label: 'Less Than or Equal (Field)',
        desc: 'The field value must be less than or equal to below field.',
        inputs: 'dropdown_field'
    },

    // --- Date Rules ---
    {
        type: 'after',
        label: 'After (Date)',
        desc: 'Value must be after a below date/field.',
        inputs: 'dropdown_date'
    },
    {
        type: 'after_or_equal',
        label: 'After or Equal (Date)',
        desc: 'Value must be a date after or equal to the below date/field.',
        inputs: 'dropdown_date'
    },
    {
        type: 'before',
        label: 'Before (Date)',
        desc: 'Value must be a date before a below date/field.',
        inputs: 'dropdown_date'
    },
    {
        type: 'before_or_equal',
        label: 'Before or Equal (Date)',
        desc: 'Value must be a date before or equal to the below date/field.',
        inputs: 'dropdown_date'
    },

    // --- List & Pattern Matching ---
    {
        type: 'in',
        label: 'In List',
        desc: 'The field must be included in the given list of values.',
        inputs: 'textbox',
        placeholder: 'e.g: pending,completed'
    },
    {
        type: 'not_in',
        label: 'Not In List',
        desc: 'The field must not be included in the given list of values.',
        inputs: 'textbox',
        placeholder: 'e.g: cancelled,rejected'
    },
    {
        type: 'starts_with',
        label: 'Starts With',
        desc: 'The field must start with one of the given values.',
        inputs: 'textbox',
        placeholder: 'e.g: admin,user'
    },
    {
        type: 'doesnt_start_with',
        label: 'Does Not Start With',
        desc: 'The field must not start with one of the given values.',
        inputs: 'textbox',
        placeholder: 'e.g: admin'
    },
    {
        type: 'ends_with',
        label: 'Ends With',
        desc: 'The field must end with one of the given values.',
        inputs: 'textbox',
        placeholder: 'e.g: .com'
    },
    {
        type: 'doesnt_end_with',
        label: 'Does Not End With',
        desc: 'The field must not end with one of the given values.',
        inputs: 'textbox',
        placeholder: 'e.g: temp'
    },
    {
        type: 'regex',
        label: 'Regex',
        desc: 'The field must match the given regular expression.',
        inputs: 'textbox',
        placeholder: '/^.+@.+$/i'
    },
    {
        type: 'not_regex',
        label: 'Not Regex',
        desc: 'The field must not match the given regular expression.',
        inputs: 'textbox',
        placeholder: '/^.+$/i'
    },
    {
        type: 'multiple_of',
        label: 'Multiple Of',
        desc: 'The field must be a multiple of value.',
        inputs: 'textbox',
        placeholder: 'e.g: 2'
    },

    // --- Conditional Presence (Required/Prohibited) ---
    {
        type: 'required_if',
        label: 'Required If',
        desc: 'Required only if the below field has specific value.',
        inputs: 'dropdown_field_text'
    },
    {
        type: 'required_unless',
        label: 'Required Unless',
        desc: 'Required unless the below field has specific value.',
        inputs: 'dropdown_field_text'
    },
    {
        type: 'required_with',
        label: 'Required With',
        desc: 'Required only if any of the specified fields are present.',
        inputs: 'textbox',
        placeholder: 'field1,field2'
    },
    {
        type: 'required_with_all',
        label: 'Required With All',
        desc: 'Required only if all the specified fields are present.',
        inputs: 'textbox',
        placeholder: 'field1,field2'
    },
    {
        type: 'required_without',
        label: 'Required Without',
        desc: 'Required only when any of the specified fields are empty.',
        inputs: 'textbox',
        placeholder: 'field1,field2'
    },
    {
        type: 'required_without_all',
        label: 'Required Without All',
        desc: 'Required only when all the specified fields are empty.',
        inputs: 'textbox',
        placeholder: 'field1,field2'
    },
    {
        type: 'required_if_accepted',
        label: 'Required If Accepted',
        desc: 'Required only if the below field is accepted (yes/on/1/true).',
        inputs: 'dropdown_field'
    },
    {
        type: 'prohibited',
        label: 'Prohibited',
        desc: 'The field value must be empty.',
        inputs: 'none'
    },
    {
        type: 'prohibited_if',
        label: 'Prohibited If',
        desc: 'Must be empty if below field has specific value.',
        inputs: 'dropdown_field_text'
    },
    {
        type: 'prohibited_unless',
        label: 'Prohibited Unless',
        desc: 'Must be empty unless below field has specific value.',
        inputs: 'dropdown_field_text'
    },
    {
        type: 'prohibits',
        label: 'Prohibits',
        desc: 'If this field is present, below specified fields must be empty.',
        inputs: 'textbox',
        placeholder: 'field1,field2'
    },

    // --- Database Rules ---
    /*     {
        type: 'unique',
        label: 'Unique',
        desc: 'The field value must not exist in the database.',
        inputs: 'none' // Usually auto-handled, can check 'ignore record' logic in generator
    }, */
    {
        type: 'exists',
        label: 'Exists',
        desc: 'The field value must exist in the database table/column.',
        /*         inputs: 'textbox', // Optional: Allow user to specify table,column if different
        placeholder: 'table,column (Optional)' */
        inputs: 'none'
    }
];