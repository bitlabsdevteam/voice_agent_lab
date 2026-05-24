import { Pool, type QueryResultRow } from "pg";

export type SqlQueryResult<T extends QueryResultRow = QueryResultRow> = {
  rows: T[];
};

export interface SqlDatabase {
  query<T extends QueryResultRow = QueryResultRow>(text: string, values?: unknown[]): Promise<SqlQueryResult<T>>;
}

export class PostgresDatabase implements SqlDatabase {
  private readonly pool: Pool;

  constructor(connectionString: string) {
    this.pool = new Pool({ connectionString });
  }

  async query<T extends QueryResultRow = QueryResultRow>(text: string, values: unknown[] = []): Promise<SqlQueryResult<T>> {
    return this.pool.query<T>(text, values);
  }
}
