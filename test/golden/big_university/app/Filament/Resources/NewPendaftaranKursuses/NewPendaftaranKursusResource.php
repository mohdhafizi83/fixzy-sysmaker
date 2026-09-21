<?php

namespace App\Filament\Resources\NewPendaftaranKursuses;

use App\Filament\Resources\NewPendaftaranKursuses\Pages\CreateNewPendaftaranKursus;
use App\Filament\Resources\NewPendaftaranKursuses\Pages\EditNewPendaftaranKursus;
use App\Filament\Resources\NewPendaftaranKursuses\Pages\ListNewPendaftaranKursuses;
use App\Filament\Resources\NewPendaftaranKursuses\Schemas\NewPendaftaranKursusForm;
use App\Filament\Resources\NewPendaftaranKursuses\Tables\NewPendaftaranKursusesTable;
use App\Models\PendaftaranKursus;
use BackedEnum;
use Filament\Resources\Resource;
use Filament\Schemas\Schema;
use Filament\Support\Icons\Heroicon;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Builder;
use Filament\Actions\Action;
use App\Filament\Actions\PrintAction;


use App\Filament\Exports\PendaftaranKursusExporter;
use Filament\Actions\ExportAction;



use Tapp\FilamentAuditing\RelationManagers\AuditsRelationManager;

class NewPendaftaranKursusResource extends Resource
{
    protected static ?string $model = PendaftaranKursus::class;
    
    

    protected static string|BackedEnum|null $navigationIcon = Heroicon::OutlinedRectangleStack;

    
    
    
    public static function getEloquentQuery(): Builder
    {
        return parent::getEloquentQuery()
            ->where(function($q) {
            $q->where('gred', '=', 'A');
            $q->orWhere('gred', '=', 'B');
            });
    }

    public static function form(Schema $schema): Schema
    {
        return NewPendaftaranKursusForm::configure($schema);
    }

    public static function table(Table $table): Table
    {
        return NewPendaftaranKursusesTable::configure($table)
		        ->headerActions([

ExportAction::make()->exporter(PendaftaranKursusExporter::class)
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
            'index' => ListNewPendaftaranKursuses::route('/'),
            'create' => CreateNewPendaftaranKursus::route('/create'),
            'edit' => EditNewPendaftaranKursus::route('/{record}/edit'),
        ];
    }
	
    // 1. Set the URL
    protected static ?string $slug = 'newpendaftarankursus';

    // 2. Set the label for a single record
    public static function getModelLabel(): string
    {
        return 'PendaftaranKursus';
    }

    // 3. Set the label for multiple records (main resource page title)
    public static function getPluralModelLabel(): string
    {
        return 'New Pendaftaran Baru';
    }
	
    
    public static function getNavigationGroup(): string
    {
        return 'Akademik';
    }

    
    public static function getNavigationSort(): int
    {
        return 2;
    }
}
