import React from 'react';
import { Badge } from '@/src/components/ui/Badge';
import type { WarningLevel } from '@/src/types/drrmWarnings';
import { getWarningBadgeVariant } from '../warningPresentation';

interface WarningLevelBadgeProps {
  level: WarningLevel;
}

export function WarningLevelBadge({ level }: WarningLevelBadgeProps) {
  return (
    <Badge
      label={`${level.scale}: ${level.label}`}
      variant={getWarningBadgeVariant(level.code)}
    />
  );
}

