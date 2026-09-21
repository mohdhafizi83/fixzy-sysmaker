// IR adapter for staged migration (Phase 1 -> Phase 2).
//
// Generators still consume the legacy fullSchema shape until they are migrated
// one-by-one in Phase 2. This adapter reconstructs that shape from an IR
// object losslessly via the reserved _source copy.
//
// Migration end-state: when every generator reads IR directly, delete this
// file and the _source field.

'use strict';

/**
 * Reconstruct the legacy fullSchema object from an IR (lossless via _source).
 * @param {object} ir IR object produced by exportIR()
 * @returns {object} legacy { project, database: { table, relationships, unified_menu } }
 */
function asLegacyFullSchema(ir) {
    if (!ir || !ir._source) {
        throw new Error('IR has no _source copy; cannot reconstruct legacy fullSchema. ' +
            'Migrate this generator to consume IR directly.');
    }
    return ir._source;
}

module.exports = { asLegacyFullSchema };
