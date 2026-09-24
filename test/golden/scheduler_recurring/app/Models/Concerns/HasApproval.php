<?php

namespace App\Models\Concerns;

use App\Models\ApprovalHistory;
use App\Notifications\ApprovalTransitioned;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\DB;

/**
 * Approval workflow state machine (Fixzy SysMaker Approvals module).
 *
 * The allowed statuses and transitions are defined per table at design
 * time and compiled into APPROVAL_STATUSES / APPROVAL_TRANSITIONS below
 * by the generator. All guards run SERVER-SIDE: a transition that is
 * not in the map is rejected even if the UI is bypassed (direct model
 * calls, API, tinker).
 *
 * Usage:
 *   $record->transitionTo('approved', comment: 'OK');
 */
trait HasApproval
{
    /** New records start in the configured initial status. */
    protected static function bootHasApproval(): void
    {
        static::creating(function ($record): void {
            $field = static::APPROVAL_STATUS_FIELD;
            if (blank($record->{$field})) {
                $record->{$field} = static::APPROVAL_INITIAL;
            }
        });

        // Final statuses lock the record: deleting an approved/closed
        // record is refused at the model layer (audit-friendly).
        static::deleting(function ($record): void {
            if ($record->isApprovalLocked()) {
                throw new \RuntimeException(sprintf(
                    '%s #%s is in final status "%s" and cannot be deleted.',
                    class_basename($record),
                    $record->getKey(),
                    $record->{$record->approvalStatusField()}
                ));
            }
        });
    }

    /**
     * Perform a status transition with full validation.
     *
     * @throws \InvalidArgumentException when the transition is illegal
     * @throws \RuntimeException when the record is locked or a comment is required
     */
    public function transitionTo(string $to, ?string $comment = null, $user = null): self
    {
        $user = $user ?: auth()->user();
        $from = (string) $this->{$this->approvalStatusField()};

        $transition = $this->findTransition($from, $to);
        if (! $transition) {
            throw new \InvalidArgumentException(
                "Transition from '{$from}' to '{$to}' is not allowed for {$this->getTable()}."
            );
        }

        if ($this->isApprovalLocked()) {
            throw new \RuntimeException('This record is final and can no longer be changed.');
        }

        if (! empty($transition['require_comment']) && trim((string) $comment) === '') {
            throw new \RuntimeException('A comment is required for this step.');
        }

        // Permission check: transition roles are comma-separated Shield
        // role names. Empty roles = any authenticated user.
        if (! empty($transition['roles'])) {
            $roles = array_map('trim', explode(',', $transition['roles']));
            $allowed = $user && (
                ! method_exists($user, 'hasAnyRole')
                || $user->hasRole('super_admin')
                || $user->hasAnyRole($roles)
            );
            if (! $allowed) {
                throw new \RuntimeException('You do not have the role required for this step.');
            }
        }

        DB::transaction(function () use ($from, $to, $comment, $user) {
            $this->{$this->approvalStatusField()} = $to;
            $this->save();

            ApprovalHistory::create([
                'record_type' => static::class,
                'record_id' => $this->getKey(),
                'from_status' => $from,
                'to_status' => $to,
                'comment' => $comment,
                'user_id' => $user?->getKey(),
            ]);
        });

        // Notify configured groups (best-effort; never breaks the move).
        try {
            $this->notifyApprovalParties($transition, $from, $to, $user);
        } catch (\Throwable $e) {
            report($e);
        }

        return $this;
    }

    public function approvalStatusField(): string
    {
        return static::APPROVAL_STATUS_FIELD;
    }

    /** The status value that new records start with. */
    public static function approvalInitialStatus(): string
    {
        return static::APPROVAL_INITIAL;
    }

    public function isApprovalLocked(): bool
    {
        $status = static::APPROVAL_STATUSES[(string) $this->{$this->approvalStatusField()}] ?? null;

        return (bool) ($status['final'] ?? false);
    }

    /** Transitions available from the record's current status. */
    public function availableTransitions(): array
    {
        if ($this->isApprovalLocked()) {
            return [];
        }
        $from = (string) $this->{$this->approvalStatusField()};

        return array_values(array_filter(
            static::APPROVAL_TRANSITIONS,
            fn (array $t): bool => $t['from'] === $from
        ));
    }

    /** Filament-visible variant: transitions the current user may perform. */
    public function visibleTransitionsFor($user): array
    {
        return array_values(array_filter(
            $this->availableTransitions(),
            function (array $t) use ($user): bool {
                if (empty($t['roles'])) {
                    return true;
                }
                $roles = array_map('trim', explode(',', $t['roles']));

                return $user
                    && (
                        ! method_exists($user, 'hasAnyRole')
                        || $user->hasRole('super_admin')
                        || $user->hasAnyRole($roles)
                    );
            }
        ));
    }

    protected function findTransition(string $from, string $to): ?array
    {
        foreach (static::APPROVAL_TRANSITIONS as $t) {
            if ($t['from'] === $from && $t['to'] === $to) {
                return $t;
            }
        }

        return null;
    }

    protected function notifyApprovalParties(array $transition, string $from, string $to, $user): void
    {
        $notify = trim((string) ($transition['notify'] ?? ''));
        if ($notify === '') {
            return;
        }

        $label = class_basename(static::class);
        $title = $label.' moved from '.ucfirst(str_replace('_', ' ', $from)).' to '.ucfirst(str_replace('_', ' ', $to));

        if ($notify === 'submitter') {
            // Notify the user who performed the previous transition (or the
            // record owner when the record tracks one).
            $target = ApprovalHistory::where('record_type', static::class)
                ->where('record_id', $this->getKey())
                ->where('user_id', '!=', $user?->getKey())
                ->latest('id')
                ->value('user_id');
            if ($target && ($model = config('auth.providers.users.model')) && ($u = $model::find($target))) {
                $u->notify(new ApprovalTransitioned($title, $from, $to, $this->getKey()));
            }

            return;
        }

        // Comma-separated Shield role names. Shield exposes role queries
        // as a local scope (scopeRole), so call the static query method
        // directly and guard with try/catch (no-op without Shield).
        $model = config('auth.providers.users.model');
        try {
            foreach (array_map('trim', explode(',', $notify)) as $role) {
                $model::role($role)->get()->each(
                    fn ($u) => $u->notify(new ApprovalTransitioned($title, $from, $to, $this->getKey()))
                );
            }
        } catch (\Throwable $e) {
            // Role-based notify unavailable (Shield off / role missing) — skip silently.
            report($e);
        }
    }

    /** Relation to the full approval trail of this record. */
    public function approvalHistories()
    {
        return $this->morphMany(ApprovalHistory::class, 'record')->latest('id');
    }

    /** Scope: records still moving (not in a final status). */
    public function scopeOpenApprovals(Builder $query): Builder
    {
        $finals = array_keys(array_filter(
            static::APPROVAL_STATUSES,
            fn (array $s): bool => ! empty($s['final'])
        ));

        return $query->whereNotIn($this->approvalStatusField(), $finals);
    }
}
