import { Success, Response, ServerError, ParameterNotProvided, Error, DataError } from '../interfaces/exceptions.model';
import { DataLayer } from '../database/datalayer';
import { DRoom, DDetail, DMember, DDebt, DPayment } from '../interfaces/database.model';
import { Room, Member, Payment, Debt } from '../interfaces/main.model';
import { Arrangement, PositiveMember, NegativeMember, SummarizablePayment, SummarizedMember } from '../interfaces/special-types.model';
import { UploadablePayment, UploadableRoom, UploadableMembers, UpdatablePayment, RoomDetails, FullRoomData } from '../interfaces/shared.model';


export class Controller {

  dataLayer: DataLayer;

  public constructor() { }

  public createNewRoom(data: UploadableRoom): Promise<Response<string>> {
    this.dataLayer = new DataLayer(true);
    let param;
    if ((param = this.check(data, 'roomKey', 'roomName')) !== null)
      return Promise.reject(new ParameterNotProvided(param));
    if (data.roomKey.length !== 6)
      return Promise.reject(new ServerError('roomKey must be 6 letters long'));
    const room: DRoom = {
      id: this.generateId(),
      room_key: data.roomKey
    };
    const details: DDetail = {
      room_id: room.id,
      name: data.roomName,
      rounding: 1,
      default_currency: 'HUF',
      last_modified: new Date()
    };
    return this.dataLayer.createNewRoom(room, details).finally(() => { this.dataLayer.close(); });
  }

  public addMembersToRoom(data: UploadableMembers): Promise<Response<string>> {
    this.dataLayer = new DataLayer(true);
    let param;
    if ((param = this.check(data, 'roomKey', 'memberNames')) !== null)
      return Promise.reject(new ParameterNotProvided(param));
    if (data.members.length < 2)
      return Promise.reject(new ServerError('Must provide at least 2 members'));

    const members: DMember[] = [];
    for (const name of data.members)
      members.push({ id: this.generateId(), alias: name });
    return this.dataLayer.addMembersToRoom(members, data.roomKey).finally(
      () => { this.dataLayer.close(); }
    );
  }

  public loginRoom(data: { roomKey: string }): Promise<Response<RoomDetails>> {
    this.dataLayer = new DataLayer();
    if (this.check(data, 'roomKey') !== null)
      return Promise.reject(new ParameterNotProvided('roomKey'));
    return new Promise(async (resolve, reject) => {
      try {
        const room: Room = await this.dataLayer.getDetails(data.roomKey);
        const { id, ...details } = room;
        await this.dataLayer.refreshModified({room_id: id as string, last_modified: new Date()});
        resolve(new Success<RoomDetails>(details as RoomDetails));
      }
      catch (error) {
        reject(error);
      }
      finally {
        this.dataLayer.close();
      }
    });
  }

  public deleteUnusedRooms(): Promise<Response<string>> {
    return new Promise(async (resolve, reject) => {
      this.dataLayer = new DataLayer();
      try {
        const veryOldRoomBefore: number = 365 * 24 * 60 * 60 * 1000;
        const oldRoomBefore: number = veryOldRoomBefore / 2;
        const ids: string[] = (await this.dataLayer.getOldRooms(
          new Date(Date.now() - veryOldRoomBefore), new Date(Date.now() - oldRoomBefore))).map(e => e.id);
        if (ids.length > 0)
          await this.dataLayer.deleteRooms(ids);
        resolve(new Success('Rooms successfully deleted'));
      } catch (error) {
        console.log(error);
        reject(error);
      }
      finally { this.dataLayer.close(); }
    });
  }

  public loadEntireRoomData(data: {roomKey: string}): Promise<Response<FullRoomData>> {
    this.dataLayer = new DataLayer();
    if (this.check(data, 'roomKey') !== null)
      return Promise.reject(new ParameterNotProvided('roomKey'));
    return Promise.resolve(this.dataLayer.getRoomData({room_key: data.roomKey}).finally(
      () => { this.dataLayer.close(); }
    ));
  }

  public uploadPayment(data: UploadablePayment): Promise<Response<string>> {
    this.dataLayer = new DataLayer(true);
    let missing = null;
    if ((missing = this.check(data, 'value', 'currency', 'note', 'memberId', 'included', 'roomKey')) !== null)
      return Promise.reject(new ParameterNotProvided(missing));
    if (data.included.length === 0)
      return Promise.reject(new ServerError('At least one member must be included'));

    return new Promise(async (resolve, reject) => {
      try {
        const members = await this.dataLayer.getMembers({room_key: data.roomKey});
        const debts: DDebt[] = await this.dataLayer.getDebts(members.map<string>(member => member.id as string));
        const { rounding } = await this.dataLayer.getDetails(data.roomKey);

        const excludedPaymentValue = data.value / data.included.length;
        const excludedMembers = members.filter(member => !data.included.includes(member.id as string));
        const newPaymentId: string = this.generateId();
        const payments: DPayment[] = [{
          id: newPaymentId,
          value: data.value,
          currency: data.currency,
          note: data.note,
          related_to: null,
          date: new Date(),
          active: true,
          member_id: data.memberId
        }];
        if (data.included.length === 1)
          payments.push({
            id: this.generateId(),
            value: -data.value,
            currency: data.currency,
            note: data.note,
            related_to: newPaymentId,
            date: new Date(),
            active: true,
            member_id: data.included[0]
          });
        else
          payments.push(...excludedMembers.map<DPayment>((member: DMember): DPayment => ({
            id: this.generateId(),
            value: excludedPaymentValue,
            currency: data.currency,
            note: data.note,
            related_to: newPaymentId,
            date: new Date(),
            active: true,
            member_id: member.id as string
          })));

        await this.dataLayer.uploadPayments(payments);

        let index;
        if ((index = debts.findIndex(debt =>
          debt.from_member === data.memberId &&
          debt.to_member === data.included[0] &&
          data.included.length === 1 &&
          debt.currency === data.currency &&
          !debt.arranged
        )) !== -1) {
          if (Math.abs(debts[index].value - data.value) < rounding) {
            debts[index].arranged = true;
            await this.dataLayer.refreshDebts(data.roomKey, debts);
          }
          else if (debts[index].value > data.value) {
            debts[index].value -= data.value;
            await this.dataLayer.refreshDebts(data.roomKey, debts);
          }
        }
        else await this.refreshDebts(data.roomKey);
        resolve(new Success('Payment successfully uploaded'));
      }
      catch (error) { reject(error); }
      finally { this.dataLayer.close(); }
    });
  }

  public deletePayment(data: UpdatablePayment): Promise<Response<string>> {
    this.dataLayer = new DataLayer(true);
    let parameter;
    if ((parameter = this.check(data, 'paymentId', 'roomKey')) !== null)
      return Promise.reject(new ParameterNotProvided(parameter));
    return new Promise(async (resolve, reject) => {
      try {
        await this.dataLayer.deletePayment(data.paymentId);
        await this.refreshDebts(data.roomKey);
        resolve(new Success('Payment successfully deleted'));
      }
      catch (error) {
        reject(error);
      }
      finally {
        this.dataLayer.close();
      }
    });
  }

  public revivePayment(data: UpdatablePayment): Promise<Response<string>> {
    this.dataLayer = new DataLayer(true);
    let parameter;
    if ((parameter = this.check(data, 'paymentId', 'roomKey')) !== null)
      return Promise.reject(new ParameterNotProvided(parameter));
    return new Promise(async (resolve, reject) => {
      try {
        await this.dataLayer.revivePayment(data.paymentId);
        await this.refreshDebts(data.roomKey);
        resolve(new Success('Payment successfully revived'));
      }
      catch (error) {
        reject(error);
      }
      finally {
        this.dataLayer.close();
      }
    });
  }

  private refreshDebts(roomKey: string): Promise<Response> {
    return new Promise(async (resolve, reject) => {
      try {
        const roomData = await this.dataLayer.getSummarizedPayments({room_key: roomKey});
        const summarizedPayments = this.summarizePayments((roomData as Success).data);
        const { rounding } = await this.dataLayer.getDetails(roomKey);
        const debts = this.calculateDebts(summarizedPayments, rounding);
        const dDebts: DDebt[] = [];
        debts.forEach(d => { dDebts.push(
          { from_member: d.from, to_member: d.for, value: d.value, currency: d.currency, arranged: d.arranged });
        });
        const result = await this.dataLayer.refreshDebts(roomKey, dDebts);
        resolve(result);
      }
      catch (error) {
        reject(error);
      }
    });
  }

  private summarizePayments(payments: Array<SummarizablePayment>): SummarizedMember[] {
    const summarized: SummarizedMember[] = [];
    const defaultCurrency = payments[0].currency;
    let memberId = '';
    let membersIndex = -1;
    for (let i = 0; i < payments.length; ++i) {
      if (memberId !== payments[i].memberId) {
        membersIndex++;
        summarized.push({ memberId: payments[i].memberId, sum: this.convert(payments[i]), currency: defaultCurrency });
        memberId = payments[i].memberId;
      }
      else summarized[membersIndex].sum += this.convert(payments[i]);
    }
    return summarized;
  }

  private convert(payment: {value: number, currency: string, defaultCurrency: string}): number {
    const converter: {[currency: string]: number} = {'HUF': 1, 'EUR': 320, 'USD': 290};
    if (payment.currency === payment.defaultCurrency) return payment.value;
    if (!converter.hasOwnProperty(payment.currency) || !converter.hasOwnProperty(payment.defaultCurrency))
      throw new ServerError('Unknown curency');
    return payment.value * converter[payment.currency];
  }

  private calculateDebts(members: {memberId: string, sum: number, currency: string}[], rounding: number): Debt[] {
    const currency = members[0].currency;
    const sum: number = members.reduce<number>((acc, member) => (acc + member.sum), 0);
    const forOne = sum / members.length;
    const positiveMembers: PositiveMember[] = [];
    const negativeMembers: NegativeMember[] = [];

    members.forEach(member => {
      const debt = member.sum - forOne;
      if (debt > rounding)        positiveMembers.push({ memberId: member.memberId, debt });
      else if (debt < -rounding)  negativeMembers.push({ memberId: member.memberId, debt: -debt, arrangements: [] });
    });
    this.arrangeDebts(positiveMembers, negativeMembers, rounding);
    const debts: Debt[] = [];
    negativeMembers.forEach( member => {
      debts.push(...member.arrangements.map<Debt>((a): Debt => (
        { from: member.memberId, for: a.memberId, value: a.value, currency, arranged: false }
      )));
    });
    return debts;
  }

  private arrangeDebts(positiveMembers: PositiveMember[], negativeMembers: NegativeMember[], rounding: number) {
      const realRounding = rounding / 2;
      positiveMembers.sort((a, b) => (b.debt - a.debt));
      negativeMembers.sort((a, b) => (b.debt - a.debt));

      const checkForPerfectFit = (): boolean => { // O(n + m)
        for (let p: number = 0, n: number = 0; p < positiveMembers.length && n < negativeMembers.length;) {
          for (; n < negativeMembers.length && positiveMembers[p].debt <= negativeMembers[n].debt; ++n);
          if (n !== 0 && checkIfFits(positiveMembers[p], negativeMembers[n - 1], realRounding)) {
            this.arrangeDebtAndResort(positiveMembers, p, negativeMembers, n - 1, positiveMembers[p].debt, realRounding);
            return true;
          }
          if (n === negativeMembers.length) return false;
          for (; p < positiveMembers.length && positiveMembers[p].debt >= negativeMembers[n].debt; ++p);
          if (p !== 0 && checkIfFits(positiveMembers[p - 1], negativeMembers[n], realRounding)) {
            this.arrangeDebtAndResort(positiveMembers, p - 1, negativeMembers, n, positiveMembers[p - 1].debt, realRounding);
            return true;
          }
          if (p === positiveMembers.length) return false;
        }
        return false;
        function checkIfFits(p: PositiveMember, n: NegativeMember, interval: number): boolean {
          return Math.abs(p.debt - n.debt) <= interval;
        }
      };
      const checkForPositiveMemberArrangement = (): boolean => {
        for (let p = 0; p < positiveMembers.length; ++p) {
          if (positiveMembers[p].debt < negativeMembers[0].debt) {
            this.arrangeDebtAndResort(positiveMembers, p, negativeMembers, 0, positiveMembers[p].debt, realRounding);
            return true;
          }
        }
        return false;
      };
      while (positiveMembers.length > 0) {
        while (checkForPerfectFit() && positiveMembers.length > 0); // O(m^3)
        if (positiveMembers.length === 0) return;
        if (!checkForPositiveMemberArrangement()) // O(m)
          this.arrangeDebtAndResort(positiveMembers, 0, negativeMembers, 0, negativeMembers[0].debt, realRounding);
      }
  }

  private arrangeDebtAndResort(
    positiveMembers: PositiveMember[], p: number,
    negativeMembers: NegativeMember[], n: number,
    value: number, rounding: number) {
    value = Math.floor((value + rounding) / (2 * rounding)) * rounding * 2;
    negativeMembers[n].arrangements.push(
      { memberId: positiveMembers[p].memberId, value }
    );
    negativeMembers[n].debt -= value;
    positiveMembers[p].debt -= value;

    const nDebt = negativeMembers[n].debt;
    const negativeMember = negativeMembers.splice(n, 1)[0];
    const ni = negativeMembers.findIndex(m => m.debt < nDebt);
    if (ni === -1) negativeMembers.push(negativeMember);
    else           negativeMembers.splice(ni, 0, negativeMember);

    const pDebt = positiveMembers[p].debt;
    const positiveMember = positiveMembers.splice(p, 1)[0];
    if (pDebt > rounding) {
      const pi = positiveMembers.findIndex(m => m.debt < pDebt);
      if (pi === -1) positiveMembers.push(positiveMember);
      else           positiveMembers.splice(pi, 0, positiveMember);
    }
  }

  private check(object: { [key: string]: any }, ...keys: string[]): string | null {
    for (const key of keys)
      if (object[key] === undefined || object[key] === null) return key;
    return null;
  }

  private generateId() {
    return 'xxxxx4xxx-yxxxxxxxxx'.replace(/[xy]/g, function (c) {
      // tslint:disable-next-line: no-bitwise
      const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }
}
