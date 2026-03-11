@php
    // Dapatkan state (URL dari lajur 'youtube_intro')
    $videoUrl = $getState();
@endphp

@if ($videoUrl)
    <div class="aspect-w-16 aspect-h-9">
        <iframe
            src="{{ $videoUrl }}"
            title="YouTube video player"
            frameborder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowfullscreen>
        </iframe>
    </div>
@else
    <!-- <div class="fi-input-wrp">
        <div class="fi-input-disabled text-gray-500">
            Tiada pautan video disediakan.
        </div>
    </div> -->
@endif