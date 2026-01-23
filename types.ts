
export interface ScheduleMeta {
  cycleMonths: number;
  firstDate: string | null;
  contractStart: string | null;
  contractEnd: string | null;
  schedule: string[];
}

export interface Agreement {
  read: boolean;
  schedule: boolean;
  recalc: boolean;
  fault: boolean;
}

export type ContractStatus = 'active' | 'ended';

export interface Contract {
  id: string;
  parentId: string | null;
  version: number;
  status: ContractStatus;
  
  shopName: string;
  ownerName: string;
  contactNumber: string;
  address: string;
  region: string; // Added field for region (Busan, Ulsan, etc.)
  model: string;
  capacity: string;
  quantity: number;
  
  cycleMonths: number;
  firstDate: string;
  contractStart: string;
  contractEnd: string;
  
  price: number | null;
  vat: string;
  
  managerEmail: string;
  
  scheduleMeta: ScheduleMeta | null;
  signatureDataUrl: string | null;
  agree: Agreement;
  
  signedDate: string;
  createdAt: string;
  updatedAt: string;
}

export type ContractFormState = Omit<Contract, 'id' | 'version' | 'status' | 'createdAt' | 'updatedAt'> & {
  id: string | null;
  status: ContractStatus;
};
