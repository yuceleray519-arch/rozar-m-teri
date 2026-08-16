export interface User {
  id: number;
  uid: string;
  email: string;
  role: 'admin' | 'personnel';
  createdAt: string;
}

export interface Room {
  id: number;
  number: string;
  floor: number;
  capacity: number;
  status: 'Available' | 'Occupied' | 'Dirty' | 'Maintenance';
  orderIndex: number;
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface GuestRegistration {
  id: number;
  firstName: string;
  lastName: string;
  tcId: string;
  phone: string;
  roomId: number;
  numGuests: number;
  paymentType: 'Nakit' | 'Kart' | 'IBAN' | 'Misafir' | string;
  paymentAmount: number;
  paymentType2?: string | null;
  paymentAmount2?: number | null;
  checkInDate: string;
  checkOutDate: string | null;
  checkInPersonnelId: number;
  checkOutPersonnelId: number | null;
  notes: string | null;
  status: 'Active' | 'CheckedOut';
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Log {
  id: number;
  userId: number;
  action: string;
  details: string;
  createdAt: string;
}

export interface Setting {
  id: number;
  key: string;
  value: string;
}
