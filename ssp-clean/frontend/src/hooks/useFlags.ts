/**
 * Hook para verificação de Flags de Permissão
 * Flag_smart_0 a Flag_smart_9
 */

import { useSelector } from 'react-redux';
import { RootState } from '../store';

export interface UserFlags {
  flag_smart_0: boolean;
  flag_smart_1: boolean;
  flag_smart_2: boolean;
  flag_smart_3: boolean;
  flag_smart_4: boolean;
  flag_smart_5: boolean;
  flag_smart_6: boolean;
  flag_smart_7: boolean;
  flag_smart_8: boolean;
  flag_smart_9: boolean;
}

export type FlagName = keyof UserFlags;

/**
 * Hook para verificar flags de permissão do usuário
 */
export function useFlags() {
  const user = useSelector((state: RootState) => state.auth.user);
  
  /**
   * Verifica se usuário tem uma flag específica
   * Owner system sempre retorna true
   */
  const hasFlag = (flag: FlagName): boolean => {
    if (!user) return false;
    
    // Owner system tem todas as flags
    if (user.role === 'owner_system') return true;
    
    // Verificar flag do usuário
    return user.flags?.[flag] ?? false;
  };
  
  /**
   * Verifica se usuário tem pelo menos uma das flags
   */
  const hasAnyFlag = (flags: FlagName[]): boolean => {
    return flags.some(flag => hasFlag(flag));
  };
  
  /**
   * Verifica se usuário tem todas as flags
   */
  const hasAllFlags = (flags: FlagName[]): boolean => {
    return flags.every(flag => hasFlag(flag));
  };
  
  return {
    flags: user?.flags,
    hasFlag,
    hasAnyFlag,
    hasAllFlags,
    isOwner: user?.role === 'owner_system',
    isAdminSql: user?.role === 'admin_sql',
    isAdmin: user?.role === 'admin',
    isOperadorTecnico: user?.role === 'operador_tecnico',
    isOperadorFaturamento: user?.role === 'operador_faturamento',
    isOperadorComercial: user?.role === 'operador_comercial',
    isPublisher: user?.role === 'publisher_user' || user?.user_type === 'publisher_user' || user?.publisherId !== undefined,
    isSubscriber: user?.role === 'subscriber_user' || user?.user_type === 'subscriber_user' || user?.subscriberId !== undefined,
    isPublisherSubscriber: false,
  };
}
