<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use App\Models\Concerns\HasAudits;

use App\Models\Concerns\HasApproval;

class LogPenting extends Model 
{
	use HasFactory;
    use HasAudits;
    use SoftDeletes;
    
    use HasApproval;
    
    /**
     *
     * @var string
     */
    protected $table = 'log_penting';
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
        
        'perihal',
        'perihal_status',
        'email_pengadu',
        'public_reference'
    
    ];
    
    
    /** Approval workflow (Fixzy SysMaker Approvals module) — generated. */
    public const APPROVAL_STATUS_FIELD = 'perihal_status';
    public const APPROVAL_INITIAL = 'draft';

    public const APPROVAL_STATUSES = [
        'draft' => ['label' => 'Draft', 'color' => 'gray', 'final' => false],
        'approved' => ['label' => 'Approved', 'color' => 'success', 'final' => true],
    ];

    public const APPROVAL_TRANSITIONS = [
        ['from' => 'draft', 'to' => 'approved', 'label' => 'Approve', 'roles' => 'admin', 'require_comment' => true, 'notify' => 'admin'],
    ];

	




}
