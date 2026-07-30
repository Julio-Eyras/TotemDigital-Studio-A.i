import type { UserFlags } from '../services/api';

export type UserFlagName = keyof UserFlags;

type UserFlagLabel = {
  title: string;
  description: string;
};

/** Rótulos alinhados aos COMMENT ON COLUMN de user_flags no schema. */
export const USER_FLAG_LABELS: Record<UserFlagName, UserFlagLabel> = {
  flag_smart_0: {
    title: 'Acesso técnico',
    description: 'Totens, Smart TVs e players',
  },
  flag_smart_1: {
    title: 'Atualizações OTA',
    description: 'Gerenciar atualizações remotas dos dispositivos',
  },
  flag_smart_2: {
    title: 'Ferramentas admin',
    description: 'Admin Tools, logs e monitorização do dispatcher',
  },
  flag_smart_3: {
    title: 'Ver faturamento',
    description: 'Visualizar dados de faturamento',
  },
  flag_smart_4: {
    title: 'Gerir faturamento',
    description: 'Criar e alterar cobranças e faturamento',
  },
  flag_smart_5: {
    title: 'Contratos',
    description: 'Gerenciar contratos de organizações e anunciantes',
  },
  flag_smart_6: {
    title: 'Dados comerciais',
    description: 'Visualizar informações comerciais',
  },
  flag_smart_7: {
    title: 'Relatórios comerciais',
    description: 'Acessar relatórios comerciais',
  },
  flag_smart_8: {
    title: 'Organização completa',
    description: 'Acesso completo de usuário da organização (publisher)',
  },
  flag_smart_9: {
    title: 'Anunciante completo',
    description: 'Acesso completo de usuário anunciante (subscriber)',
  },
};

export function getUserFlagLabel(flagName: string): UserFlagLabel {
  if (flagName in USER_FLAG_LABELS) {
    return USER_FLAG_LABELS[flagName as UserFlagName];
  }
  return {
    title: flagName.replace('flag_smart_', 'Flag '),
    description: 'Permissão adicional',
  };
}
