import { Database } from './database';
import { DRoom, DDetail } from '../interfaces/database.model';
import { DatabaseError, Success, Response } from '../interfaces/exceptions.model';
import { Controller } from '../controller/controller';
export class DataLayer {
    database: Database;

    public createNewRoom(room: DRoom, details: DDetail): Promise<Response> {
        return new Promise(async (resolve, reject) => {
            try {
                this.database = new Database();
                this.database.beginTransaction();
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
                resolve(new Success('New Room created'));
            }
            catch (error) {
                console.log(error);
                reject(new DatabaseError(error.message || 'An error occured'));
            }
            finally {
                this.database.close();
            }
        });
    }

    private parseDate(date: Date): string {
        return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()} ` +
            `${('0' + date.getHours()).slice(-2)}:${('0' + date.getMinutes()).slice(-2)}:${('0' + date.getSeconds()).slice(-2)}`;
    }
}
