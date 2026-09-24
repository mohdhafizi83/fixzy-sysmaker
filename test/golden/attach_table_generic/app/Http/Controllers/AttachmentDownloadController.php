<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * Streams a private file from the local disk through a signed URL
 * (Fixzy SysMaker generated code).
 *
 * The local disk is deliberately NOT symlinked into the public web root,
 * so the only way to read one of these files is a URL created via
 * URL::temporarySignedRoute() — the signature covers the path, so a
 * tampered path fails validation with 403 before we touch the disk.
 */
class AttachmentDownloadController extends Controller
{
    public function __invoke(Request $request, string $path): StreamedResponse
    {
        abort_unless($request->hasValidSignature(), 403, 'Link is invalid or expired.');

        // Defence in depth: reject traversal even though the signature
        // already pins the exact path.
        $normalized = str_replace('\\', '/', $path);
        abort_if(str_contains($normalized, '..') || str_starts_with($normalized, '/'), 403);

        $disk = Storage::disk('local');
        abort_unless($disk->exists($normalized), 404);

        $name = $request->query('name', basename($normalized));

        return $disk->response($normalized, $name, [
            'Content-Type' => $disk->mimeType($normalized) ?: 'application/octet-stream',
            'Content-Disposition' => 'attachment; filename="' . str_replace('"', '', $name) . '"',
        ]);
    }
}
