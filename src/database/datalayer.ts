import { Database } from './database';
import { DRoom, DDetail, DMember, DPayment, DDebt } from '../interfaces/database.model';
import { Room, Member, Payment, Debt } from '../interfaces/main.model';
import { Success, Response, DataError } from '../interfaces/exceptions.model';
import { FullRoomData } from '../interfaces/shared.model';
import { SummarizablePayment } from '../interfaces/special-types.model';
export class DataLayer {
  private database: Database;

  public constructor(transaction: boolean = false) {
    this.database = new Database();
    if (transaction) this.database.beginTransaction();
  }

  public close() {
    this.database.close();
  }

  public createNewRoom(room: DRoom, details: DDetail): Promise<Response<string>> {
    return new Promise(async (resolve, reject) => {
      try {
        const roomResult = await this.database.runQuery(
          'INSERT INTO Rooms SET room_key = ?, id = ?',
          room.room_key, room.id
        );
        if (roomResult.affectedRows < 1) throw new DataError('New room creation failed');
        const detailResult = await this.database.runQuery(
          'INSERT INTO Details SET room_id = ?, name = ?, rounding = ?, default_currency = ?, last_modified = ?',
          details.room_id, details.name, details.rounding, details.default_currency,
          this.parseDate(details.last_modified as Date)
        );
        if (detailResult.affectedRows < 1) throw new DataError('Details insertion failed');
        resolve(new Success('New Room created'));
      }
      catch (error) {
        console.log(error);
        reject(error);
      }
    });
  }

  public refreshModified(details: DDetail): Promise<Response> {
    return this.database.runQuery(
      'UPDATE Details SET last_modified = ? WHERE room_id = ?',
      this.parseDate(details.last_modified as Date), details.room_id
    );
  }

  public addMembersToRoom(members: DMember[], roomKey: string): Promise<Response<string>> {
    return new Promise(async (resolve, reject) => {
      try {
        const result: { id: string }[] = await this.database.runQuery(
          'SELECT id FROM Rooms WHERE room_key = ?', roomKey
        );
        if (result.length !== 1) throw new DataError('Cannot get roomId');
        const roomId = result[0].id;
        if (!roomId) throw new DataError('Invalid roomId');

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
          `SELECT Rooms.id, name, rounding, default_currency, last_modified
          FROM Details
          INNER JOIN Rooms ON Rooms.id = room_id
          WHERE room_key=?`,
          roomKey
        );
        if (result.length === 1)
          resolve({
            id: result[0].id,
            key: roomKey,
            rounding: result[0].rounding,
            defaultCurrency: result[0].default_currency,
            name: result[0].name,
            lastModified: result[0].lastModified
          });
        else throw new DataError('Invalid roomKey');
      }
      catch (error) {
        console.log(error);
        reject(error);
      }
    });
  }

  public getOldRooms(lastModified: Date, lastModifiedIfArranged: Date): Promise<{id: string}[]> {
    return this.database.runQuery(
      `SELECT room_id as id FROM Details WHERE last_modified < ? OR Details.room_id NOT IN(
        SELECT Rooms.id FROM Rooms
        INNER JOIN Members ON Members.room_id = Rooms.id
        INNER JOIN Debts ON Debts.from_member = Members.id
        WHERE NOT arranged
        )
      AND last_modified < ?`,
        this.parseDate(lastModified), this.parseDate(lastModifiedIfArranged)
    );
  }

  public getAllRooms() {
    return this.database.runQuery('SELECT room_key FROM Rooms WHERE 1');
  }

  public deleteRooms(ids: string[]): Promise<any> {
    return this.database.runQuery(
      `DELETE FROM Rooms WHERE id IN (${new Array(ids.length).fill('?').join(',')})`,
      ...ids
    );
  }

  public getRoomData(room: DRoom): Promise<FullRoomData> {
    return new Promise(async (resolve, reject) => {
      try {
        const dMembers: DMember[] = await this.getMembers(room.room_key);
        if (dMembers.length < 1) throw new DataError('Cannot load members');
        const dPayments: DPayment[] = await this.getAllPayments(dMembers);
        const dDebts: DDebt[] = await this.getDebts(dMembers.map<string>((member): string => member.id as string));

        const members: Member[] = dMembers.map<Member>((member: DMember): Member => {
          return { id: member.id as string, name: member.alias };
        });
        const payments: Payment[] = dPayments.map<Payment>((payment: DPayment): Payment => {
          return { id: payment.id as string, value: payment.value, currency: payment.currency,
            realValue: payment.value, memberId: payment.member_id as string, fromId: payment.related_to as string, note: payment.note,
            date: payment.date as Date, active: payment.active as boolean, included: payment.included, excluded: payment.excluded};
        });
        const debts: Debt[] = dDebts.map<Debt>((debt: DDebt): Debt => {
          return { value: debt.value, currency: debt.currency, for: debt.to_member, from: debt.from_member, arranged: debt.arranged };
        });
        resolve({members, payments, debts});
      }
      catch (error) {
        console.log(error);
        reject(error);
      }
    });
  }

  public deletePayment(paymentId: string): Promise<Response> {
    return new Promise(async (resolve, reject) => {
      try {
        const result = await this.database.runQuery(
          'UPDATE Payments SET active = 0 WHERE id = ? OR related_to = ?',
          paymentId, paymentId
        );
        if (result.affectedRows < 1) throw new DataError('Invalid payment or room id');
        resolve(new Success('Payment successfully deleted'));
      }
      catch (error) {
        console.log(error);
        reject(error);
      }
    });
  }

  public deleteRelatedPayments(payments: string[]): Promise<Response> {
    return new Promise(async (resolve, reject) => {
      try {
        const result = await this.database.runQuery(
          `DELETE FROM Payments WHERE
            related_to IN (${new Array(payments.length).fill('?').join(',')})`,
          ...payments
        );
        if (result.affectedRows < 1) throw new DataError('Invalid payment or room id');
        resolve(new Success('Payment successfully deleted'));
      }
      catch (error) {
        console.log(error);
        reject(error);
      }
    });
  }

  public revivePayment(paymentId: string): Promise<Response> {
    return new Promise(async (resolve, reject) => {
      try {
        const result = await this.database.runQuery(
          'UPDATE Payments SET active = 1 WHERE id = ? OR related_to = ?',
          paymentId, paymentId
        );
        if (result.affectedRows < 1) throw new DataError('Invalid payment or room id');
        resolve(new Success('Payment successfully deleted'));
      }
      catch (error) {
        console.log(error);
        reject(error);
      }
    });
  }

  public uploadPayments(payments: DPayment[]): Promise<Response> {
    return new Promise(async (resolve, reject) => {
      try {
        const paymentsString: any[] = [];
        payments.forEach(p => { paymentsString.push(
            ...[p.id, p.value, p.currency, p.note, p.related_to, this.parseDate(p.date), p.active, p.member_id]
            ); });
        const res = await this.database.runQuery(
          `INSERT INTO Payments (id, value, currency, note, related_to, date, active, member_id)
          VALUES ${ new Array(payments.length).fill('(?,?,?,?,?,?,?,?)').join(',') }`,
          ...paymentsString
        );
        if (res.affectedRows !== payments.length) throw new DataError('Insertion failed');
        resolve(new Success(`${payments.length} payment(s) successfully uploaded`));
      }
      catch (error) { reject(error); }
    });
  }

  public getSummarizedPayments(room: DRoom): Promise<Response<SummarizablePayment[]>> {
    return new Promise(async (resolve, reject) => {
      try {
        const result = await this.database.runQuery(
          `SELECT
            Members.id AS memberId,
            ifnull(p.value, 0) as value,
            ifnull(currency, default_currency) as currency
          FROM Members
          LEFT JOIN (SELECT value, currency, member_id FROM Payments WHERE active = 1) p
          ON p.member_id = Members.id
          INNER JOIN Rooms ON Rooms.id = Members.room_id
          INNER JOIN Details ON Rooms.id = Details.room_id
          WHERE Rooms.room_key = ?
          ORDER BY Members.id`,
            room.room_key
        );
        if (result.affectedRows < 1) throw new DataError('Invalid room_key');
        resolve(new Success(result as SummarizablePayment[]));
      }
      catch (error) {
        console.log(error);
        reject(error);
      }
    });
  }

  public refreshDebts(roomKey: string, debts: DDebt[]): Promise<Response> {
    return new Promise(async (resolve, reject) => {
      try {
        const deleteResult = await this.database.runQuery(
          `DELETE FROM Debts WHERE from_member IN (
            SELECT Members.id FROM Members
            INNER JOIN Rooms ON room_id = Rooms.id
            WHERE Rooms.room_key = ?
          )`,
          roomKey
        );
        if (debts.length === 0) return resolve(new Success('All debts arranged'));
        const debtsString: any[] = [];
        debts.forEach(e => {
          debtsString.push(...[ e.from_member, e.to_member, e.value, e.currency, e.arranged ]);
        });
        const insertResult = await this.database.runQuery(
          `INSERT INTO Debts (from_member, to_member, value, currency, arranged)
          VALUES ${ new Array(debts.length).fill('(?,?,?,?,?)').join(',') }`,
          ...debtsString
        );
        if (insertResult.affectedRows < 1) throw new DataError('Insertion failed');
        resolve(new Success('Debts successfully refreshed'));
      }
      catch (error) {
        console.log(error);
        reject(error);
      }
    });
  }

  public getMembers(roomKey: string): Promise<DMember[]> {
    return this.database.runQuery(
      `SELECT Members.id as id, Rooms.id as room_id, alias
      FROM Members
      INNER JOIN Rooms ON room_id = Rooms.id
      WHERE room_key = ?
      ORDER BY id DESC`,
      roomKey
    );
  }

  public getAllPayments(members: DMember[]): Promise<DPayment[]> {
    return new Promise((resolve, reject) => {
      this.database.runQuery(
        `SELECT PaymentsWithExluded.id, value, note, currency, date, active, PaymentsWithExluded.member_id, excluded,
        JSON_ARRAYAGG(includedPayments.member_id) as included
        FROM (SELECT Payments.id, value, note, currency, date, active, Payments.member_id,
          JSON_ARRAYAGG(excludedPayments.member_id) as excluded
          FROM Payments
          LEFT JOIN
            (SELECT id, related_to, member_id FROM Payments WHERE value > 0) excludedPayments
          ON Payments.id = excludedPayments.related_to
          WHERE
            ISNULL(Payments.related_to)
            AND Payments.member_id IN (${new Array(members.length).fill('?').join(',')})
          GROUP BY id) PaymentsWithExluded
          LEFT JOIN
            (SELECT id, related_to, member_id FROM Payments WHERE value < 0) includedPayments
          ON PaymentsWithExluded.id = includedPayments.related_to
          GROUP BY PaymentsWithExluded.id
          ORDER BY member_id
        `,
        ...members.map<string>(member => member.id as string)
      ).then(results => {
        resolve(results.map((result: any): DPayment => ({...result, date: new Date(result.date),
          excluded: result.excluded === '[null]' ? [] : JSON.parse(result.excluded as string),
          included: result.included === '[null]' ? [] : JSON.parse(result.included as string)
        })));
      })
      .catch(error => reject(error));
    });
  }

  public getDebts(memberIds: string[]): Promise<DDebt[]> {
    return this.database.runQuery(
      `SELECT id, value, currency, from_member, to_member, arranged
      FROM Debts WHERE from_member IN (${new Array(memberIds.length).fill('?').join(',')})`,
      ...memberIds
    );
  }

  public setCurrency(roomKey: string, currency: string): Promise<Response> {
    return new Promise((resolve, reject) => {
      this.database.runQuery(
        `UPDATE Details SET default_currency = ? WHERE room_id = (SELECT id FROM Rooms WHERE room_key = ?)`,
        currency, roomKey
      ).then(result => {
        if (result.affectedRows < 1) throw new DataError('Modification failed');
        resolve(new Success(`New main currency set`));
      })
      .catch(error => reject(new DataError(error.message)));
    });
  }

  public setRounding(roomKey: string, rounding: number): Promise<Response> {
    return new Promise((resolve, reject) => {
      this.database.runQuery(
        `UPDATE Details SET rounding = ? WHERE room_id = (SELECT id FROM Rooms WHERE room_key = ?)`,
        rounding, roomKey
      ).then(result => {
        if (result.affectedRows < 1) throw new DataError('Modification failed');
        resolve(new Success(`New rounding set`));
      })
      .catch(error => reject(new DataError(error.message)));
    });
  }

  public deleteMember(memberId: string): Promise<any> {
    return this.database.runQuery('DELETE FROM Members WHERE id = ?', memberId);
  }

  private parseDate(date: Date): string {
    return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()} ` +
      `${('0' + date.getHours()).slice(-2)}:${('0' + date.getMinutes()).slice(-2)}:${('0' + date.getSeconds()).slice(-2)}`;
  }

  // ################## QUIZLET QUERIES ########################
  public getQuizletUsers(): Promise<{name: string, id: string}[]> {
    return this.database.runQuery('SELECT * FROM QuizletUsers');
  }

  public getQuizletSets(userId: string) {
    return this.database.runQuery(`
    SELECT id, name, JSON_ARRAYAGG(cards.cards) AS cards
    FROM QuizletSets LEFT JOIN (
      SELECT setId, JSON_OBJECT('first', \`first\`, 'second', second, 'third', third, 'index', \`index\`) AS cards
      FROM QuizletCards
    ) cards ON setId = id
    WHERE userId = ?
    GROUP BY id
    `, userId).then(result => {
      return result.map((set: any) => ({...set, cards: JSON.parse(set.cards)}));
    });
  }

  public addQuizletUser(id: string, userName: string) {
    return this.database.runQuery('INSERT INTO QuizletUsers (id, name) VALUES (?, ?)', id, userName);
  }

  public addQuizletSet(id: string, title: string, userId: string) {
    return this.database.runQuery('INSERT INTO QuizletSets (id, name, userId) VALUES (?, ?, ?)', id, title, userId);
  }

  public addQuizletCards(cards: {index: number, first: string, second: string, third: string}[], setId: string) {
    const cardsString: any[] = [];
    cards.forEach(e => {
      cardsString.push(...[ e.index, e.first, e.second, e.third, setId ]);
    });
    return this.database.runQuery(
      `INSERT INTO QuizletCards (\`index\`, \`first\`, second, third, setId)
      VALUES ${ new Array(cards.length).fill('(?,?,?,?,?)').join(',') }`,
      ...cardsString
    );
  }

  public deleteCardsFromSet(setId: string) {
    return this.database.runQuery('DELETE FROM QuizletCards WHERE setId = ?', setId);
  }

  public getCompletedChallenges(): Promise<string[]> {
    return this.database.runQuery(`SELECT * FROM CompletedChallenges WHERE 1`);
  }

  public addNewCompletedChallenge(challengeId: string): Promise<any> {
    return this.database.runQuery(`
      INSERT INTO CompletedChallenges SET challenge_id = ?
    `, challengeId);
  }
}
