<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

use App\Models\Concerns\HasAudits;


class TicketReply extends Model 
{
	use HasFactory;
    use HasAudits;
    
    
    
    /**
     *
     * @var string
     */
    protected $table = 'ticket_replies';
    /**
     *
     * @var string
     */
    protected $primaryKey = 'id';
    /**
     *
     * @var array<int, string>
     */
    protected $fillable = [
        
        'ticket_id',
        'reply_from',
        'is_agent_reply',
        'message'
    
    ];
    
    


    public function ticket()
    {
        return $this->belongsTo(Ticket::class, 'ticket_id', 'id');
    }	




    protected static function boot()
    {
        parent::boot();

        static::creating(function ($model) {
            if (empty($model->created_by)) {
                $model->created_by = auth()->id();
            }
            if (empty($model->updated_by)) {
                $model->updated_by = auth()->id();
            }
        });

        static::updating(function ($model) {
            $model->updated_by = auth()->id();
        });
    }

}
