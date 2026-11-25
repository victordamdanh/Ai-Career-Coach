import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { chmodSync } from "node:fs";

export function localDatabase(path) {
  const database = new DatabaseSync(path);
  if (path !== ":memory:") chmodSync(path, 0o600);
  database.exec(readFileSync(new URL("../drizzle/0000_career_match.sql", import.meta.url), "utf8"));
  database.exec(readFileSync(new URL("../drizzle/0001_history.sql", import.meta.url), "utf8"));
  return {
    prepare(sql) {
      const statement = database.prepare(sql);
      return { bind: (...values) => ({
        first: () => statement.get(...values) ?? null,
        all: () => ({ results: statement.all(...values) }),
        run: () => statement.run(...values),
      }) };
    },
    batch(statements) {
      database.exec("BEGIN");
      try {
        const result = statements.map(statement => statement.run());
        database.exec("COMMIT");
        return result;
      } catch (error) {
        database.exec("ROLLBACK");
        throw error;
      }
    },
  };
}
