import "server-only";
import { connectDB, User, type UserDoc } from "@/lib/db";
import { isObjectId, toObjectId } from "@/lib/db/model";
import { isStaffRole, STAFF_ROLES, type StaffRole, type UserRole } from "@/lib/domain/roles";
import { AppError, NotFoundError } from "@/lib/result";
import { revokeSessions } from "@/lib/admin/customers";

export async function listStaff() {
  await connectDB();
  const users = await User.find({ role: { $in: STAFF_ROLES } }, { name: 1, email: 1, role: 1, status: 1, lastLoginAt: 1, createdAt: 1 }).lean();
  const order = new Map(STAFF_ROLES.map((r, i) => [r, i]));
  return users.sort((a, b) => (order.get(a.role as StaffRole) ?? 9) - (order.get(b.role as StaffRole) ?? 9) || a.name.localeCompare(b.name));
}

async function activeSuperAdmins(): Promise<number> {
  return User.countDocuments({ role: "super_admin", status: "active" });
}

async function loadTarget(userId: string, actorId: string): Promise<UserDoc> {
  if (!isObjectId(userId)) throw new NotFoundError("User not found");
  if (userId === actorId) throw new AppError("You can't change your own access. Ask another super admin.");
  await connectDB();
  const user = await User.findById(toObjectId(userId)).lean();
  if (!user) throw new NotFoundError("User not found");
  return user;
}

/**
 * Gives an existing account a staff role. Staff create their own account
 * first (so admins never handle anyone else's password), then are added here.
 */
export async function addStaff(email: string, role: StaffRole): Promise<UserDoc> {
  await connectDB();
  const user = await User.findOne({ email: email.trim().toLowerCase() }).lean();
  if (!user) throw new AppError("No account uses that email. Ask them to create an account first, then add them here.");
  if (isStaffRole(user.role)) throw new AppError(`${user.name} is already on the team.`);
  if (user.status === "suspended") throw new AppError("That account is suspended. Reactivate it under Customers first.");
  const updated = await User.findOneAndUpdate({ _id: user._id, role: "customer" }, { $set: { role, updatedAt: new Date() } }, { returnDocument: "after" }).lean();
  if (!updated) throw new AppError("That account changed while saving. Please try again.");
  return updated;
}

/** Changes a staff member's role, or removes staff access (role "customer"). */
export async function changeStaffRole(userId: string, role: UserRole, actorId: string): Promise<{ before: UserDoc; after: UserDoc }> {
  const user = await loadTarget(userId, actorId);
  if (!isStaffRole(user.role)) throw new AppError("This person is not on the team.");
  if (role !== "customer" && !isStaffRole(role)) throw new AppError("Choose a valid role.");
  if (user.role === role) return { before: user, after: user };
  if (user.role === "super_admin" && user.status === "active" && (await activeSuperAdmins()) <= 1) {
    throw new AppError("This is the only active super admin. Make someone else a super admin first.");
  }
  const after = await User.findOneAndUpdate({ _id: user._id, role: user.role }, { $set: { role, updatedAt: new Date() } }, { returnDocument: "after" }).lean();
  if (!after) throw new AppError("Their role changed while saving. Refresh and try again.");
  return { before: user, after };
}

/** Suspends (and signs out) or reactivates a staff member. */
export async function setStaffStatus(userId: string, status: "active" | "suspended", actorId: string): Promise<UserDoc> {
  const user = await loadTarget(userId, actorId);
  if (!isStaffRole(user.role)) throw new AppError("This person is not on the team.");
  if (status === "suspended" && user.role === "super_admin" && user.status === "active" && (await activeSuperAdmins()) <= 1) {
    throw new AppError("This is the only active super admin and can't be suspended.");
  }
  const after = await User.findOneAndUpdate({ _id: user._id }, { $set: { status, updatedAt: new Date() } }, { returnDocument: "after" }).lean();
  if (!after) throw new NotFoundError("User not found");
  if (status === "suspended") await revokeSessions(userId);
  return after;
}
