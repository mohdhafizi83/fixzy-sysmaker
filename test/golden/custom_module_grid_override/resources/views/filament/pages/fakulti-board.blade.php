<x-filament-panels::page>
    <div style="display:flex;gap:1rem;align-items:flex-start;overflow-x:auto;padding-bottom:1rem;">
        @foreach($this->columns as $status => $cards)
            <div data-status="{{ $status }}"
                 ondragover="event.preventDefault(); this.style.background='rgba(99,102,241,.08)';"
                 ondragleave="this.style.background='';"
                 ondrop="event.preventDefault(); this.style.background=''; window.__kanbanDrop(this.dataset.status, event.dataTransfer.getData('text/plain'));"
                 style="flex:0 0 260px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;padding:.6rem;">
                <div style="font-weight:700;font-size:.85rem;margin-bottom:.5rem;color:#374151;">
                    {{ $status }} <span style="color:#9ca3af;font-weight:400;">({{ count($cards) }})</span>
                </div>
                @foreach($cards as $card)
                    <div draggable="true"
                         ondragstart="event.dataTransfer.setData('text/plain', '{{ $card['id'] }}'); event.dataTransfer.effectAllowed='move';"
                         style="background:#fff;border:1px solid #e5e7eb;border-radius:8px;padding:.6rem;margin-bottom:.5rem;box-shadow:0 1px 2px rgba(0,0,0,.05);cursor:grab;">
                        @foreach($card['fields'] as $fname => $fval)
                            <div style="font-size:.8rem;margin-bottom:.15rem;">
                                <span style="color:#6b7280;">{{ $fname }}:</span>
                                <span style="color:#111827;font-weight:500;">{{ $fval }}</span>
                            </div>
                        @endforeach
                    </div>
                @endforeach
                @if(count($cards) === 0)
                    <div style="color:#c4c8cf;font-size:.8rem;text-align:center;padding:1rem 0;">Drop cards here</div>
                @endif
            </div>
        @endforeach
    </div>
    <script>
        window.__kanbanDrop = function (toStatus, recordId) {
            if (!recordId) return;
            var comp = window.Livewire && window.Livewire.first();
            if (comp) comp.call('moveRecord', recordId, toStatus);
        };
    </script>
</x-filament-panels::page>
