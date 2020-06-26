import { DRoom, DDetail, DMember, DPayment, DDebt, DUser } from '../interfaces/database.model';
import { Room, Member, Payment, Debt, User } from '../interfaces/main.model';
import { Success, Response, DataError } from '../interfaces/exceptions.model';
import { FullRoomData } from '../interfaces/shared.model';
import { SummarizablePayment } from '../interfaces/special-types.model';
import { Database } from './database.model';
import { PostgresDatabase } from './postgres-database';
export class DataLayer {
  private database: PostgresDatabase;

  constructor() {
    this.database = new PostgresDatabase();
  }

  public static async create(transaction: boolean = false): Promise<DataLayer> {
    const dl = new DataLayer();
    if (transaction) await dl.database.beginTransaction();
    return dl;
  }

  public close() {
    this.database.close();
  }

  public createNewRoom(room: DRoom, details: DDetail): Promise<Response<string>> {
    return new Promise(async (resolve, reject) => {
      try {
        const roomResult = await this.database.run(
          'INSERT INTO Rooms(room_key, id) values ($1, $2)',
          room.room_key, room.id
        );
        if (roomResult.rowCount < 1) throw new DataError('New room creation failed');
        const detailResult = await this.database.run(
          'INSERT INTO Details (room_id, name, rounding, default_currency, last_modified) values ($1, $2, $3, $4, $5)',
          details.room_id, details.name, details.rounding, details.default_currency,
          this.parseDate(details.last_modified as Date)
        );
        if (detailResult.rowCount < 1) throw new DataError('Details insertion failed');
        resolve(new Success('New Room created'));
      }
      catch (error) {
        console.log(error);
        reject(error);
      }
    });
  }

  public refreshModified(details: DDetail): Promise<Response> {
    return this.database.run(
      'UPDATE Details SET last_modified = $1 WHERE room_id = $2',
      this.parseDate(details.last_modified as Date), details.room_id
    ).then(result => new Success(''));
  }

  public addMembersToRoom(members: DMember[], roomKey: string): Promise<Response<string>> {
    return new Promise(async (resolve, reject) => {
      try {
        const result: { id: string }[] = await this.database.query(
          'SELECT id FROM Rooms WHERE room_key = $1', roomKey
        );
        if (result.length !== 1) throw new DataError('Cannot get roomId');
        const roomId = result[0].id;
        if (!roomId) throw new DataError('Invalid roomId');

        const membersString: any[] = [];

        const users = await this.database.query('SELECT email, id, firstname as firstName FROM Users');
        members.forEach(m => { membersString.push(
          ...[m.id, roomId, m.user_id == null ? null : users.find((u: any) => u.email === m.user_id).id,
            (m.user_id == null ? m.alias : users.find((u: any) => u.email === m.user_id).firstName)]
          ); });


        this.database.run(
          `INSERT INTO Members(id, room_id, user_id, alias)
          VALUES ${ this.database.insert({rows: members.length, columns: 4}) }`, // could do better
          ...membersString
        ).then(() => resolve(new Success('Members successfully added')));
      }
      catch (error) {
        if (error instanceof Error)
          reject(error);
        else
          reject(new DataError(error.message || 'An error occurred'));
      }
    });
  }

  public getDetails(roomKey: string): Promise<Room> {
    return new Promise(async (resolve, reject) => {
      try {
        const result = await this.database.query(
          `SELECT Rooms.id, name, rounding, default_currency, last_modified
          FROM Details
          INNER JOIN Rooms ON Rooms.id = room_id
          WHERE room_key=$1`,
          roomKey
        );
        if (result.length === 1)
          resolve({
            id: result[0].id,
            key: roomKey,
            rounding: result[0].rounding,
            defaultCurrency: result[0].default_currency,
            name: result[0].name,
            lastModified: new Date(result[0].lastModified)
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
    return this.database.query(
      `SELECT room_id as id FROM Details WHERE last_modified < $1 OR Details.room_id NOT IN(
        SELECT Rooms.id FROM Rooms
        INNER JOIN Members ON Members.room_id = Rooms.id
        INNER JOIN Debts ON Debts.from_member = Members.id
        WHERE NOT arranged
        )
      AND last_modified < $2`,
        this.parseDate(lastModified), this.parseDate(lastModifiedIfArranged)
    );
  }

  public getAllRooms() {
    return this.database.query('SELECT room_key FROM Rooms WHERE 1');
  }

  public deleteRooms(ids: string[]): Promise<any> {
    return this.database.query(
      `DELETE FROM Rooms WHERE id IN (${this.database.insert({rows: ids.length, columns: 1})})`,
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

        const dUsers: DUser[] = await this.getRoomUsers(dMembers);
        const users: User[] = dUsers.map<User>(member => (
          { firstName: member.firstname, lastName: member.lastname, email: member.email, id: member.id }));

        const members: Member[] = dMembers.map<Member>((member: DMember): Member => {
          return { id: member.id as string, name: member.alias, userId: (member.user_id === null ? null : member.user_id as string) };
        });
        const payments: Payment[] = dPayments.map<Payment>((payment: DPayment): Payment => {
          return { id: payment.id as string, value: payment.value, currency: payment.currency,
            realValue: payment.value, memberId: payment.member_id as string, fromId: payment.related_to as string, note: payment.note,
            date: payment.date as Date, active: payment.active as boolean, included: payment.included, excluded: payment.excluded};
        });
        const debts: Debt[] = dDebts.map<Debt>((debt: DDebt): Debt => {
          return { value: debt.value, currency: debt.currency, for: debt.to_member, from: debt.from_member, arranged: debt.arranged };
        });
        resolve({members, payments, debts, users});
      }
      catch (error) {
        console.log(error);
        reject(error);
      }
    });
  }

  public getRoomUsers(members: DMember[]): Promise<DUser[]> {
    return new Promise(async (resolve, reject) => {
      try {
        const userIds: string[] = [];
        members.forEach(member => {
          if (member.user_id != null)
            userIds.push(member.user_id);
        });
        if (userIds.length === 0)
          return resolve([]);
        const result = await this.database.query(
          `select Users.id, firstname, lastname, email from Users
              where Users.id in (${this.database.insert({rows: userIds.length, columns: 1})}) `,
          ...userIds
        );
        resolve(result);
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
        const result = await this.database.run(
          'UPDATE Payments SET active = false WHERE id = $1 OR related_to = $2',
          paymentId, paymentId
        );
        if (result.rowCount < 1) throw new DataError('Invalid payment or room id');
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
        const result = await this.database.run(
          `DELETE FROM Payments WHERE
            related_to IN (${this.database.insert({rows: payments.length, columns: 1})})`,
          ...payments
        );
        if (result.rowCount < 1) throw new DataError('Invalid payment or room id');
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
        const result = await this.database.query(
          'UPDATE Payments SET active = true WHERE id = $1 OR related_to = $2',
          paymentId, paymentId
        );
        if (result.rowCount < 1) throw new DataError('Invalid payment or room id');
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
        const res = await this.database.run(
          `INSERT INTO Payments (id, value, currency, note, related_to, date, active, member_id)
          VALUES ${ this.database.insert({rows: payments.length, columns: 8}) }`,
          ...paymentsString
        );
        if (res.rowCount !== payments.length) throw new DataError('Insertion failed');
        resolve(new Success(`${payments.length} payment(s) successfully uploaded`));
      }
      catch (error) { reject(error); }
    });
  }

  public getSummarizedPayments(room: DRoom): Promise<Response<SummarizablePayment[]>> {
    return new Promise(async (resolve, reject) => {
      try {
        const result = await this.database.query(
          `SELECT
            Members.id as memberId,
            coalesce(p.value, 0) as value,
            coalesce(currency, default_currency) as currency
          FROM Members
          LEFT JOIN (SELECT value, currency, member_id FROM Payments WHERE active = true) p
          ON p.member_id = Members.id
          INNER JOIN Rooms ON Rooms.id = Members.room_id
          INNER JOIN Details ON Rooms.id = Details.room_id
          WHERE Rooms.room_key = $1
          ORDER BY Members.id`,
            room.room_key
        ).then(res => res.map((r: any) => ({ ...r, memberId: r.memberid })));
        if (result.rowCount < 1) throw new DataError('Invalid room_key');
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
        await this.database.run(
          `DELETE FROM Debts WHERE from_member IN (
            SELECT Members.id FROM Members
            INNER JOIN Rooms ON room_id = Rooms.id
            WHERE Rooms.room_key = $1
          )`,
          roomKey
        );
        if (debts.length === 0) return resolve(new Success('All debts arranged'));
        const debtsString: any[] = [];
        debts.forEach(e => {
          debtsString.push(...[ e.from_member, e.to_member, e.value, e.currency, e.arranged ]);
        });
        const insertResult = await this.database.run(
          `INSERT INTO Debts (from_member, to_member, value, currency, arranged)
          VALUES ${ this.database.insert({rows: debts.length, columns: 5}) }`,
          ...debtsString
        );
        if (insertResult.rowCount < 1) throw new DataError('Insertion failed');
        resolve(new Success('Debts successfully refreshed'));
      }
      catch (error) {
        console.log(error);
        reject(error);
      }
    });
  }

  public getMembers(roomKey: string): Promise<DMember[]> {
    return this.database.query(
      `SELECT Members.id as id, Rooms.id as room_id, user_id, alias
      FROM Members
      INNER JOIN Rooms ON room_id = Rooms.id
      WHERE room_key = $1
      ORDER BY id DESC`,
      roomKey
    );
  }

  public getAllPayments(members: DMember[]): Promise<DPayment[]> {
    return new Promise(async (resolve, reject) => {
      try {

        const res = await this.database.query(
          `select id, value, note, currency, date, active, member_id,
            coalesce(excludedMembers.members, array[]::text[]) as excluded,
            coalesce(includedMembers.members, array[]::text[]) as included
          from Payments
          left join (select related_to, array_agg(member_id) as members from payments where value > 0 group by related_to) excludedMembers
            on excludedMembers.related_to = Payments.id
          left join (select related_to, array_agg(member_id) as members from payments where value < 0 group by related_to) includedMembers
            on includedMembers.related_to = Payments.id
          where member_id in (${ this.database.insert({ rows: members.length, columns: 1 }) })
          and Payments.related_to is null`,

          ...members.map(member => member.id)
        ).then (payments => payments.map((payment: any) => ({...payment, date: new Date(parseInt(payment.date))})));

        resolve(res as DPayment[]);
      }
      catch (err) {
        reject(err);
      }
    });
  }

  public getDebts(memberIds: string[]): Promise<DDebt[]> {
    return this.database.query(
      `SELECT id, value, currency, from_member, to_member, arranged
      FROM Debts WHERE from_member IN (${this.database.insert({rows: memberIds.length, columns: 1})})`,
      ...memberIds
    );
  }

  public setCurrency(roomKey: string, currency: string): Promise<Response> {
    return new Promise((resolve, reject) => {
      this.database.run(
        `UPDATE Details SET default_currency = $1 WHERE room_id = (SELECT id FROM Rooms WHERE room_key = $2)`,
        currency, roomKey
      ).then(result => {
        if (result.rowCount < 1) throw new DataError('Modification failed');
        resolve(new Success(`New main currency set`));
      })
      .catch(error => reject(new DataError(error.message)));
    });
  }

  public setRounding(roomKey: string, rounding: number): Promise<Response> {
    return new Promise((resolve, reject) => {
      this.database.run(
        `UPDATE Details SET rounding = $1 WHERE room_id = (SELECT id FROM Rooms WHERE room_key = $2)`,
        rounding, roomKey
      ).then(result => {
        if (result.rowCount < 1) throw new DataError('Modification failed');
        resolve(new Success(`New rounding set`));
      })
      .catch(error => reject(new DataError(error.message)));
    });
  }

  public deleteMember(memberId: string): Promise<any> {
    return this.database.run('DELETE FROM Members WHERE id = $1', memberId);
  }

  public addNewUser(user: DUser): Promise<Response<string>> {
    return new Promise((resolve, reject) => {
      this.database.run(
        `INSERT INTO Users (id, firstname, lastname, email, password)
        VALUES($1,$2,$3,$4,$5)`,
        user.id, user.firstname, user.lastname, user.email, user.password
      ).then(result => {
        if (result.rowCount < 1) throw new DataError('Modification failed');
        resolve(new Success(`New user added`));
      })
      .catch(error => reject(new DataError(error.message)));
    });
  }

  public getUserData(email: string): Promise<DUser> {
    return new Promise((resolve, reject) => {
      this.database.query(
        `SELECT * FROM Users WHERE email = $1`,
        email
      ).then(result => {
        if (result.length < 1) throw new DataError('User not found failed');
        resolve({
          id: result[0].id,
          email: result[0].email,
          firstname: result[0].firstname,
          lastname: result[0].lastname,
          password: result[0].password});
      })
      .catch(error => reject(new DataError(error.message)));
    });
  }

  public getUsersRooms(email: string): Promise<{room_key: string, name: string}[]> {
    return new Promise((resolve, reject) => {
      this.database.query(
        `select room_key, name, email, last_modified from Rooms
          inner join Details
            on Details.room_id = Rooms.id
          inner join Members
            on Members.room_id = Rooms.id
          inner join Users
            on Members.user_id = Users.id
          where email = $1`,
        email
      ).then((result) => {
        resolve(result
          .sort((a: any, b: any) => b.last_modified - a.last_modified)
          .map((res: any) => ({room_key: res.room_key as string, name: res.name as string})));
      })
      .catch(error => reject(new DataError(error.message)));
    });
  }

  public getUsersDebts(email: string): Promise<any[]> {
    return new Promise((resolve, reject) => {
      this.database.query(
        `select
          m1.id as fromMember,
          m2.id as toMember,
          m2.alias as name,
          Debts.currency,
          Debts.value,
          Details.name as roomName,
          Rooms.room_key as roomKey
        from Debts
        inner join Members m1
          on Debts.from_member = m1.id
        inner join Members m2
          on Debts.to_member = m2.id
        inner join Users
          on Users.id = m1.user_id
        inner join Rooms
          on Rooms.id = m1.room_id
        inner join Details
          on Details.room_id = Rooms.id
        where email = $1 and arranged = 0`,
        email
      ).then((result) => {
        if (result.length < 1) throw new DataError('User not found');
        resolve(result);
      })
      .catch(error => reject(new DataError(error.message)));
    });
  }

  public getUsers(): Promise<any> {
    return new Promise((resolve, reject) => {
      this.database.query(
        `select email, firstname as firstName, lastname as lastName
        from Users
        where 1`
      ).then((result) => {
        if (result.length < 1) throw new DataError('Users not found');
        resolve(result);
      })
      .catch(error => reject(new DataError(error.message)));
    });
  }

  private parseDate(date: Date): string {
    return date.getTime().toString();
  }

  // ################## QUIZLET QUERIES ########################
  public getQuizletUsers(): Promise<{name: string, id: string}[]> {
    return this.database.query('SELECT * FROM QuizletUsers');
  }

  public getQuizletSets(userId: string) {
    return this.database.query(`
    SELECT id, name, array_to_json(array_agg(cards.cards)) AS cards
    FROM QuizletSets LEFT JOIN (
      SELECT setId, JSON_OBJECT('first', \`first\`, 'second', second, 'third', third, 'index', \`index\`) AS cards
      FROM QuizletCards
    ) cards ON setId = id
    WHERE userId = $1
    GROUP BY id
    `, userId).then(result => {
      return result.map((set: any) => ({...set, cards: JSON.parse(set.cards)}));
    });
  }

  public addQuizletUser(id: string, userName: string) {
    return this.database.query('INSERT INTO QuizletUsers (id, name) VALUES ($1, $2)', id, userName);
  }

  public addQuizletSet(id: string, title: string, userId: string) {
    return this.database.query('INSERT INTO QuizletSets (id, name, userId) VALUES ($1, $2, $3)', id, title, userId);
  }

  public addQuizletCards(cards: {index: number, first: string, second: string, third: string}[], setId: string) {
    const cardsString: any[] = [];
    cards.forEach(e => {
      cardsString.push(...[ e.index, e.first, e.second, e.third, setId ]);
    });
    return this.database.run(
      `INSERT INTO QuizletCards (\`index\`, \`first\`, second, third, setId)
      VALUES ${ this.database.insert({rows: cards.length, columns: 5}) }`,
      ...cardsString
    );
  }

  public deleteCardsFromSet(setId: string) {
    return this.database.run('DELETE FROM QuizletCards WHERE setId = $1', setId);
  }

  public getCompletedChallenges(): Promise<string[]> {
    return new Promise(resolve => {
      this.database.query(`SELECT challenge_id FROM CompletedChallenges WHERE 1`)
      .then(records => resolve(records.map((record: any) => record.challenge_id)));
    });
  }

  public addNewCompletedChallenge(challengeId: string): Promise<any> {
    return this.database.run(`
      INSERT INTO CompletedChallenges SET challenge_id = $2
    `, challengeId);
  }
}
