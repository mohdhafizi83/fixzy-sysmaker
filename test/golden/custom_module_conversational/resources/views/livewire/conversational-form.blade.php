@php
    $form = \App\Livewire\ConversationalForm::registry()[$slug] ?? null;
@endphp
<div style="max-width:560px;margin:40px auto;font-family:-apple-system,'Segoe UI',Roboto,sans-serif;background:#fff;border-radius:12px;box-shadow:0 1px 3px rgba(0,0,0,.1);overflow:hidden;">
    <div style="background:#f97316;color:#fff;padding:16px 20px;font-weight:600;">
        💬 Chat
    </div>
    <div style="height:420px;overflow-y:auto;padding:16px;background:#f3f4f6;" id="chat-box">
        @foreach($messages as $m)
            <div style="display:flex;justify-content:{{ $m['role'] === 'user' ? 'flex-end' : 'flex-start' }};margin-bottom:10px;">
                <div style="max-width:75%;padding:10px 14px;border-radius:14px;font-size:15px;line-height:1.4;
                    {{ $m['role'] === 'user' ? 'background:#f97316;color:#fff;border-bottom-right-radius:4px;' : 'background:#fff;color:#1f2937;border:1px solid #e5e7eb;border-bottom-left-radius:4px;' }}">
                    {{ $m['text'] }}
                </div>
            </div>
        @endforeach
        @error('input')
            <div style="display:flex;justify-content:flex-start;margin-bottom:10px;">
                <div style="max-width:75%;padding:10px 14px;border-radius:14px;background:#fef2f2;border:1px solid #fecaca;color:#dc2626;font-size:14px;">
                    {{ $message }} — please try again.
                </div>
            </div>
        @enderror
    </div>
    @if(! $done)
        <form wire:submit="submit" style="display:flex;gap:8px;padding:12px 16px;border-top:1px solid #e5e7eb;background:#fff;">
            <input type="text" wire:model="input" placeholder="Type your answer…" autocomplete="off"
                   style="flex:1;padding:10px 12px;border:1px solid #d1d5db;border-radius:8px;font-size:15px;">
            <button type="submit" style="background:#f97316;color:#fff;border:0;border-radius:8px;padding:10px 22px;font-size:15px;font-weight:600;cursor:pointer;">Send</button>
        </form>
    @else
        <div style="padding:14px 16px;border-top:1px solid #e5e7eb;background:#fff;color:#059669;font-weight:600;">
            ✓ Submission complete
        </div>
    @endif
</div>
<script>
    // Keep the chat scrolled to the newest message.
    (function () {
        const box = document.getElementById('chat-box');
        if (box) { box.scrollTop = box.scrollHeight; }
        document.addEventListener('livewire:navigated', () => {
            const b = document.getElementById('chat-box');
            if (b) { b.scrollTop = b.scrollHeight; }
        });
    })();
</script>

