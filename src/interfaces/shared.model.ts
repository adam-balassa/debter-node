export interface UploadablePayment {
  roomKey: string;
  value: number;
  currency: string;
  note: string;
  memberId: string;
  included: string[];
}

export interface UploadableRoom {
  roomName: string;
}

export interface UploadableMembers {
  roomKey: string;
  members: string[];
}

export interface UpdatablePayment {
  paymentId: string;
  roomKey: string;
}

export interface RoomDetails {
  key: string;
  name: string;
  rounding: number;
  defaultCurrency: string;
  lastModified: Date;
}

export interface CurrencyUpdate {
  roomKey: string;
  mainCurrency: string;
}

export interface RoundingUpdate {
  roomKey: string;
  rounding: number;
}

export interface FullRoomData {
  payments: {
    id: string;
    value: number;
    currency: string;
    realValue: number;
    note: string;
    fromId: string;
    date: Date;
    active: boolean;
    memberId: string;
    excluded: string[];
    included: string[];
  }[];
  members: {
    id: string;
    name: string;
  }[];
  debts: {
    value: number;
    currency: string;
    for: string;
    from: string;
    arranged: boolean;
  }[];
}

export interface UploadableMember {
  roomKey: string;
  name: string;
  payments: string[];
}

export interface DeletableMember {
  roomKey: string;
  memberId: string;
}
