import React from 'react';
import { ListSubheader, MenuItem } from '@mui/material';
import { getUserRoleOptionGroups } from '../../utils/userRoleUserType';

interface Props {
  organizationLabel?: string;
  includeAll?: boolean;
}

const UserRoleSelectItems: React.FC<Props> = ({
  organizationLabel = 'organização',
  includeAll = false,
}) => (
  <>
    {includeAll && <MenuItem value="all">Todas as funções</MenuItem>}
    {getUserRoleOptionGroups(organizationLabel).map((group) => (
      <React.Fragment key={group.title}>
        <ListSubheader sx={{ fontWeight: 600, lineHeight: '32px', bgcolor: 'background.paper' }}>
          {group.title}
        </ListSubheader>
        {group.roles.map((role) => (
          <MenuItem key={role.value} value={role.value} sx={{ pl: 3 }}>
            {role.label}
          </MenuItem>
        ))}
      </React.Fragment>
    ))}
  </>
);

export default UserRoleSelectItems;
