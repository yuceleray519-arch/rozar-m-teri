import { pgTable, text, serial, timestamp } from "drizzle-orm/pg-core";
import { db } from "./src/db/index.ts";
const logs = pgTable('logs', { id: serial('id') });
async function run() {
  try {
    const query = db.select().from(logs).$dynamic();
    console.log("Success");
  } catch (e) {
    console.error("Error:", e);
  }
}
run();
