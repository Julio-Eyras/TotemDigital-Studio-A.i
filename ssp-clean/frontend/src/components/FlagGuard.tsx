/**
 * Componente FlagGuard
 * Protege componentes baseado em flags de permissão
 */

import React from 'react';
import { useFlags, FlagName } from '../hooks/useFlags';

interface FlagGuardProps {
  flag: FlagName | FlagName[];
  children: React.ReactNode;
  fallback?: React.ReactNode;
  requireAll?: boolean; // Se true, requer todas as flags (AND), senão requer pelo menos uma (OR)
}

/**
 * Componente que renderiza children apenas se usuário tiver a(s) flag(s) necessária(s)
 * 
 * @example
 * // Requer flag específica
 * <FlagGuard flag="flag_smart_0">
 *   <Button>Atualizar Totem</Button>
 * </FlagGuard>
 * 
 * @example
 * // Requer pelo menos uma das flags (OR)
 * <FlagGuard flag={['flag_smart_0', 'flag_smart_1']}>
 *   <Button>Ação</Button>
 * </FlagGuard>
 * 
 * @example
 * // Requer todas as flags (AND)
 * <FlagGuard flag={['flag_smart_0', 'flag_smart_1']} requireAll>
 *   <Button>Ação</Button>
 * </FlagGuard>
 */
export const FlagGuard: React.FC<FlagGuardProps> = ({ 
  flag, 
  children, 
  fallback = null,
  requireAll = false
}) => {
  const { hasFlag, hasAnyFlag, hasAllFlags } = useFlags();
  
  let hasPermission = false;
  
  if (Array.isArray(flag)) {
    // Múltiplas flags
    hasPermission = requireAll ? hasAllFlags(flag) : hasAnyFlag(flag);
  } else {
    // Flag única
    hasPermission = hasFlag(flag);
  }
  
  if (!hasPermission) {
    return <>{fallback}</>;
  }
  
  return <>{children}</>;
};
