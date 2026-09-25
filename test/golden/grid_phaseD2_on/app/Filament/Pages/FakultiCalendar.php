<?php

namespace App\Filament\Pages;

use App\Models\Fakulti;
use Filament\Pages\Page;
use Illuminate\Support\Carbon;

class FakultiCalendar extends Page
{
    protected static string | \BackedEnum | null $navigationIcon = 'heroicon-o-calendar-days';

    protected static ?string $navigationLabel = 'Pelajar Fakulti Ekonomi Calendar';

    protected static ?string $title = 'Pelajar Fakulti Ekonomi Calendar';

    protected static ?string $slug = 'fakultis-calendar';

    protected string $view = 'filament.pages.fakulti-calendar';

    public int $year;
    public int $month;

    public function mount(): void
    {
        $now = Carbon::now();
        $this->year = (int) request()->query('year', $now->year);
        $this->month = (int) request()->query('month', $now->month);
    }

    public function prevMonth(): void
    {
        $d = Carbon::create($this->year, $this->month, 1)->subMonth();
        $this->year = $d->year;
        $this->month = $d->month;
    }

    public function nextMonth(): void
    {
        $d = Carbon::create($this->year, $this->month, 1)->addMonth();
        $this->year = $d->year;
        $this->month = $d->month;
    }

    public function goToToday(): void
    {
        $now = Carbon::now();
        $this->year = $now->year;
        $this->month = $now->month;
    }

    public function getMonthLabelProperty(): string
    {
        return Carbon::create($this->year, $this->month, 1)->format('F Y');
    }

    /**
     * @return array<int, array<int, array{day: int, records: array}>> Weeks of the month.
     */
    public function getWeeksProperty(): array
    {
        $first = Carbon::create($this->year, $this->month, 1);
        $last = $first->copy()->endOfMonth();
        $gridStart = $first->copy()->startOfWeek();
        $gridEnd = $last->copy()->endOfWeek();

        $records = Fakulti::query()
            ->whereBetween('tarikh_muktamad', [$gridStart, $gridEnd])
            ->get();

        // Bucket records by Y-m-d of the start field.
        $buckets = [];
        foreach ($records as $r) {
            $d = Carbon::parse($r->tarikh_muktamad)->format('Y-m-d');
            $buckets[$d][] = [
                'id' => $r->getKey(),
                'title' => $this->recordTitle($r),
                'color' => $this->recordColor($r),
            ];
        }

        $weeks = [];
        $cursor = $gridStart->copy();
        while ($cursor <= $gridEnd) {
            $week = [];
            for ($i = 0; $i < 7; $i++) {
                $key = $cursor->format('Y-m-d');
                $week[] = [
                    'day' => (int) $cursor->format('j'),
                    'inMonth' => $cursor->month === $this->month,
                    'isToday' => $cursor->isToday(),
                    'records' => $buckets[$key] ?? [],
                ];
                $cursor->addDay();
            }
            $weeks[] = $week;
        }
        return $weeks;
    }

    protected function recordTitle($record): string
    {
        
        return (string) ($record->nama_fakulti ?? $record->getKey());
        
    }

    protected function recordColor($record): string
    {
        
        return '#6366f1';
        
    }
}
