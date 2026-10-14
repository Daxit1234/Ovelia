import "server-only";
import { randomBytes } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { v2 as cloudinary, type UploadApiResponse } from "cloudinary";
import { getEnv, integrations } from "@/lib/env";
import { AppError } from "@/lib/result";

export const ALLOWED_IMAGE_TYPES = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
} as const;

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export interface StoredImage {
  url: string;
  publicId: string | null;
  width: number | null;
  height: number | null;
}

/** Checks magic bytes so a renamed file can't masquerade as an image. */
function sniff(buffer: Buffer): keyof typeof ALLOWED_IMAGE_TYPES | null {
  if (buffer.length < 12) return null;
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return "image/jpeg";
  if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP") return "image/webp";
  if (buffer.subarray(4, 12).toString("ascii").startsWith("ftypavi")) return "image/avif";
  return null;
}

let configured = false;
function cloud() {
  if (!configured) {
    const env = getEnv();
    cloudinary.config({ cloud_name: env.CLOUDINARY_CLOUD_NAME, api_key: env.CLOUDINARY_API_KEY, api_secret: env.CLOUDINARY_API_SECRET, secure: true });
    configured = true;
  }
  return cloudinary;
}

export async function storeImage(file: File, folder: "products" | "categories" | "banners"): Promise<StoredImage> {
  if (file.size === 0) throw new AppError("The file is empty.");
  if (file.size > MAX_IMAGE_BYTES) throw new AppError("Images must be 5 MB or smaller.");
  const buffer = Buffer.from(await file.arrayBuffer());
  const type = sniff(buffer);
  if (!type) throw new AppError("Upload a JPG, PNG, WebP or AVIF image.");

  if (integrations.cloudinary()) {
    const env = getEnv();
    const result = await new Promise<UploadApiResponse>((resolve, reject) => {
      const stream = cloud().uploader.upload_stream(
        { folder: `${env.CLOUDINARY_FOLDER}/${folder}`, resource_type: "image", overwrite: false, unique_filename: true },
        (error, response) => (error || !response ? reject(error ?? new Error("Upload failed")) : resolve(response)),
      );
      stream.end(buffer);
    });
    return { url: result.secure_url, publicId: result.public_id, width: result.width ?? null, height: result.height ?? null };
  }

  if (getEnv().NODE_ENV === "production") {
    throw new AppError("Image storage is not configured. Add Cloudinary credentials to enable uploads in production.", "STORAGE_DISABLED", 503);
  }
  // Development fallback: keep filesystem writes inside one statically known
  // directory so Next.js can trace this route without treating the project
  // root as a runtime dependency.
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const name = `${folder}-${now.getFullYear()}-${month}-${randomBytes(12).toString("hex")}.${ALLOWED_IMAGE_TYPES[type]}`;
  const uploadDir = path.join("public", "uploads");
  await mkdir(uploadDir, { recursive: true });
  await writeFile(path.join(uploadDir, name), buffer);
  return { url: `/uploads/${name}`, publicId: null, width: null, height: null };
}

export async function deleteStoredImage(publicId: string | null | undefined): Promise<void> {
  if (!publicId || !integrations.cloudinary()) return;
  await cloud()
    .uploader.destroy(publicId)
    .catch((error: unknown) => console.error("Cloudinary delete failed", error));
}
