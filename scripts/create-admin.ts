/**
 * Creates a staff account or changes an existing user's role.
 *
 *   npm run admin:create -- --email owner@example.com --password 'S3cure!pass' --name "Owner" --role super_admin
 *   npm run admin:create -- --email manager@example.com --role order_manager   (promote existing user)
 */
import "./load-env";
import mongoose from "mongoose";
import { connectDB, User } from "@/lib/db";
import { getAuth } from "@/lib/auth/auth";
import { STAFF_ROLES, type StaffRole } from "@/lib/domain/roles";

function arg(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function main() {
  const email = arg("email")?.trim().toLowerCase();
  const password = arg("password");
  const name = arg("name") ?? "Staff";
  const role = (arg("role") ?? "super_admin") as StaffRole;
  if (!email) throw new Error("--email is required");
  if (!STAFF_ROLES.includes(role)) throw new Error(`--role must be one of: ${STAFF_ROLES.join(", ")}`);

  await connectDB();
  const existing = await User.findOne({ email }).lean();
  if (!existing) {
    if (!password || password.length < 8) throw new Error("--password (min 8 characters) is required for a new account");
    const auth = await getAuth();
    await auth.api.signUpEmail({ body: { email, password, name } });
    console.log(`Created account ${email}`);
  }
  await User.updateOne({ email }, { $set: { role, status: "active" } });
  console.log(`${email} now has role ${role}`);
}

main()
  .then(() => mongoose.disconnect())
  .then(() => process.exit(0))
  .catch(async (error) => {
    console.error(error instanceof Error ? error.message : error);
    await mongoose.disconnect().catch(() => undefined);
    process.exit(1);
  });
