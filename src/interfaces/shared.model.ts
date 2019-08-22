export interface UploadablePayment {
  value: number;
  currency: string;
  note: string;
  memberId: string;
  included: string[];
}
