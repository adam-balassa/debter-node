export interface DRoom {
    id?: string;
    room_key: string;
}

export interface DDetail {
    id?: number;
    room_id?: string;
    name?: string;
    rounding?: number;
    default_currency?: string;
    last_modified?: Date;
}

export interface DMember {
    id?: string;
    room_id?: string;
    name: string;
}

export interface DPayment {
    id?: string;
    value: number;
    currency: number;
    note: string;
    related_to?: string;
    date?: Date;
    active?: boolean;
    member_id?: string;
}
