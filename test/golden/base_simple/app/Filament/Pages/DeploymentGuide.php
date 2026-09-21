<?php

namespace App\Filament\Pages;

use Filament\Pages\Page;
use Illuminate\Support\Facades\Config;

class DeploymentGuide extends Page
{
    protected static ?string $navigationIcon = 'heroicon-o-rocket-launch';
    
    protected static ?string $navigationLabel = 'Deployment Guide';
    
    protected static ?string $title = 'Panduan Deployment & Database';

    protected static ?string $slug = 'deployment-guide';

    protected static string $view = 'filament.pages.deployment-guide';
    
    protected static ?int $navigationSort = 999;

    protected static ?string $navigationGroup = 'System';

    public $currentConnection;
    public $isSqlite;

    public function mount()
    {
        // Logik ini berjalan secara runtime (semasa aplikasi dibuka)
        $this->currentConnection = Config::get('database.default');
        $this->isSqlite = $this->currentConnection === 'sqlite';
    }
}