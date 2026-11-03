import { config as loadEnv } from "./load-env";
import { checkDatabaseConnection, closePool } from "../src/server/db/client";

loadEnv();

const st = await checkDatabaseConnection();
console.log(JSON.stringify(st, null, 2));
await closePool().catch(() => undefined);
process.exit(st.connected ? 0 : 1);
