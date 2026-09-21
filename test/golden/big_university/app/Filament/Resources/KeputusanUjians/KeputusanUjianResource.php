<?php

namespace App\Filament\Resources\KeputusanUjians;

use App\Filament\Resources\KeputusanUjians\Pages\CreateKeputusanUjian;
use App\Filament\Resources\KeputusanUjians\Pages\EditKeputusanUjian;
use App\Filament\Resources\KeputusanUjians\Pages\ListKeputusanUjians;
use App\Filament\Resources\KeputusanUjians\Schemas\KeputusanUjianForm;
use App\Filament\Resources\KeputusanUjians\Tables\KeputusanUjiansTable;
use App\Models\KeputusanUjian;
use BackedEnum;
use Filament\Resources\Resource;
use Filament\Schemas\Schema;
use Filament\Support\Icons\Heroicon;
use Filament\Tables\Table;

use Filament\Actions\Action;
use App\Filament\Actions\PrintAction;

use App\Filament\Imports\KeputusanUjianImporter;
use Filament\Actions\ImportAction;
use App\Filament\Exports\KeputusanUjianExporter;
use Filament\Actions\ExportAction;



use Tapp\FilamentAuditing\RelationManagers\AuditsRelationManager;

class KeputusanUjianResource extends Resource
{
    protected static ?string $model = KeputusanUjian::class;
    
    

    protected static string|BackedEnum|null $navigationIcon = Heroicon::OutlinedRectangleStack;

    protected static ?int $navigationSort = 8;
    
    

    public static function form(Schema $schema): Schema
    {
        return KeputusanUjianForm::configure($schema);
    }

    public static function table(Table $table): Table
    {
        return KeputusanUjiansTable::configure($table)
		        ->headerActions([
ImportAction::make()->importer(KeputusanUjianImporter::class),
ExportAction::make()->exporter(KeputusanUjianExporter::class)
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
            'index' => ListKeputusanUjians::route('/'),
            'create' => CreateKeputusanUjian::route('/create'),
            'edit' => EditKeputusanUjian::route('/{record}/edit'),
        ];
    }
	
    // 1. Set the URL
    protected static ?string $slug = 'keputusanujian';

    // 2. Set the label for a single record
    public static function getModelLabel(): string
    {
        return 'KeputusanUjian';
    }

    // 3. Set the label for multiple records (main resource page title)
    public static function getPluralModelLabel(): string
    {
        return 'keputusan_ujian';
    }
	
    

    
}
