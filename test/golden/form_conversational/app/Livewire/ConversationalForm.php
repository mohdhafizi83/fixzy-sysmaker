<?php

namespace App\Livewire;

use Livewire\Attributes\Layout;
use Livewire\Component;

/**
 * Conversational chat-style form engine (Fixzy SysMaker generated code).
 *
 * Walks the compiled form registry one question at a time, validates each
 * answer server-side, honours visible_if rules, then creates the record.
 * The registry is compiled at generation time — no user input reaches
 * eval/exec here.
 */
#[Layout('livewire.conversational-layout')]
class ConversationalForm extends Component
{
    public string $slug = '';

    /** @var array<string,mixed> Compiled answers keyed by field name. */
    public array $answers = [];

    /** @var array<int,array{role:string,text:string}> Chat transcript. */
    public array $messages = [];

    public string $input = '';

    public int $step = 0;

    public bool $done = false;

    /** Compiled registry (injected by generation). */
    public static function registry(): array
    {
        return [
        'tempah-bilik' => [
            'model' => \App\Models\Tempahan::class,
            'table' => 'tempahan',
            'greeting' => 'Hi! I can help you book a room.',
            'farewell' => 'Booked! See you soon.',
            'fields' => [
                ['name' => 'nama', 'label' => 'Nama', 'type' => 'text', 'required' => false, 'rules' => ['nullable', 'string', 'max:255'], 'required_if_rule' => null, 'visible_if' => null, 'options' => [], 'lookup_table' => null, 'lookup_caption' => null],
                ['name' => 'room_number', 'label' => 'Room Number', 'type' => 'select', 'required' => false, 'rules' => ['nullable', 'integer', 'exists:bilik,id'], 'required_if_rule' => null, 'visible_if' => null, 'options' => null, 'lookup_table' => 'bilik', 'lookup_caption' => 'no_bilik'],
                ['name' => 'slot', 'label' => 'Slot', 'type' => 'select', 'required' => false, 'rules' => ['nullable', 'integer', 'exists:slot_bilik,id'], 'required_if_rule' => null, 'visible_if' => null, 'options' => null, 'lookup_table' => 'slot_bilik', 'lookup_caption' => 'slot_label'],
            ],
        ],
    ];
    }

    public function mount(string $slug): void
    {
        $form = static::registry()[$slug] ?? null;
        if (! $form) {
            abort(404);
        }
        $this->slug = $slug;
        $this->messages[] = ['role' => 'bot', 'text' => $form['greeting']];
        $this->askCurrent();
    }

    protected function form(): array
    {
        return static::registry()[$this->slug];
    }

    /** Fields that are visible given the answers collected so far. */
    protected function visibleFields(): array
    {
        return array_values(array_filter(
            $this->form()['fields'],
            fn (array $f) => $this->isFieldVisible($f)
        ));
    }

    protected function isFieldVisible(array $f): bool
    {
        $rule = $f['visible_if'] ?? null;
        if (! $rule) {
            return true;
        }
        $other = $this->answers[$rule['field']] ?? null;

        return match ($rule['op']) {
            'equals' => (string) $other === (string) $rule['value'],
            'not_equals' => (string) $other !== (string) $rule['value'],
            'in' => in_array((string) $other, array_map('strval', $rule['value']), true),
            'filled' => filled($other),
            'empty' => blank($other),
            'checked' => filled($other) && filter_var($other, FILTER_VALIDATE_BOOLEAN),
            'unchecked' => ! filled($other) || ! filter_var($other, FILTER_VALIDATE_BOOLEAN),
            default => true,
        };
    }

    protected function currentField(): ?array
    {
        $fields = $this->visibleFields();

        return $fields[$this->step] ?? null;
    }

    protected function askCurrent(): void
    {
        $field = $this->currentField();
        if (! $field) {
            $this->finish();

            return;
        }
        $label = $field['label'];
        if ($field['type'] === 'boolean') {
            $label .= ' (yes/no)';
        } elseif (! empty($field['options'])) {
            $label .= ' — options: ' . implode(', ', $field['options']);
        } elseif (! empty($field['lookup_table'])) {
            $label .= ' — ' . $this->lookupOptionsLabel($field);
        }
        $this->messages[] = ['role' => 'bot', 'text' => $label];
    }

    /** List the parent table's records as "id — caption" choices. */
    protected function lookupOptionsLabel(array $field): string
    {
        $table = $field['lookup_table'];
        $caption = $field['lookup_caption'] ?: 'id';
        $rows = \Illuminate\Support\Facades\DB::table($table)
            ->orderBy('id')
            ->limit(20)
            ->get(['id', $caption]);
        $parts = $rows->map(fn ($r) => $r->id . ' — ' . $r->{$caption})->all();
        if ($rows->count() > 20) {
            $parts[] = '…';
        }
        return 'reply with the number: ' . (implode(', ', $parts) ?: '(none available)');
    }

    public function submit(): void
    {
        if ($this->done) {
            return;
        }
        $field = $this->currentField();
        if (! $field) {
            $this->finish();

            return;
        }

        $value = $this->normalizeInput($field);

        $rules = $field['rules'];
        if (! empty($field['required_if_rule'])) {
            $rules[] = $field['required_if_rule'];
        }
        // Validate with previously collected answers merged in so
        // required_if / required_with reference real field names.
        $data = $this->answers;
        $data[$field['name']] = $value;
        $validator = \Illuminate\Support\Facades\Validator::make(
            $data,
            [$field['name'] => $rules],
            [],
            [$field['name'] => $field['label']]
        );
        if ($validator->fails()) {
            $this->addError('input', $validator->errors()->first($field['name']));

            return;
        }

        $this->answers[$field['name']] = $value;
        $this->messages[] = ['role' => 'user', 'text' => $this->displayAnswer($field, $value)];
        $this->input = '';
        $this->step++;
        $this->askCurrent();
    }

    protected function normalizeInput(array $field): mixed
    {
        $raw = trim($this->input);
        if ($field['type'] === 'boolean') {
            return in_array(strtolower($raw), ['yes', 'y', '1', 'true'], true) ? 1 : 0;
        }
        if ($raw === '') {
            return null;
        }

        return $raw;
    }

    protected function displayAnswer(array $field, mixed $value): string
    {
        if ($field['type'] === 'boolean') {
            return $value ? 'Yes' : 'No';
        }

        return (string) ($value ?? '—');
    }

    protected function finish(): void
    {
        $form = $this->form();
        $model = $form['model'];

        // Explicit fill — no mass assignment of unknown keys.
        $data = [];
        foreach ($form['fields'] as $f) {
            if (array_key_exists($f['name'], $this->answers) && $this->isFieldVisible($f)) {
                $data[$f['name']] = $this->answers[$f['name']];
            }
        }

        $record = new $model();
        $record->fill($data);
        $record->save();

        $this->done = true;
        $this->messages[] = ['role' => 'bot', 'text' => $form['farewell']];
    }

    public function render(): \Illuminate\View\View
    {
        return view('livewire.conversational-form');
    }
}
