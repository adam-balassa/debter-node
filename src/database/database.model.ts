export interface Transactional {
    close(): void;
    beginTransaction(): Promise<any>;
}


export interface Database extends Transactional {
    query(query: string, ...parameters: any): Promise<any>;
    run(query: string, ...parameters: any): Promise<any>;
}
