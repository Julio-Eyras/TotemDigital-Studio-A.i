/**
 * Tipos de Roles - Smart Signage Pro v3.1
 */

export interface Role {
  roleId: number;
  name: string;
  description?: string;
  isActive: boolean;
  assignedAt?: string | Date;
  grantedBy?: number;
}

export interface UserRole extends Role {
  userId: number;
}

