export interface Identified {
  id: string | number;
}

export interface Room extends Identified {
  key: string;
  name: string;
  rounding: number;
  defaultCurrency: string;
  lastModified?: Date;
}

export interface Member extends Identified {
  id: string;
  name: string;
  userId?: string;
}

export interface Payment extends Identified {
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
}

export interface Debt {
  value: number;
  currency: string;
  for: string;
  from: string;
  arranged: boolean;
}

export interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  password?: string;
}
