import { Success, Response, ServerError, ParameterNotProvided, } from '../interfaces/exceptions.model';
import { DataLayer } from '../database/datalayer';
import { DRoom, DDetail, DMember, DDebt, DPayment } from '../interfaces/database.model';
import { Room, Debt } from '../interfaces/main.model';
import { SummarizablePayment, SummarizedMember } from '../interfaces/special-types.model';
import { UploadablePayment, UploadableRoom, UploadableMembers,
  UpdatablePayment, RoomDetails, FullRoomData, CurrencyUpdate, RoundingUpdate } from '../interfaces/shared.model';
import { DebtArranger } from './debt-arranger';
import { Converter } from './converter';


export class Controller {

  dataLayer: DataLayer;

  public constructor() { }

  public createNewRoom(data: UploadableRoom): Promise<Response<RoomDetails>> {
    this.dataLayer = new DataLayer(true);
    return new Promise(async (resolve, reject) => {
      try {
        const roomKey = await this.generateRoomKey();
        let param;
        if ((param = this.check(data, 'roomName')) !== null)
          return reject(new ParameterNotProvided(param));
        const room: DRoom = {
          id: this.generateId(),
          room_key: roomKey
        };
        const details: DDetail = {
          room_id: room.id,
          name: data.roomName,
          rounding: 1,
          default_currency: 'HUF',
          last_modified: new Date()
        };
        await this.dataLayer.createNewRoom(room, details);
        resolve(new Success({
          key: roomKey,
          name: details.name as string,
          rounding: details.rounding as number,
          defaultCurrency: details.default_currency as string,
          lastModified: details.last_modified as Date
        }));
      } catch (error) { reject(error); }
      finally { this.dataLayer.close(); }
    });
  }

  public addMembersToRoom(data: UploadableMembers): Promise<Response<string>> {
    this.dataLayer = new DataLayer(true);
    let param;
    if ((param = this.check(data, 'roomKey', 'members')) !== null)
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
    this.dataLayer = new DataLayer(false);
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
    const converter = new Converter();
    if (this.check(data, 'roomKey') !== null)
      return Promise.reject(new ParameterNotProvided('roomKey'));
    return new Promise(async (resolve, reject) => {
      try {
        const { defaultCurrency } = await this.dataLayer.getDetails(data.roomKey);
        const roomData: FullRoomData = await this.dataLayer.getRoomData({room_key: data.roomKey});
        for (const payment of roomData.payments)
          payment.realValue = await converter.convert({ value: payment.value, from: payment.currency, to: defaultCurrency });
        resolve(new Success(roomData));
      }
      catch (error) { reject(new ServerError(error.message)); }
      finally { this.dataLayer.close(); }
    });
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

  public setCurrency(data: CurrencyUpdate): Promise<Response> {
    this.dataLayer = new DataLayer();
    let parameter;
    if ((parameter = this.check(data, 'mainCurrency', 'roomKey')) !== null)
      return Promise.reject(new ParameterNotProvided(parameter));
    return new Promise(async (resolve, reject) => {
      try {
        const result = await this.dataLayer.setCurrency(data.roomKey, data.mainCurrency);
        await this.refreshDebts(data.roomKey);
        resolve(result);
      } catch (error) { reject(error); }
      finally { this.dataLayer.close(); }
    });
  }

  public setRounding(data: RoundingUpdate): Promise<Response> {
    this.dataLayer = new DataLayer();
    let parameter;
    if ((parameter = this.check(data, 'rounding', 'roomKey')) !== null)
      return Promise.reject(new ParameterNotProvided(parameter));
      return new Promise(async (resolve, reject) => {
        try {
          const result = await this.dataLayer.setRounding(data.roomKey, data.rounding);
          await this.refreshDebts(data.roomKey);
          resolve(result);
        } catch (error) { reject(error); }
        finally { this.dataLayer.close(); }
      });
  }

  public refreshAllDebts(): Promise<Response> {
    return new Promise(async (resolve, reject) => {
      this.dataLayer = new DataLayer(true);
      try {
        const roomKeys = await this.dataLayer.getAllRooms();
        for (const roomKey of roomKeys.map((key: any) => key.room_key)) {
          await this.refreshDebts(roomKey);
        }
        resolve(new Success(''));
      } catch (error) { reject(new ServerError(error.message)); }
      finally { this.dataLayer.close(); }
    });
  }

  private refreshDebts(roomKey: string): Promise<Response> {
    return new Promise(async (resolve, reject) => {
      try {
        const roomData: Success<SummarizablePayment[]> = (await this.dataLayer.getSummarizedPayments({room_key: roomKey})) as Success;
        if (roomData.data.length === 0) return resolve(new Success({}));
        const { rounding, defaultCurrency } = await this.dataLayer.getDetails(roomKey);
        const summarizedPayments = await this.summarizePayments(roomData.data, defaultCurrency);
        const debtArranger = new DebtArranger(summarizedPayments, rounding);
        const debts = debtArranger.debts;
        const dDebts: DDebt[] = debts.map<DDebt>(debt => ({
          from_member: debt.from,
          to_member: debt.for,
          value: debt.value,
          arranged: debt.arranged,
          currency: debt.currency}));
        const result = await this.dataLayer.refreshDebts(roomKey, dDebts);
        resolve(result);
      }
      catch (error) {
        reject(error);
      }
    });
  }

  private summarizePayments(payments: Array<SummarizablePayment>, defaultCurrency: string): Promise<SummarizedMember[]> {
    const summarized: SummarizedMember[] = [];
    let memberId = '';
    let membersIndex = -1;
    return new Promise(async (resolve, reject) => {
      const converter = new Converter();
      for (let i = 0; i < payments.length; ++i) {
        if (memberId !== payments[i].memberId) {
          membersIndex++;
          summarized.push({
            memberId: payments[i].memberId,
            sum: await converter.convert({value: payments[i].value, from: payments[i].currency, to: defaultCurrency}),
            currency: defaultCurrency
          });
          memberId = payments[i].memberId;
        }
        else summarized[membersIndex].sum +=
          await converter.convert({value: payments[i].value, from: payments[i].currency, to: defaultCurrency});
      }
      resolve(summarized);
    });
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

  private generateRoomKey(): Promise<string> {
    let result           = '';
    const characters       = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const charactersLength = characters.length;
    for ( let i = 0; i < 6; i++ )
      result += characters.charAt(Math.floor(Math.random() * charactersLength));
    return new Promise((resolve, reject) => {
      this.dataLayer.getDetails(result)
      .catch(() => { resolve(result); })
      .then(() => resolve(this.generateId()));
    });
  }
}
