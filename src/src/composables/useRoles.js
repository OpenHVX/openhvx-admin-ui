import { storeToRefs } from 'pinia';
import { useAuth } from '@/stores/auth';

export function useRoles() {
  const auth = useAuth();
  const { user } = storeToRefs(auth);
  const hasRole = (r) => (user.value?.roles || []).includes(r);
  const hasAny  = (arr) => arr.some(hasRole);
  return { hasRole, hasAny };
}
