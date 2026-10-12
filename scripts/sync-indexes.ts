/**
 * Builds/updates MongoDB indexes for every model (run after deploys that
 * change indexes, especially when autoIndex is disabled in production).
 */
import "./load-env";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";

async function main() {
  await connectDB();
  for (const [name, model] of Object.entries(mongoose.models)) {
    if (["User", "AuthSession"].includes(name)) {
      await model.createIndexes();
    } else {
      await model.syncIndexes();
    }
    console.log(`✓ ${name}`);
  }
}

main()
  .then(() => mongoose.disconnect())
  .then(() => process.exit(0))
  .catch(async (error) => {
    console.error(error);
    await mongoose.disconnect().catch(() => undefined);
    process.exit(1);
  });
