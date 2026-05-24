import type { SqlDatabase, SqlQueryResult } from "../../src/db/postgres";
import type { QueryResultRow } from "pg";

export type RecordedQuery = {
  text: string;
  values: unknown[];
};

export class MockSqlDatabase implements SqlDatabase {
  readonly queries: RecordedQuery[] = [];

  constructor(private readonly results: QueryResultRow[][] = []) {}

  async query<T extends QueryResultRow = QueryResultRow>(text: string, values: unknown[] = []): Promise<SqlQueryResult<T>> {
    this.queries.push({ text, values });
    return {
      rows: ((this.results.shift() ?? []) as T[])
    };
  }
}
