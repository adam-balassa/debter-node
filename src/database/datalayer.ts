import { Database } from './database';
import { DRoom, DDetail, DMember, DPayment, DDebt } from '../interfaces/database.model';
import { Room, Member, Payment, Debt } from '../interfaces/main.model';
import { DatabaseError, Success, Response, DataError } from '../interfaces/exceptions.model';
import { Query } from 'mysql';
export class DataLayer {
  database: Database;

  public constructor(transaction: boolean = false) {
    this.database = new Database();
    if (transaction) this.database.beginTransaction();
  }

  public close() {
    this.database.close();
  }

  public createNewRoom(room: DRoom, details: DDetail): Promise<Response> {
    return new Promise(async (resolve, reject) => {
      try {
        const roomResult = await this.database.runQuery(
          'INSERT INTO Rooms SET room_key = ?, id = ?',
          room.room_key, room.id
        );
        if (roomResult.affectedRows < 1) throw null;
        const detailResult = await this.database.runQuery(
          'INSERT INTO Details SET room_id = ?, name = ?, rounding = ?, default_currency = ?, last_modified = ?',
          details.room_id, details.name, `${details.rounding}`, details.default_currency,
          this.parseDate(details.last_modified as Date)
        );
        if (detailResult.affectedRows < 1) throw null;
        resolve(new Success('New Room created'));
      }
      catch (error) {
        console.log(error);
        reject(new DatabaseError(error.message || 'An error occured'));
      }
    });
  }

  public addMembersToRoom(members: DMember[], roomKey: string): Promise<Response> {
    return new Promise(async (resolve, reject) => {
      try {
        const result: { id: string }[] = await this.database.runQuery(
          'SELECT id FROM Rooms WHERE room_key = ?', roomKey
        );
        if (result.length !== 1) throw { message: 'Cannot get roomId' };
        const roomId = result[0].id;
        if (!roomId) throw { message: 'Invalid roomId' };

        this.database.beginTransaction();
        const promises: Promise<any>[] = [];
        for (const member of members)
          promises.push(this.database.runQuery(
            'INSERT INTO Members SET id = ?, room_id = ?, user_id = NULL, alias = ?', // could do better
            member.id, roomId, member.alias
          ));
        Promise.all(promises)
          .then(() => resolve(new Success('Members successfully added')))
          .catch(error => { throw error; });
      }
      catch (error) {
        if (error instanceof Error)
          reject(error);
        else
          reject(new DataError(error.message || 'An error occured'));
      }
    });
  }

  public getDetails(roomKey: string): Promise<Room> {
    return new Promise(async (resolve, reject) => {
      try {
        const result = await this.database.runQuery(
          `SELECT name, rounding, default_currency, last_modified
          FROM Details
          INNER JOIN Rooms ON Rooms.id = room_id
          WHERE room_key=?`,
          roomKey
        );
        if (result.length === 1)
          resolve({
            id: '',
            key: roomKey,
            rounding: result[0].rounding,
            defaultCurrency: result[0].default_currency,
            name: result[0].name,
            lastModified: result[0].lastModified
          });
        else throw { message: 'Cannot load details' };
      }
      catch (error) {
        console.log(error);
        reject(new DatabaseError(error.message || 'An error occured'));
      }
    });
  }

  public getRoomData(room: DRoom): Promise<Response> {
    return new Promise(async (resolve, reject) => {
      try {
        const dMembers: DMember[] = await this.getMembers(room);
        if (dMembers.length < 1) throw { message: 'Cannot load members' };
        const dPayments: DPayment[] = await this.getPayments(dMembers);
        const dDebts: DDebt[] = await this.getDebts(dMembers.map<string>((member): string => member.id as string));

        const members: Member[] = dMembers.map<Member>((member: DMember): Member => {
          return { id: member.id as string, name: member.alias };
        });
        const payments: Payment[] = dPayments.map<Payment>((payment: DPayment): Payment => {
          return { id: payment.id as string, value: payment.value, currency: payment.currency,
            realValue: payment.value, memberId: payment.member_id as string, fromId: payment.related_to as string,
            note: payment.note, date: payment.date as Date, active: payment.active as boolean };
        });
        const debts: Debt[] = dDebts.map<Debt>((debt: DDebt): Debt => {
          return { value: debt.value, currency: debt.currency, for: debt.to_member, from: debt.from_member };
        });
        resolve(new Success({members, payments, debts}));
      }
      catch (error) {
        console.log(error);
        reject(new DatabaseError(error.message || 'An error occured'));
      }
    });
  }

  public deletePayment(paymentId: string): Promise<Response> {
    return new Promise(async (resolve, reject) => {
      try {
        const result = await this.database.runQuery(
          'UPDATE Payments SET active = 0 WHERE id = ? OR related = ?',
          paymentId, paymentId
        );
        if (result.affectedRows < 1) throw null;
        resolve(new Success('Payment successfully deleted'));
      }
      catch (error) {
        console.log(error);
        reject(new DatabaseError(error.message || 'An error occured'));
      }
    });
  }

  public uploadPayments(payments: DPayment[]): Promise<Response> {
    return new Promise(async (resolve, reject) => {
      try {
        const paymentsString: string[] = [];
        payments.forEach(p => { paymentsString.push(
            ...[p.id as string, `${p.value}`, p.currency, p.note, p.related_to, this.parseDate(p.date), p.active ? '1' : '0', p.member_id]
            ); });
        const res = await this.database.runQuery(
          `INSERT INTO Payments (id, value, currency, note, related_to, date, active, member_id)
          VALUES ${ new Array(payments.length).fill('(?,?,?,?,?,?,?,?)').join(',') }`,
          ...paymentsString
        );
        if (res.affectedRows !== payments.length) throw null;
        resolve(new Success(`${payments.length} payment(s) successfully uploaded`));
      }
      catch (error) { reject(new DatabaseError(error.message || 'An error occured')); }
    });
  }

  public getSummarizedPayments(room: DRoom): Promise<Response> {
    return new Promise(async (resolve, reject) => {
      try {
        const result = await this.database.runQuery(
          `SELECT
            Members.id AS memberId,
            ifnull(p.value, 0) as value,
            ifnull(currency, default_currency) as currency,
            default_currency as defaultCurrency
          FROM Members
          LEFT JOIN (SELECT value, currency, member_id FROM Payments WHERE active = 1) p
          ON p.member_id = Members.id
          INNER JOIN Rooms ON Rooms.id = Members.room_id
          INNER JOIN Details ON Rooms.id = Details.room_id
          WHERE Rooms.room_key = ?
          ORDER BY id`,
            room.room_key
        );
        if (result.affectedRows < 1) throw null;
        resolve(new Success(result as Array<{memberId: string, value: number, currency: string, defaultCurrency: string}>));
      }
      catch (error) {
        console.log(error);
        reject(new DatabaseError(error.message || 'An error occured'));
      }
    });
  }

  public refreshDebts(roomKey: string, debts: DDebt[]): Promise<Response> {
    return new Promise(async (resolve, reject) => {
      try {
        const deleteResult = await this.database.runQuery(
          `DELETE FROM Debts WHERE from_member IN (
            SELECT member_id FROM Members
            INNER JOIN Rooms ON room_id = Rooms.id
            WHERE Room.room_key = ?
          )`,
          roomKey
        );
        const debtsString: string[] = [];
        debts.forEach(e => {
          debtsString.push(...[ e.id as string, e.from_member, e.to_member, `${e.value}`, e.currency ]);
        });
        const insertResult = await this.database.runQuery(
          `INSERT INTO Debts (from_member, to_member, value, currency)
          VALUES ${ new Array(debts.length).fill('(?,?,?,?)').join(',') }`,
          ...debtsString
        );
        if (insertResult.affectedRows < 1) throw null;
        resolve(new Success('Debts successfully refreshed'));
      }
      catch (error) {
        console.log(error);
        reject(new DatabaseError(error.message || 'An error occured'));
      }
    });
  }

    public getMembers(room: DRoom): Promise<DMember[]> {
    return this.database.runQuery(
      `SELECT Members.id as id, Rooms.id as room_id, alias
      FROM Members
      INNER JOIN Rooms ON room_id = Rooms.id
      WHERE room_key = ?
      ORDER BY id DESC`,
      room.room_key
    );
  }

  public getPayments(members: DMember[]): Promise<DPayment[]> {
    return new Promise((resolve, reject) => {
      this.database.runQuery(
        `SELECT id, value, currency, date, note, related, active, member_id
        FROM Payments WHERE member_id IN (${new Array(members.length).fill('?').join(',')})
        ORDER BY member_id DESC`,
        ...members.map<string>(member => member.id as string)
      ).then(results => {
        resolve(results.map((result: any): DPayment => ({...result, date: new Date(result.date)})));
      })
      .catch(error => reject(error));
    });
  }

  public getDebts(memberIds: string[]): Promise<DDebt[]> {
    return this.database.runQuery(
      `SELECT id, value, currency, from_member, to_member
      FROM Debts WHERE from_member IN (${new Array(memberIds.length).fill('?').join(',')})`,
      ...memberIds
    );
  }

  private getRoomId(roomKey: string): Promise<string> {
    return new Promise(async (resolve, reject) => {
      const result = await this.database.runQuery(
        'SELECT id FROM Rooms WHERE room_key = ?',
        roomKey
      );
      if (result.length === 1) resolve(result[0].id);
      else throw { message: 'Invalid roomId' };
    });
  }

  private parseDate(date: Date): string {
    return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()} ` +
      `${('0' + date.getHours()).slice(-2)}:${('0' + date.getMinutes()).slice(-2)}:${('0' + date.getSeconds()).slice(-2)}`;
  }
}
