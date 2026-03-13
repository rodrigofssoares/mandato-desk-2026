import { useAuth } from '@/context/AuthContext';
import type { Role } from '@/types/permissions';

export function useUserRole() {
  const { profile, isLoading, isProfileLoading } = useAuth();

  const role = (profile?.role ?? '') as Role;
  const isAdmin = role === 'admin';

  return {
    role,
    isAdmin,
    isLoading: isLoading || isProfileLoading,
  };
}
