<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * One row per approval transition: who moved which record from which
 * status to which status, with the optional comment.
 */
class ApprovalHistory extends Model
{
    protected $table = 'approval_histories';

    protected $fillable = [
        'record_type',
        'record_id',
        'from_status',
        'to_status',
        'comment',
        'user_id',
    ];

    public function record()
    {
        return $this->morphTo('record');
    }

    public function user()
    {
        return $this->belongsTo(User::class, 'user_id');
    }
}
