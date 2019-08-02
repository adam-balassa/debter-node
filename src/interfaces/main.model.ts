export interface Identified {
    id: string | number;
}

export interface Member extends Identified {
    name: string;
    sum: number;
    payed: Payment[];
    debts: Debt[];
}

export interface Payment extends Identified {
    value: number;
    currency: string;
    realValue: number;
    note: string;
    from: Payment;
    date: Date;
    active: boolean;
    payed: Member;
}

export interface Debt {
    value: number;
    currency: string;
    for: Member;
}
