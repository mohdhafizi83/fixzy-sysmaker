<?php

namespace App\Filament\Resources\KontrakNilaiTinggis;

use App\Filament\Resources\KontrakNilaiTinggis\Pages\CreateKontrakNilaiTinggi;
use App\Filament\Resources\KontrakNilaiTinggis\Pages\EditKontrakNilaiTinggi;
use App\Filament\Resources\KontrakNilaiTinggis\Pages\ListKontrakNilaiTinggis;
use App\Filament\Resources\KontrakNilaiTinggis\Schemas\KontrakNilaiTinggiForm;
use App\Filament\Resources\KontrakNilaiTinggis\Tables\KontrakNilaiTinggisTable;
use App\Models\Kontrak;
use BackedEnum;
use Filament\Resources\Resource;
use Filament\Schemas\Schema;
use Filament\Support\Icons\Heroicon;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Builder;
use Filament\Actions\Action;
use App\Filament\Actions\PrintAction;


use App\Filament\Exports\KontrakExporter;
use Filament\Actions\ExportAction;



use Tapp\FilamentAuditing\RelationManagers\AuditsRelationManager;

class KontrakNilaiTinggiResource extends Resource
{
    protected static ?string $model = Kontrak::class;
    
    

    protected static string|BackedEnum|null $navigationIcon = Heroicon::OutlinedRectangleStack;

    protected static ?int $navigationSort = 9;
    
    
    public static function getEloquentQuery(): Builder
    {
        return parent::getEloquentQuery()
            ->where('syarikat_id', auth()->user()->syarikat_id)
            ->where(function($q) {
            $q->where('nilai', '>', '10000');
            });
    }

    public static function form(Schema $schema): Schema
    {
        return KontrakNilaiTinggiForm::configure($schema);
    }

    public static function table(Table $table): Table
    {
        return KontrakNilaiTinggisTable::configure($table)
		        ->headerActions([

ExportAction::make()->exporter(KontrakExporter::class)
                /*->enableVisibleTableColumnsByDefault()*/,
			Action::make('print')
                    ->label('Print')
                    ->icon('heroicon-o-printer')
                    ->color('gray')
                    ->url(fn (): string => request()->fullUrlWithQuery(['print' => 1]))
                    ->openUrlInNewTab(),
        ]);
    }

    public static function getRelations(): array
    {
        $relations = [
            
        ];
		

    // Hanya tambah AuditsRelationManager jika pengguna boleh melihatnya
    
        if (auth()->check() && auth()->user()->can('view_any_audit')) {
            $relations[] = AuditsRelationManager::class;
        }
	
	return $relations;
    }

    public static function getPages(): array
    {
        return [
            'index' => ListKontrakNilaiTinggis::route('/'),
            'create' => CreateKontrakNilaiTinggi::route('/create'),
            'edit' => EditKontrakNilaiTinggi::route('/{record}/edit'),
        ];
    }
	
    // 1. Set the URL
    protected static ?string $slug = 'kontraknilaitinggi';

    // 2. Set the label for a single record
    public static function getModelLabel(): string
    {
        return 'Kontrak';
    }

    // 3. Set the label for multiple records (main resource page title)
    public static function getPluralModelLabel(): string
    {
        return 'KontrakNilaiTinggi';
    }
	
    

    
}
