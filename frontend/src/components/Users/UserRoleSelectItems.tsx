import React from 'react';
import { MenuItem } from '@mui/material';
import { getUserRoleOptionGroups, roleGroupHeaderSx } from '../../utils/userRoleUserType';

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
        <MenuItem disabled value={`__header_${group.title}`} sx={roleGroupHeaderSx()}>
          {group.title}
        </MenuItem>
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
