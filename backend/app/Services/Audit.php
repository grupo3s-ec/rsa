<?php

namespace App\Services;

use App\Models\AuditLog;

class Audit
{
    public static function log(
        string $action,
        ?string $entityType = null,
        int|null $entityId = null,
        ?string $entityLabel = null,
    ): void {
        try {
            AuditLog::create([
                'user_id'      => auth()->id(),
                'action'       => $action,
                'entity_type'  => $entityType,
                'entity_id'    => $entityId,
                'entity_label' => $entityLabel,
                'ip_address'   => request()->ip(),
            ]);
        } catch (\Throwable) {
            // No bloquear el flujo principal si falla el log
        }
    }
}
