<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Check Submission Status</title>
    <style>
        body { font-family: -apple-system, 'Segoe UI', Roboto, sans-serif; background: #f3f4f6; margin: 0; padding: 24px; color: #1f2937; }
        .card { max-width: 560px; margin: 40px auto; background: #fff; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,.1); padding: 32px; }
        h1 { margin: 0 0 8px; font-size: 22px; }
        .intro { color: #4b5563; margin: 0 0 20px; }
        label { display: block; font-weight: 600; margin: 14px 0 4px; font-size: 14px; }
        input { width: 100%; padding: 10px 12px; border: 1px solid #d1d5db; border-radius: 8px; font-size: 15px; }
        button { margin-top: 20px; background: #f97316; color: #fff; border: 0; border-radius: 8px; padding: 12px 28px; font-size: 15px; font-weight: 600; cursor: pointer; }
        .err { color: #dc2626; font-size: 13px; margin-top: 4px; }
        .result { margin-top: 20px; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 16px; }
        .result .ref { font-family: ui-monospace, monospace; font-weight: 700; }
        .badge { display: inline-block; background: #fff7ed; border: 1px solid #fed7aa; color: #9a3412; border-radius: 999px; padding: 2px 12px; font-weight: 600; font-size: 13px; }
        .muted { color: #6b7280; font-size: 13px; }
        a { color: #f97316; }
        button:active { transform: translateY(1px); }
        @media (max-width: 640px) {
            body { padding: 12px; }
            .card { padding: 20px 16px; margin-top: 16px; border-radius: 10px; }
            input { font-size: 16px; } /* prevent iOS auto-zoom on focus */
            button[type=submit] { width: 100%; padding: 14px 28px; }
        }
    </style>
</head>
<body>
<div class="card">
    <h1>Check your submission status</h1>
    <p class="intro">Enter the reference number you received, plus the email address used on the submission.</p>

    @if(isset($found) && $found)
        <div class="result">
            <div>Reference: <span class="ref">{{ $reference }}</span></div>
            @if($status !== null)
                <div style="margin-top:8px;">Status: <span class="badge">{{ ucfirst($status) }}</span></div>
            @endif
            <div class="muted" style="margin-top:8px;">Last updated: {{ $updatedAt?->format('M j, Y H:i') }}</div>
        </div>
    @else
        <form method="POST" action="{{ route('public.form.lookup.check', ['slug' => $slug]) }}">
            @csrf
            <label for="reference">Reference number</label>
            <input type="text" id="reference" name="reference" value="{{ old('reference') }}" required>
            @error('reference')<div class="err">{{ $message }}</div>@enderror

            @if($form['email_field'])
                <label for="email">Email address</label>
                <input type="email" id="email" name="email" value="{{ old('email') }}" required>
                @error('email')<div class="err">{{ $message }}</div>@enderror
            @endif

            @error('throttle')<div class="err">{{ $message }}</div>@enderror

            <button type="submit">Check status</button>
        </form>
    @endif

    <p style="margin-top:20px;"><a href="{{ route('public.form.show', ['slug' => $slug]) }}">← Back to form</a></p>
</div>
</body>
</html>

