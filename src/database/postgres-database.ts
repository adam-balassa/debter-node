import { Database } from './database.model';
import { Client, QueryResultBase, QueryResult } from 'pg';

export class PostgresDatabase implements Database {

  private client: Client;
  private isTransactionRunning = false;

  public constructor() {
    this.client = new Client({
      connectionString: process.env.DATABASE_URL,
      ssl: true
    });

    this.client.connect().catch(err => console.log(err));
  }

  public beginTransaction(): Promise<any> {
    this.isTransactionRunning = true;
    return this.run('begin');
  }

  public run(query: string, ...parameters: any): Promise<QueryResultBase> {
    return new Promise((resolve, reject) => {
      this.client.query(query + ';', parameters, (error: any, result: QueryResultBase) => {
        if (error) {
          if (this.isTransactionRunning && query !== 'rollback' && this.client)
            this.run('rollback').finally(() => {
              reject(error);
            });
          else {
            this.isTransactionRunning = false;
            reject(error);
          }
        }
        else resolve(result);
      });
    });
  }

  public query(query: string, ...parameters: any[]): Promise<any> {
    return this.run(query, ...parameters).then<QueryResult> (result => result as QueryResult)
      .then(res => res.rows);
  }

  public insert(param: { rows: number, columns: number }): string {
    const { rows: nRows, columns } = param;
    const matrix = new Array(nRows).fill(null).map(row => (new Array(columns).fill(null)));
    let num = 1;
    matrix.forEach((row, i) => {
      row.forEach((cell, j) => {
        matrix[i][j] = `$${num++}`;
      });
    });
    const rows = matrix.map(row => `(${row.join(',')})`);
    return rows.join(',');
  }

  public close() {
    if (this.isTransactionRunning)
      this.query('end').finally(() => this.client.end());
    else
      this.client.end();
  }
}
