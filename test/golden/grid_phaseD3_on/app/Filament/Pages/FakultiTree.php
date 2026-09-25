<?php

namespace App\Filament\Pages;

use App\Models\Fakulti;
use Filament\Pages\Page;

class FakultiTree extends Page
{
    protected static string | \BackedEnum | null $navigationIcon = 'heroicon-o-queue-list';

    protected static ?string $navigationLabel = 'Pelajar Fakulti Ekonomi Hierarchy';

    protected static ?string $title = 'Pelajar Fakulti Ekonomi Hierarchy';

    protected static ?string $slug = 'fakultis-tree';

    protected string $view = 'filament.pages.fakulti-tree';

    /** @var array<int, array{id: mixed, label: string, depth: int, hasChildren: bool}> */
    public array $rows = [];

    /** Collapsed node ids. */
    public array $collapsed = [];

    public function mount(): void
    {
        $this->loadTree();
    }

    public function toggle(int|string $id): void
    {
        $id = (string) $id;
        if (in_array($id, $this->collapsed)) {
            $this->collapsed = array_values(array_diff($this->collapsed, [$id]));
        } else {
            $this->collapsed[] = $id;
        }
    }

    public function collapseAll(): void
    {
        $this->collapsed = array_map('strval', array_column(array_filter($this->rows, fn ($r) => $r['hasChildren']), 'id'));
    }

    public function expandAll(): void
    {
        $this->collapsed = [];
    }

    protected function loadTree(): void
    {
        $records = Fakulti::all();

        $byId = [];
        foreach ($records as $r) {
            $byId[(string) $r->getKey()] = $r;
        }

        // Children map: parent id -> [child records]
        $children = [];
        $roots = [];
        foreach ($records as $r) {
            $pid = $r->parent_id;
            if ($pid !== null && isset($byId[(string) $pid]) && (string) $pid !== (string) $r->getKey()) {
                $children[(string) $pid][] = $r;
            } else {
                $roots[] = $r;
            }
        }

        // Iterative DFS with visited guard (protects against data cycles).
        $rows = [];
        $visited = [];
        $stack = [];
        foreach (array_reverse($roots) as $root) {
            $stack[] = ['record' => $root, 'depth' => 0];
        }
        while ($stack) {
            $node = array_pop($stack);
            $id = (string) $node['record']->getKey();
            if (isset($visited[$id])) continue;
            $visited[$id] = true;
            $kids = $children[$id] ?? [];
            $rows[] = [
                'id' => $node['record']->getKey(),
                'label' => (string) ($node['record']->nama_fakulti ?? $id),
                'depth' => $node['depth'],
                'hasChildren' => count($kids) > 0,
            ];
            foreach (array_reverse($kids) as $kid) {
                $stack[] = ['record' => $kid, 'depth' => $node['depth'] + 1];
            }
        }

        // Orphans whose ancestors form a cycle: append at depth 0 so nothing
        // silently disappears from the hierarchy view.
        foreach ($records as $r) {
            $id = (string) $r->getKey();
            if (!isset($visited[$id])) {
                $rows[] = [
                    'id' => $r->getKey(),
                    'label' => (string) ($r->nama_fakulti ?? $id),
                    'depth' => 0,
                    'hasChildren' => isset($children[$id]) && count($children[$id]) > 0,
                ];
            }
        }

        $this->rows = $rows;
    }

    /**
     * True when the node is hidden because an ancestor is collapsed.
     * Computed in the blade via a passed-in ancestor map.
     */
    public function getHiddenIdsProperty(): array
    {
        // Build id -> parent map from rows' implicit structure is lossy;
        // instead recompute from records for correctness.
        $records = Fakulti::all();
        $byId = [];
        foreach ($records as $r) {
            $byId[(string) $r->getKey()] = $r;
        }
        $hidden = [];
        foreach ($records as $r) {
            $pid = $r->parent_id;
            $guard = 0;
            while ($pid !== null && $guard++ < 100) {
                if (in_array((string) $pid, $this->collapsed)) {
                    $hidden[] = (string) $r->getKey();
                    break;
                }
                $parent = $byId[(string) $pid] ?? null;
                $pid = $parent ? $parent->parent_id : null;
            }
        }
        return $hidden;
    }
}
