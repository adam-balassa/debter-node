import { ConnectionConfig, MysqlError, Connection, createConnection } from 'mysql';
import { DatabaseError } from '../interfaces/exceptions.model';
import { Database } from './database.model';

export class MySQLDatabase implements Database {
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

  public beginTransaction(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.isTransactionRunning = true;
      this.connection.beginTransaction(error => {
        if (error) reject(error);
        else resolve();
      });
    });
  }

  public query(query: string, ...parameters: any[]): Promise<any> {
    return new Promise((resolve, reject) => {
      this.connection.query(query, parameters, (error: any, result: any, fields: any) => {
        if (error) {
          console.log(error);
          this.connection.rollback();
          this.isTransactionRunning = false;
          reject(error);
        }
        else resolve(result);
      });
    });
  }

  public run(query: string, ...parameters: any[]): Promise<any> {
    return new Promise((resolve, reject) => {
      this.connection.query(query, parameters, (error: any, result: any, fields: any) => {
        if (error) {
          console.log(error);
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
        this.connection.end((merror: MysqlError) => { if (error) throw new DatabaseError(merror.message); });
        if (error) throw new DatabaseError(error.message);
      });
    else
      this.connection.end((error: MysqlError) => { if (error) throw new DatabaseError(error.message); });
  }
}
