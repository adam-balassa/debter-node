export interface Arrangement {
  memberId: string;
  value: number;
}

export interface DebtMember {
  memberId: string;
  debt: number;
}
// tslint:disable-next-line: no-empty-interface
export interface PositiveMember extends DebtMember { }

// tslint:disable-next-line: no-empty-interface
export interface NegativeMember extends DebtMember { }

export interface SummarizablePayment {
  memberId: string;
  value: number;
  currency: string;
  defaultCurrency: string;
}

export interface SummarizedMember {
  memberId: string;
  sum: number;
  currency: string;
}
