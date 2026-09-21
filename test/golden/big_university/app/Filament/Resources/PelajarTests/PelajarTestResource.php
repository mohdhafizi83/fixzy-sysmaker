<?php

namespace App\Filament\Resources\PelajarTests;

use App\Filament\Resources\PelajarTests\Pages\CreatePelajarTest;
use App\Filament\Resources\PelajarTests\Pages\EditPelajarTest;
use App\Filament\Resources\PelajarTests\Pages\ListPelajarTests;
use App\Filament\Resources\PelajarTests\Schemas\PelajarTestForm;
use App\Filament\Resources\PelajarTests\Tables\PelajarTestsTable;
use App\Models\Pelajar;
use BackedEnum;
use Filament\Resources\Resource;
use Filament\Schemas\Schema;
use Filament\Support\Icons\Heroicon;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Builder;
use Filament\Actions\Action;
use App\Filament\Actions\PrintAction;


use App\Filament\Exports\PelajarExporter;
use Filament\Actions\ExportAction;



use Tapp\FilamentAuditing\RelationManagers\AuditsRelationManager;

class PelajarTestResource extends Resource
{
    protected static ?string $model = Pelajar::class;
    
    

    protected static string|BackedEnum|null $navigationIcon = Heroicon::OutlinedRectangleStack;

    protected static ?int $navigationSort = 7;
    
    
    public static function getEloquentQuery(): Builder
    {
        return parent::getEloquentQuery()->withCount(['dokumenPelajars'])
            ->where('created_by', auth()->id())
            ->where(function($q) {
            $q->where('id', '>', '1');
            });
    }

    public static function form(Schema $schema): Schema
    {
        return PelajarTestForm::configure($schema);
    }

    public static function table(Table $table): Table
    {
        return PelajarTestsTable::configure($table)
		        ->headerActions([

ExportAction::make()->exporter(PelajarExporter::class)
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
            'index' => ListPelajarTests::route('/'),
            'create' => CreatePelajarTest::route('/create'),
            'edit' => EditPelajarTest::route('/{record}/edit'),
        ];
    }
	
    // 1. Set the URL
    protected static ?string $slug = 'pelajartest';

    // 2. Set the label for a single record
    public static function getModelLabel(): string
    {
        return 'Pelajar';
    }

    // 3. Set the label for multiple records (main resource page title)
    public static function getPluralModelLabel(): string
    {
        return 'PelajarTest';
    }
	
    

    
}
