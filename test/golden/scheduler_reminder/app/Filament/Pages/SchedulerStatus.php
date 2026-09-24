<?php

namespace App\Filament\Pages;

use App\Models\ScheduleRun;
use Filament\Pages\Page;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;

/**
 * Scheduler Status (Fixzy SysMaker generated code).
 *
 * Read-only overview of the compiled schedules plus the recent fire
 * history from `schedule_runs`, and the backup files on disk (when the
 * backup feature is configured). A "Run now" button triggers the
 * scheduler immediately (useful right after a deploy or for testing).
 *
 * Access: super_admin always; with Shield, anyone granted
 * view_any_scheduler. Fails closed until granted.
 */
class SchedulerStatus extends Page
{
    protected static string | \BackedEnum | null $navigationIcon = 'heroicon-o-clock';

    protected static ?string $navigationLabel = 'Scheduler';

    protected static ?string $title = 'Scheduler Status';

    protected static ?string $slug = 'scheduler';

    protected static ?int $navigationSort = 994;

    protected static string | \UnitEnum | null $navigationGroup = 'System';

    protected string $view = 'filament.pages.scheduler-status';

    /** @var array<int, array<string, mixed>> */
    public array $schedules = [];

    /** @var \Illuminate\Database\Eloquent\Collection<int, ScheduleRun> */
    public $recentRuns;

    /** @var array<int, array{name: string, size: string, modified: string}> */
    public array $backups = [];

    public static function canAccess(): bool
    {
        $user = Auth::user();
        if (! $user) {
            return false;
        }
        if (method_exists($user, 'hasRole') && $user->hasRole('super_admin')) {
            return true;
        }
        if (method_exists($user, 'can')) {
            return $user->can('view_any_scheduler');
        }

        return true;
    }

    public function mount(): void
    {
        $this->refreshData();
    }

    public function runNow(): void
    {
        \Illuminate\Support\Facades\Artisan::call('fixzy:schedule-run');
        $this->refreshData();
    }

    protected function refreshData(): void
    {
        $cmd = \App\Console\Commands\ScheduleRunnerCommand::class;

        $this->schedules = array_merge(
            constant($cmd.'::REMINDERS') ?? [],
            constant($cmd.'::RECURRING') ?? [],
            constant($cmd.'::BACKUPS') ?? []
        );

        $this->recentRuns = ScheduleRun::query()
            ->latest('id')
            ->limit(50)
            ->get();

        $this->backups = [];
        $dir = storage_path('app/backups');
        if (is_dir($dir)) {
            foreach (glob($dir.'/backup_*.gz') ?: [] as $f) {
                $this->backups[] = [
                    'name' => basename($f),
                    'size' => number_format(filesize($f) / 1024, 1).' KB',
                    'modified' => date('d M Y H:i', (int) filemtime($f)),
                ];
            }
            usort($this->backups, fn ($a, $b) => strcmp($b['modified'], $a['modified']));
        }
    }
}
