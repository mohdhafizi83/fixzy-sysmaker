<x-filament-panels::page>
    <x-filament::section>
        <div style="display: flex; align-items: center; justify-content: space-between; gap: 1rem; flex-wrap: wrap;">
            <div>
                <h3 style="font-size: 0.875rem; font-weight: 600;">Configured schedules</h3>
                <p style="font-size: 0.75rem; color: rgb(107 114 128); margin-top: 0.25rem;">
                    Compiled from your Fixzy SysMaker design. The runner ticks every minute; each entry fires at most once per day/period.
                </p>
            </div>
            <x-filament::button wire:click="runNow" icon="heroicon-o-play" size="sm">
                Run scheduler now
            </x-filament::button>
        </div>

        <div style="overflow-x: auto; margin-top: 1rem;">
            <table style="width: 100%; font-size: 0.875rem; border-collapse: collapse;">
                <thead>
                    <tr style="text-align: left; font-size: 0.75rem; font-weight: 600; color: rgb(107 114 128); border-bottom: 1px solid rgb(229 231 235);">
                        <th style="padding: 0.5rem 1rem 0.5rem 0;">Kind</th>
                        <th style="padding: 0.5rem 1rem 0.5rem 0;">Table</th>
                        <th style="padding: 0.5rem 1rem 0.5rem 0;">Details</th>
                        <th style="padding: 0.5rem 0;">Notify</th>
                    </tr>
                </thead>
                <tbody>
                    @forelse ($schedules as $s)
                        <tr style="border-bottom: 1px solid rgb(243 244 246);">
                            <td style="padding: 0.5rem 1rem 0.5rem 0;">
                                @php
                                    $badge = match ($s['kind']) {
                                        'reminder' => 'warning',
                                        'recurring' => 'info',
                                        'backup' => 'success',
                                        default => 'gray',
                                    };
                                @endphp
                                <x-filament::badge :color="$badge">{{ ucfirst($s['kind']) }}</x-filament::badge>
                            </td>
                            <td style="padding: 0.5rem 1rem 0.5rem 0;">{{ $s['table'] ?? '—' }}</td>
                            <td style="padding: 0.5rem 1rem 0.5rem 0;">
                                @if (($s['kind'] ?? '') === 'reminder')
                                    {{ $s['field'] ?? '' }} — {{ $s['offset_days'] ?? 0 }} day(s) before
                                @elseif (($s['kind'] ?? '') === 'recurring')
                                    {{ $s['recurrence'] ?? '' }}@if(($s['recurrence'] ?? '') === 'monthly') on day {{ $s['day'] ?? 1 }}@elseif(($s['recurrence'] ?? '') === 'weekly') on weekday {{ $s['weekday'] ?? 1 }}@endif
                                @elseif (($s['kind'] ?? '') === 'backup')
                                    {{ $s['frequency'] ?? 'daily' }}, keep {{ $s['retention'] ?? 10 }} file(s)
                                @else
                                    —
                                @endif
                            </td>
                            <td style="padding: 0.5rem 0;">{{ $s['notify'] !== '' ? $s['notify'] : '—' }}</td>
                        </tr>
                    @empty
                        <tr><td colspan="4" style="padding: 1rem; text-align: center; color: rgb(156 163 175);">No schedules configured.</td></tr>
                    @endforelse
                </tbody>
            </table>
        </div>
    </x-filament::section>

    @if (! empty($backups))
    <x-filament::section>
        <h3 style="font-size: 0.875rem; font-weight: 600; margin-bottom: 0.75rem;">Backups on disk</h3>
        <div style="overflow-x: auto;">
            <table style="width: 100%; font-size: 0.875rem; border-collapse: collapse;">
                <thead>
                    <tr style="text-align: left; font-size: 0.75rem; font-weight: 600; color: rgb(107 114 128); border-bottom: 1px solid rgb(229 231 235);">
                        <th style="padding: 0.5rem 1rem 0.5rem 0;">File</th>
                        <th style="padding: 0.5rem 1rem 0.5rem 0;">Size</th>
                        <th style="padding: 0.5rem 0;">Created</th>
                    </tr>
                </thead>
                <tbody>
                    @foreach ($backups as $b)
                        <tr style="border-bottom: 1px solid rgb(243 244 246);">
                            <td style="padding: 0.5rem 1rem 0.5rem 0; font-family: monospace; font-size: 0.75rem;">{{ $b['name'] }}</td>
                            <td style="padding: 0.5rem 1rem 0.5rem 0;">{{ $b['size'] }}</td>
                            <td style="padding: 0.5rem 0; display: flex; align-items: center; justify-content: space-between; gap: 0.75rem;">
                                <span>{{ $b['modified'] }}</span>
                                <x-filament::button
                                    size="xs"
                                    color="danger"
                                    icon="heroicon-o-arrow-uturn-left"
                                    wire:click="restoreBackup('{{ $b['name'] }}')"
                                    wire:confirm="Restore the ENTIRE database from {{ $b['name'] }}? All changes made after this backup will be lost (a safety copy of the current database is kept)."
                                >
                                    Restore
                                </x-filament::button>
                            </td>
                        </tr>
                    @endforeach
                </tbody>
            </table>
        </div>
    </x-filament::section>
    @endif

    <x-filament::section>
        <h3 style="font-size: 0.875rem; font-weight: 600; margin-bottom: 0.75rem;">Recent fires</h3>
        <div style="overflow-x: auto;">
            <table style="width: 100%; font-size: 0.875rem; border-collapse: collapse;">
                <thead>
                    <tr style="text-align: left; font-size: 0.75rem; font-weight: 600; color: rgb(107 114 128); border-bottom: 1px solid rgb(229 231 235);">
                        <th style="padding: 0.5rem 1rem 0.5rem 0;">When</th>
                        <th style="padding: 0.5rem 1rem 0.5rem 0;">Kind</th>
                        <th style="padding: 0.5rem 1rem 0.5rem 0;">Table</th>
                        <th style="padding: 0.5rem 0;">Record</th>
                    </tr>
                </thead>
                <tbody>
                    @forelse ($recentRuns as $run)
                        <tr style="border-bottom: 1px solid rgb(243 244 246);">
                            <td style="padding: 0.5rem 1rem 0.5rem 0; white-space: nowrap;">{{ $run->created_at?->format('d M Y H:i') }}</td>
                            <td style="padding: 0.5rem 1rem 0.5rem 0;">{{ ucfirst($run->kind) }}</td>
                            <td style="padding: 0.5rem 1rem 0.5rem 0;">{{ $run->table_name }}</td>
                            <td style="padding: 0.5rem 0;">{{ $run->record_id }}</td>
                        </tr>
                    @empty
                        <tr><td colspan="4" style="padding: 1rem; text-align: center; color: rgb(156 163 175);">Nothing has fired yet.</td></tr>
                    @endforelse
                </tbody>
            </table>
        </div>
    </x-filament::section>
</x-filament-panels::page>
