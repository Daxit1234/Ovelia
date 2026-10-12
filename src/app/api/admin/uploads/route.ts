import { authorize } from "@/lib/auth/session";
import { hasPermission, type Permission } from "@/lib/domain/roles";
import { AppError } from "@/lib/result";
import { audit } from "@/lib/services/audit";
import { rateLimit } from "@/lib/services/rate-limit";
import { storeImage } from "@/lib/services/storage";

/** Each upload folder needs the permission for the content it belongs to. */
const FOLDER_PERMISSIONS = {
  products: "products:write",
  categories: "categories:write",
  banners: "content:write",
} as const satisfies Record<string, Permission>;

type Folder = keyof typeof FOLDER_PERMISSIONS;

/** Admin image upload (multipart/form-data: file, folder). */
export async function POST(request: Request) {
  try {
    const user = await authorize("dashboard:view");
    const limit = await rateLimit(`upload:${user.id}`, 60, 600);
    if (!limit.allowed) return Response.json({ error: "Too many uploads. Please wait a few minutes." }, { status: 429 });

    const form = await request.formData();
    const file = form.get("file");
    const folder = String(form.get("folder") ?? "products");
    if (!(file instanceof File)) return Response.json({ error: "No file uploaded" }, { status: 400 });
    if (!(folder in FOLDER_PERMISSIONS)) return Response.json({ error: "Invalid folder" }, { status: 400 });
    if (!hasPermission(user.role, FOLDER_PERMISSIONS[folder as Folder])) {
      return Response.json({ error: "You do not have permission to upload these images." }, { status: 403 });
    }

    const stored = await storeImage(file, folder as Folder);
    await audit({
      actor: { id: user.id, name: user.name, email: user.email, role: user.role },
      action: "media.upload",
      entityType: "media",
      entityId: stored.publicId ?? stored.url,
      summary: `Uploaded ${folder} image ${file.name}`,
    });
    return Response.json(stored);
  } catch (error) {
    if (error instanceof AppError) return Response.json({ error: error.message }, { status: error.status });
    console.error("Upload failed", error);
    return Response.json({ error: "Upload failed" }, { status: 500 });
  }
}
