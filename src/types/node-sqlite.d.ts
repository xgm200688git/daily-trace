declare module "node:sqlite" {
  export interface RunResult {
    lastInsertRowid: number | bigint;
    changes: number;
  }

  export class StatementSync {
    get<T = unknown>(...params: Array<string | number | null>): T | undefined;
    all<T = unknown>(...params: Array<string | number | null>): T[];
    run(...params: Array<string | number | null>): RunResult;
  }

  export class DatabaseSync {
    constructor(path: string);
    exec(sql: string): void;
    prepare(sql: string): StatementSync;
  }
}
