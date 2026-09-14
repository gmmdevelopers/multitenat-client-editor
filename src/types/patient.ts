export interface Patient {
  id: string;
  tenantId: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Professional {
  id: string;
  tenantId: string;
  firstName: string;
  lastName: string;
  licenseNumber: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Box {
  id: string;
  tenantId: string;
  name: string;
  code: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}
