/**
 * Starts a local, persistent MongoDB replica set for development without
 * installing MongoDB (uses mongodb-memory-server binaries). A replica set is
 * used so multi-document transactions behave like MongoDB Atlas.
 *
 *   npm run db:dev        -> mongodb://127.0.0.1:27017/ovelia?replicaSet=ovelia-rs
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { MongoMemoryReplSet } from "mongodb-memory-server";

const port = Number(process.env.DEV_DB_PORT ?? 27017);
// Kept outside the project so build tools never scan live database files.
const dbPath = process.env.DEV_DB_PATH ?? path.join(os.homedir(), ".ovelia", "mongo-data");
fs.mkdirSync(dbPath, { recursive: true });

async function main() {
  const replSet = await MongoMemoryReplSet.create({
    replSet: { name: "ovelia-rs", count: 1, storageEngine: "wiredTiger" },
    instanceOpts: [{ port, dbPath, storageEngine: "wiredTiger" }],
  });
  await replSet.waitUntilRunning();
  const uri = `mongodb://127.0.0.1:${port}/ovelia?replicaSet=ovelia-rs`;
  console.log(`\nMongoDB replica set running.\n  MONGODB_URI=${uri}\n  data: ${dbPath}\n\nPress Ctrl+C to stop.`);

  const shutdown = async () => {
    console.log("\nStopping MongoDB…");
    await replSet.stop({ doCleanup: false, force: false });
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
  setInterval(() => undefined, 1 << 30);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
