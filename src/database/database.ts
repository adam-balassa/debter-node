import { ConnectionConfig, MysqlError, Connection, createConnection } from 'mysql';
import { DatabaseError } from '../interfaces/exceptions.model';

export class Database {
    readonly mysqlConfig: ConnectionConfig = {
        host: 'remotemysql.com',
        database: 'BkMfl7pWj2',
        user: 'BkMfl7pWj2',
        password: 'xlzJtt2zTl',
        port: 3306
    };

    connection: Connection;
    isTransactionRunning: boolean = false;

    public constructor() {
        this.connection = createConnection(this.mysqlConfig);
    }

    public beginTransaction() {
        this.isTransactionRunning = true;
        this.connection.beginTransaction(error => {
            if (error) throw error;
        });
    }

    public runQuery(query: string, ...parameters: (string|undefined)[]): Promise<any> {
        return new Promise((resolve, reject) => {
            this.connection.query(query, parameters, (error: any, result: any, fields: any) => {
                if (error) {
                    this.connection.rollback();
                    this.isTransactionRunning = false;
                    reject(error);
                }
                else resolve(result);
            });
        });
    }

    public close() {
        if (this.isTransactionRunning)
            this.connection.commit(error => {
                if (error) throw new DatabaseError(error.message);
            });
        this.connection.end((error: MysqlError) => { if (error) throw new DatabaseError(error.message); });
    }
}
