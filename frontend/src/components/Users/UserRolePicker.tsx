import React from 'react';
import { TextField } from '@mui/material';
import { getUserRoleOptionGroups, getRoleLabel, normalizeAppRole } from '../../utils/userRoleUserType';
import { selectLabelShrinkProps } from '../../utils/muiSelectLabel';

interface Props {
  value: string;
  onChange: (role: string) => void;
  organizationLabel?: string;
  includeAll?: boolean;
  margin?: 'none' | 'dense' | 'normal';
  actorRole?: string;
  directTotem?: boolean;
}

/**
 * Seletor de função — select nativo (confiável dentro de Dialog MUI).
 */
const UserRolePicker: React.FC<Props> = ({
  value,
  onChange,
  organizationLabel = 'organização',
  includeAll = false,
  margin = 'normal',
  actorRole,
  directTotem = false,
}) => {
  const normalized = normalizeAppRole(value);
  const roleGroups = getUserRoleOptionGroups(organizationLabel, { actorRole, directTotem });

  return (
    <TextField
      select
      fullWidth
      margin={margin}
      label="Função"
      value={normalized}
      onChange={(e) => onChange(String(e.target.value))}
      InputLabelProps={selectLabelShrinkProps}
      SelectProps={{ native: true }}
      helperText="A função define o tipo de acesso. Usuários de sistema não vinculam organização nem anunciante."
    >
      {includeAll && <option value="all">Todas as funções</option>}
      {roleGroups.map((group) => (
        <optgroup key={group.title} label={group.title}>
          {group.roles.map((role) => (
            <option key={role.value} value={role.value}>
              {role.label}
            </option>
          ))}
        </optgroup>
      ))}
    </TextField>
  );
};

/** Variante MUI (filtros fora de modal) — mantém optgroups via MenuItem agrupado. */
export const UserRoleFilterSelect: React.FC<Props> = ({
  value,
  onChange,
  organizationLabel = 'organização',
  includeAll = false,
}) => (
  <TextField
    select
    fullWidth
    label="Função"
    value={value === 'all' ? 'all' : normalizeAppRole(value)}
    onChange={(e) => onChange(String(e.target.value))}
    InputLabelProps={selectLabelShrinkProps}
    SelectProps={{ native: true }}
  >
    {includeAll && <option value="all">Todas as funções</option>}
    {getUserRoleOptionGroups(organizationLabel).map((group) => (
      <optgroup key={group.title} label={group.title}>
        {group.roles.map((role) => (
          <option key={role.value} value={role.value}>
            {role.label}
          </option>
        ))}
      </optgroup>
    ))}
  </TextField>
);

export function rolePickerDisplayLabel(role: string, organizationLabel?: string): string {
  if (role === 'all') return 'Todas as funções';
  return getRoleLabel(normalizeAppRole(role), organizationLabel);
}

export default UserRolePicker;
