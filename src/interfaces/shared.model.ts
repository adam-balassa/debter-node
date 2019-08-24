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
  roomKey: string;
}

export interface UploadableMembers {
  roomKey: string;
  members: string[];
}

export interface UpdatablePayment {
  paymentId: string;
  roomKey: string;
}
