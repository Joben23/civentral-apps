import type { AccountCheckResult } from '@/src/services/auth-service';

export type AccountAuthRoute = '/(auth)/login' | '/(auth)/register';

export function getAccountAuthRoute(result: AccountCheckResult): AccountAuthRoute | null {
  if (result.status === 'exists') return '/(auth)/login';
  if (result.status === 'not_found') return '/(auth)/register';
  return null;
}
