<?php

namespace App\Filament\Resources\PengesahanPendaftarans;

use App\Filament\Resources\PengesahanPendaftarans\Pages\CreatePengesahanPendaftaran;
use App\Filament\Resources\PengesahanPendaftarans\Pages\EditPengesahanPendaftaran;
use App\Filament\Resources\PengesahanPendaftarans\Pages\ListPengesahanPendaftarans;
use App\Filament\Resources\PengesahanPendaftarans\Schemas\PengesahanPendaftaranForm;
use App\Filament\Resources\PengesahanPendaftarans\Tables\PengesahanPendaftaransTable;
use App\Models\PengesahanPendaftaran;
use BackedEnum;
use Filament\Resources\Resource;
use Filament\Schemas\Schema;
use Filament\Support\Icons\Heroicon;
use Filament\Tables\Table;

use Filament\Actions\Action;
use App\Filament\Actions\PrintAction;

use App\Filament\Imports\PengesahanPendaftaranImporter;
use Filament\Actions\ImportAction;
use App\Filament\Exports\PengesahanPendaftaranExporter;
use Filament\Actions\ExportAction;



use Tapp\FilamentAuditing\RelationManagers\AuditsRelationManager;

class PengesahanPendaftaranResource extends Resource
{
    protected static ?string $model = PengesahanPendaftaran::class;
    
    

    protected static string|BackedEnum|null $navigationIcon = Heroicon::OutlinedRectangleStack;

    protected static ?int $navigationSort = 0;
    
    

    public static function form(Schema $schema): Schema
    {
        return PengesahanPendaftaranForm::configure($schema);
    }

    public static function table(Table $table): Table
    {
        return PengesahanPendaftaransTable::configure($table)
		        ->headerActions([
ImportAction::make()->importer(PengesahanPendaftaranImporter::class),
ExportAction::make()->exporter(PengesahanPendaftaranExporter::class)
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
            'index' => ListPengesahanPendaftarans::route('/'),
            'create' => CreatePengesahanPendaftaran::route('/create'),
            'edit' => EditPengesahanPendaftaran::route('/{record}/edit'),
        ];
    }
	
    // 1. Set the URL
    protected static ?string $slug = 'pengesahanpendaftaran';

    // 2. Set the label for a single record
    public static function getModelLabel(): string
    {
        return 'PengesahanPendaftaran';
    }

    // 3. Set the label for multiple records (main resource page title)
    public static function getPluralModelLabel(): string
    {
        return 'Pengesahan Pendaftaran';
    }
	
    

    
}
