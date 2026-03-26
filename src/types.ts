export enum ReceiptType {
  EXPENSE = 'EXPENSE',
  INCOME = 'INCOME'
}

export enum Category {
  FOOD = 'Alimentación',
  TRANSPORT = 'Transporte',
  HEALTH = 'Salud',
  EDUCATION = 'Educación',
  CLOTHING = 'Vestimenta',
  HOUSING = 'Vivienda',
  ENTERTAINMENT = 'Entretenimiento',
  SERVICES = 'Servicios',
  OTHER = 'Otros'
}

export enum ReceiptStatus {
  PENDING = 'PENDING',
  VERIFIED = 'VERIFIED',
  REJECTED = 'REJECTED'
}

export enum ReceiptOrigin {
  MANUAL = 'MANUAL',
  CAMERA = 'CAMERA',
  EXCEL = 'EXCEL'
}

export enum DocumentType {
  INVOICE = 'Factura',
  SELF_INVOICE = 'Autofactura',
  CREDIT_NOTE = 'Nota de Crédito',
  TICKET = 'Ticket',
  OTHER = 'Otro'
}

export interface Receipt {
  id: string;
  userId: string;
  date: string;
  providerName: string;
  ruc: string;
  timbrado: string;
  receiptNumber: string;
  documentType?: DocumentType;
  total: number;
  iva10: number;
  iva5: number;
  currency: string;
  type: ReceiptType;
  category: Category;
  irpInciso: string; // IRP Inciso (e.g., "Inciso F")
  origin: ReceiptOrigin;
  status: ReceiptStatus;
  confidence: number; // 0-1 confidence score from OCR
  createdAt: number;
  imageUrl?: string;
  warnings?: string[];
  isDeductible?: boolean;
}

export interface UserProfile {
  id: string;
  name: string;
  firstName?: string;
  lastName?: string;
  email: string;
  avatarUrl?: string;
  settings: {
    currency: string;
    theme: 'light' | 'dark';
  };
}

export interface DashboardStats {
  totalIncome: number;
  totalExpense: number;
  balance: number;
  topCategories: { category: string; amount: number }[];
  monthlySpending: { month: string; amount: number }[];
}
