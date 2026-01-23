/**
 * Sistema de Verificação de Flags de Permissão
 * Flag_smart_0 a Flag_smart_9
 */

import { getDatabase } from '../config/database';
import { logError, logDebug } from './loggerHelper';

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

export interface UserWithFlags {
  id: number;
  role: string;
  user_type?: string;
  publisher_id?: number;
  subscriber_id?: number;
  flags?: UserFlags;
}

export type FlagName = `flag_smart_${0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9}`;

/**
 * Verifica se usuário tem uma flag específica
 * Prioridade: owner_system > flags personalizadas > flags padrão da role
 */
export async function hasFlag(
  user: UserWithFlags, 
  flag: FlagName
): Promise<boolean> {
  // 1. Owner system tem todas as flags
  if (user.role === 'owner_system') {
    return true;
  }
  
  // 2. Verificar flag personalizada do usuário
  if (user.flags && user.flags[flag]) {
    return true;
  }
  
  // 3. Buscar flags padrão da role
  const roleFlags = await getRoleFlagsDefault(user.role);
  if (roleFlags && roleFlags[flag]) {
    return true;
  }
  
  return false;
}

/**
 * Obtém flags padrão de uma role
 */
export async function getRoleFlagsDefault(role: string): Promise<UserFlags | null> {
  try {
    const db = getDatabase();
    const result = await db.findFirst(`
      SELECT 
        flag_smart_0, flag_smart_1, flag_smart_2, flag_smart_3, flag_smart_4,
        flag_smart_5, flag_smart_6, flag_smart_7, flag_smart_8, flag_smart_9
      FROM role_flags_default
      WHERE role = $1
    `, [role]) as UserFlags | null;
    
    return result || null;
  } catch (error) {
    logError('Erro ao buscar flags padrão da role', error).catch(() => {});
    return null;
  }
}

/**
 * Obtém flags personalizadas de um usuário
 */
export async function getUserFlags(userId: number): Promise<UserFlags | null> {
  try {
    const db = getDatabase();
    const result = await db.findFirst(`
      SELECT 
        flag_smart_0, flag_smart_1, flag_smart_2, flag_smart_3, flag_smart_4,
        flag_smart_5, flag_smart_6, flag_smart_7, flag_smart_8, flag_smart_9
      FROM user_flags
      WHERE user_id = $1
    `, [userId]) as UserFlags | null;
    
    return result || null;
  } catch (error) {
    logError('Erro ao buscar flags do usuário', error).catch(() => {});
    return null;
  }
}

/**
 * Atualiza flags de um usuário
 */
export async function updateUserFlags(
  userId: number, 
  flags: Partial<UserFlags>,
  updatedBy: number
): Promise<void> {
  const updates: string[] = [];
  const values: any[] = [];
  let paramIndex = 1;
  
  // Construir query dinâmica
  Object.keys(flags).forEach((key) => {
    if (key.startsWith('flag_smart_')) {
      updates.push(`${key} = $${paramIndex}`);
      values.push(flags[key as keyof UserFlags]);
      paramIndex++;
    }
  });
  
  if (updates.length === 0) {
    return;
  }
  
  updates.push(`updated_at = CURRENT_TIMESTAMP`);
  updates.push(`updated_by = $${paramIndex}`);
  values.push(updatedBy);
  paramIndex++;
  
  try {
    const db = getDatabase();
    // Verificar se registro existe
    const exists = await db.findFirst(`
      SELECT user_id FROM user_flags WHERE user_id = $1
    `, [userId]);
    
    if (exists) {
      // Atualizar
      await db.executeRaw(`
        UPDATE user_flags
        SET ${updates.join(', ')}
        WHERE user_id = $${paramIndex}
      `, [...values, userId]);
    } else {
      // Inserir
      const flagKeys = Object.keys(flags).filter(k => k.startsWith('flag_smart_'));
      const flagValues = flagKeys.map(k => flags[k as keyof UserFlags]);
      
      // Construir placeholders corretamente: $1 = userId, $2 até $11 = flags, $12 = updatedBy
      const placeholders = [
        '$1', // userId
        ...flagValues.map((_, i) => `$${i + 2}`) // flags começam em $2
      ];
      const updatedByIndex = flagValues.length + 2; // índice após userId e flags
      placeholders.push(`$${updatedByIndex}`); // updatedBy
      
      // IMPORTANTE: Ordem dos valores deve corresponder à ordem dos placeholders
      // Placeholders: $1 (userId), $2-$11 (flags), $12 (updatedBy)
      // Valores: [userId, ...flagValues, updatedBy]
      await db.executeRaw(`
        INSERT INTO user_flags (user_id, ${flagKeys.join(', ')}, updated_by)
        VALUES (${placeholders.join(', ')})
      `, [userId, ...flagValues, updatedBy]);
    }
  } catch (error) {
    logError('Erro ao atualizar flags do usuário', error).catch(() => {});
    throw error;
  }
}

/**
 * Obtém todas as flags efetivas de um usuário (personalizadas + padrão da role)
 * Usa a função SQL get_user_effective_flags() quando disponível, senão usa lógica manual
 */
export async function getUserEffectiveFlags(user: UserWithFlags): Promise<UserFlags> {
  // 1. Owner system tem todas
  if (user.role === 'owner_system') {
    return {
      flag_smart_0: true, flag_smart_1: true, flag_smart_2: true,
      flag_smart_3: true, flag_smart_4: true, flag_smart_5: true,
      flag_smart_6: true, flag_smart_7: true, flag_smart_8: true,
      flag_smart_9: true
    };
  }
  
  // 2. Tentar usar função SQL (mais eficiente)
  try {
    const db = getDatabase();
    const result = await db.findFirst(`
      SELECT * FROM get_user_effective_flags($1)
    `, [user.id]) as UserFlags | null;
    
    if (result) {
      return result;
    }
  } catch (error) {
    // Se função não existir ainda, usar lógica manual (fallback)
    logDebug('Função get_user_effective_flags não disponível, usando lógica manual', { error: error instanceof Error ? error.message : String(error) }).catch(() => {});
  }
  
  // 3. Fallback: Buscar flags personalizadas
  const userFlags = user.flags || await getUserFlags(user.id);
  
  // 4. Buscar flags padrão da role
  const roleFlags = await getRoleFlagsDefault(user.role);
  
  // 5. Combinar: flags personalizadas têm prioridade
  const effective: UserFlags = {
    flag_smart_0: userFlags?.flag_smart_0 ?? roleFlags?.flag_smart_0 ?? false,
    flag_smart_1: userFlags?.flag_smart_1 ?? roleFlags?.flag_smart_1 ?? false,
    flag_smart_2: userFlags?.flag_smart_2 ?? roleFlags?.flag_smart_2 ?? false,
    flag_smart_3: userFlags?.flag_smart_3 ?? roleFlags?.flag_smart_3 ?? false,
    flag_smart_4: userFlags?.flag_smart_4 ?? roleFlags?.flag_smart_4 ?? false,
    flag_smart_5: userFlags?.flag_smart_5 ?? roleFlags?.flag_smart_5 ?? false,
    flag_smart_6: userFlags?.flag_smart_6 ?? roleFlags?.flag_smart_6 ?? false,
    flag_smart_7: userFlags?.flag_smart_7 ?? roleFlags?.flag_smart_7 ?? false,
    flag_smart_8: userFlags?.flag_smart_8 ?? roleFlags?.flag_smart_8 ?? false,
    flag_smart_9: userFlags?.flag_smart_9 ?? roleFlags?.flag_smart_9 ?? false,
  };
  
  return effective;
}
