import { Debt } from '../interfaces/main.model';
import { SummarizedMember, PositiveMember, NegativeMember } from '../interfaces/special-types.model';

export class DebtArranger {
  public debts: Debt[] = [];
  rounding: number;
  currency: string;
  positiveMembers: PositiveMember[] = [];
  negativeMembers: NegativeMember[] = [];

  constructor(members: SummarizedMember[], rounding: number) {
    this.currency = members[0].currency;
    this.rounding = rounding / 2;

    const sum: number = members.reduce<number>((acc, member) => (acc + member.sum), 0);
    const forOne = sum / members.length;

    members.forEach(member => {
      const debt = member.sum - forOne;
      if (debt > rounding) this.positiveMembers.push({ memberId: member.memberId, debt });
      else if (debt < -rounding) this.negativeMembers.push({ memberId: member.memberId, debt: -debt});
    });

    this.arrangeDebts();
  }

  private arrangeDebts() {
      this.positiveMembers.sort((a, b) => (b.debt - a.debt));
      this.negativeMembers.sort((a, b) => (b.debt - a.debt));

      while (this.positiveMembers.length > 0 && this.negativeMembers.length > 0) {
        while (this.checkForPerfectFit()); // O(m^3)
        if (this.positiveMembers.length === 0 || this.negativeMembers.length === 0) return;
        if (!this.checkForNegativeMemberArrangement()) // O(m)
          this.arrangeDebtAndResort(this.positiveMembers[0], this.negativeMembers[0], this.positiveMembers[0].debt);
      }
  }

  private checkForPerfectFit(): boolean { // O(n * m) // TODO: enperfect algorythm
    for (const negativeMember of this.negativeMembers)
      for (const positiveMember of this.positiveMembers)
        if (this.checkIfFits(positiveMember, negativeMember)) {
          this.arrangeDebtAndResort(positiveMember, negativeMember, positiveMember.debt);
          return true;
        }
    return false;
  }

  private checkForNegativeMemberArrangement(): boolean {
    for (const member of this.negativeMembers)
      if (member.debt < this.positiveMembers[0].debt) {
        this.arrangeDebtAndResort(this.positiveMembers[0], member, member.debt);
        return true;
      }
    return false;
  }

  private checkIfFits(p: PositiveMember, n: NegativeMember): boolean {
    return Math.abs(p.debt - n.debt) <= this.rounding;
  }

  private arrangeDebtAndResort(positiveMember: PositiveMember, negativeMember: NegativeMember, value: number) {
    value = Math.floor((value + this.rounding) / (2 * this.rounding)) * this.rounding * 2.0;
    this.debts.push({from: negativeMember.memberId, for: positiveMember.memberId, value, currency: this.currency, arranged: false});

    negativeMember.debt -= value;
    positiveMember.debt -= value;

    this.negativeMembers.splice(this.negativeMembers.findIndex(m => negativeMember === m), 1);
    if (negativeMember.debt > this.rounding) {
      const newIndex = this.negativeMembers.findIndex(m => m.debt < negativeMember.debt);
      if (newIndex === -1) this.negativeMembers.push(negativeMember);
      else this.negativeMembers.splice(newIndex, 0, negativeMember);
    }

    this.positiveMembers.splice(this.positiveMembers.findIndex(m => positiveMember === m), 1);
    if (positiveMember.debt > this.rounding) {
      const newIndex = this.positiveMembers.findIndex(m => m.debt < positiveMember.debt);
      if (newIndex === -1) this.positiveMembers.push(positiveMember);
      else this.positiveMembers.splice(newIndex, 0, positiveMember);
    }
  }
}
