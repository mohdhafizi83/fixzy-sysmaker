@php
    // Dapatkan state (kandungan dari lajur 'lokasi_kelas')
    $iframeCode = $getState();
@endphp

@if ($iframeCode)
    @php
        // Gantikan lebar dan tinggi tetap dengan nilai responsif
        $responsiveCode = str_replace('width="600"', 'width="100%"', $iframeCode);
        $responsiveCode = str_replace('height="450"', 'height="450px"', $responsiveCode);
    @endphp

    {{-- Display the modified iframe code --}}
    {!! $responsiveCode !!}
@else
   <!-- <div class="fi-input-wrp">
        <div class="fi-input-disabled text-gray-500">
            Tiada pautan peta disediakan.
        </div>
    </div> -->
@endif