<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * One uploaded document attached to any record (Fixzy SysMaker generated
 * code). Polymorphic: record_type/record_id point at the owning model,
 * so every table gets N-files-per-record without schema changes.
 *
 * Files live on the private `local` disk — they are never exposed via a
 * public URL. Downloads go through the signed route registered by
 * AttachmentServiceProvider, which re-checks panel auth before
 * streaming the file.
 */
class Attachment extends Model
{
    protected $table = 'attachments';

    protected $fillable = [
        'record_type',
        'record_id',
        'file_path',
        'original_name',
        'mime',
        'size',
        'uploaded_by',
    ];

    public function record()
    {
        return $this->morphTo('record');
    }

    public function uploader()
    {
        return $this->belongsTo(User::class, 'uploaded_by');
    }

    /** Human-readable size, e.g. "1.4 MB". */
    public function getHumanSizeAttribute(): string
    {
        $bytes = (int) $this->size;
        foreach (['B', 'KB', 'MB', 'GB'] as $unit) {
            if ($bytes < 1024 || $unit === 'GB') {
                return round($bytes, $unit === 'B' ? 0 : 1) . ' ' . $unit;
            }
            $bytes /= 1024;
        }

        return $bytes . ' B';
    }

    public function isImage(): bool
    {
        return str_starts_with((string) $this->mime, 'image/');
    }
}
