declare module "node:sqlite" {
  export class StatementSync {
    get<T = unknown>(...params: Array<string | number | null>): T;
    all<T = unknown>(...params: Array<string | number | null>): T[];
    run(...params: Array<string | number | null>): void;
  }

  export class DatabaseSync {
    constructor(path: string);
    exec(sql: string): void;
    prepare(sql: string): StatementSync;
  }
}
