// Shared helpers for the Approvals module (Fixzy SysMaker).
//
// Parses tables.approval_config (JSON authored by the Approvals tab)
// into PHP literal blocks that get compiled into the generated model:
//   APPROVAL_STATUS_FIELD, APPROVAL_INITIAL, APPROVAL_STATUSES,
//   APPROVAL_TRANSITIONS.
//
// All string values are escaped for single-quoted PHP literals.

function phpStr(v) {
    return String(v === null || v === undefined ? '' : v)
        .replace(/\\/g, '\\\\')
        .replace(/'/g, "\\'")
        .replace(/\r/g, '\\r')
        .replace(/\n/g, '\\n');
}

/**
 * Parse approval_config JSON. Returns null when absent/invalid/disabled.
 * @param {object} tableData row from the tables store
 */
function parseApprovalConfig(tableData) {
    if (!tableData || Number(tableData.approval_enabled) !== 1) return null;
    let cfg = null;
    try {
        cfg = tableData.approval_config ? JSON.parse(tableData.approval_config) : null;
    } catch (e) {
        return null;
    }
    if (!cfg || !Array.isArray(cfg.statuses) || cfg.statuses.length < 2) return null;
    if (!cfg.statusField || !/^[a-z][a-z0-9_]*$/i.test(cfg.statusField)) return null;
    const keys = cfg.statuses.map((s) => s && s.key).filter((k) => k && /^[a-z][a-z0-9_]*$/i.test(k));
    if (keys.length !== cfg.statuses.length) return null;
    if (!keys.includes(cfg.initial)) return null;
    const transitions = Array.isArray(cfg.transitions) ? cfg.transitions : [];
    for (const t of transitions) {
        if (!keys.includes(t.from) || !keys.includes(t.to) || t.from === t.to) return null;
    }
    if (transitions.length === 0) return null;
    return cfg;
}

/** PHP const block for the model class body. */
function approvalConstantsPhp(cfg) {
    const statuses = cfg.statuses
        .map((s) => {
            return `        '${phpStr(s.key)}' => ['label' => '${phpStr(s.label)}', 'color' => '${phpStr(s.color || 'gray')}', 'final' => ${s.final ? 'true' : 'false'}],`;
        })
        .join('\n');
    const transitions = cfg.transitions
        .map((t) => {
            return `        ['from' => '${phpStr(t.from)}', 'to' => '${phpStr(t.to)}', 'label' => '${phpStr(t.label || '')}', 'roles' => '${phpStr(t.roles || '')}', 'require_comment' => ${t.require_comment ? 'true' : 'false'}, 'notify' => '${phpStr(t.notify || '')}'],`;
        })
        .join('\n');
    return `    /** Approval workflow (Fixzy SysMaker Approvals module) — generated. */
    public const APPROVAL_STATUS_FIELD = '${phpStr(cfg.statusField)}';
    public const APPROVAL_INITIAL = '${phpStr(cfg.initial)}';

    public const APPROVAL_STATUSES = [
${statuses}
    ];

    public const APPROVAL_TRANSITIONS = [
${transitions}
    ];
`;
}

/** Filament badge column for the status field. */
function approvalBadgeColumnPhp(cfg) {
    const colorMap = cfg.statuses
        .map((s) => `                        '${phpStr(s.key)}' => '${phpStr(s.color || 'gray')}',`)
        .join('\n');
    return `TextColumn::make('${phpStr(cfg.statusField)}')
                    ->label('Status')
                    ->badge()
                    ->color(fn (?string $state): string => match ($state) {
${colorMap}
                        default => 'gray',
                    }),`;
}

/**
 * Filament row actions: one Action per transition, visible when the
 * current user may perform it. Opens a comment modal when required.
 */
function approvalActionsPhp(cfg, modelName) {
    return cfg.transitions
        .map((t) => {
            const label = t.label || `Move to ${t.to}`;
            const commentBlock = t.require_comment
                ? `
                    ->requiresConfirmation()
                    ->modalHeading('${phpStr(label)}')
                    ->modalDescription('A comment is required for this step. Add one in the field below after confirming.')
                    ->modalSubmitActionLabel('${phpStr(label)}')`
                : `
                    ->requiresConfirmation()
                    ->modalHeading('${phpStr(label)}')
                    ->modalSubmitActionLabel('${phpStr(label)}')`;
            // Comment capture via modal form only when required.
            const formBlock = t.require_comment
                ? `
                    ->schema([
                        \\Filament\\Forms\\Components\\Textarea::make('approval_comment')
                            ->label('Comment')
                            ->required(),
                    ])`
                : '';
            return `Action::make('approve_${phpStr(t.from)}_to_${phpStr(t.to)}')
                    ->label('${phpStr(label)}')
                    ->icon('heroicon-o-arrow-right-circle')
                    ->color('info')${commentBlock}${formBlock}
                    ->visible(fn ($record): bool => collect($record->visibleTransitionsFor(auth()->user()))
                        ->contains(fn (array \$tr): bool => \$tr['from'] === '${phpStr(t.from)}' && \$tr['to'] === '${phpStr(t.to)}'))
                    ->action(function ($record, array $data): void {
                        $record->transitionTo('${phpStr(t.to)}', $data['approval_comment'] ?? null);
                    }),`;
        })
        .join('\n                ');
}

/** Any table in the schema has approvals enabled? */
function anyApprovalsEnabled(fullSchema) {
    const tables = (fullSchema && fullSchema.database && fullSchema.database.table) || {};
    return Object.values(tables).some((t) => parseApprovalConfig(t) !== null);
}

module.exports = {
    parseApprovalConfig,
    approvalConstantsPhp,
    approvalBadgeColumnPhp,
    approvalActionsPhp,
    anyApprovalsEnabled,
};
