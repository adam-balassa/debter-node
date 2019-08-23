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
  name: string;
}

export interface Payment extends Identified {
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
