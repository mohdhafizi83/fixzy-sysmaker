@include('filament-widgets::table-widget')

@if ($this->refreshMode() === 'poll')
    {{-- TableWidget has no native CanPoll; this hidden driver ticks the refresh. --}}
    <div wire:poll.{{ $this->pollIntervalString() }} style="display:none"></div>
@endif

@script
    <script>
        (() => {
            if (@js($this->refreshMode()) !== 'live') return;
            const table = @js($this->getLiveTable());
            if (!table) return;
            const subscribe = () => {
                window.Echo.private('fixzy.data.' + table).listen('.fixzy.data.changed', () => {
                    $wire.$refresh();
                });
            };
            window.addEventListener('EchoLoaded', () => subscribe());
            if (window.Echo) subscribe();
        })();
    </script>
@endscript

