import { randomUUID } from "node:crypto";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getLocalUploadDir, getPort } from "./env";

export const ALLOWED_UPLOAD_MIME_TYPES = [
  "model/stl",
  "model/obj",
  "model/3mf",
  "application/octet-stream",
  "application/sla",
  "application/pdf",
  "application/zip",
  "image/png",
  "image/jpeg",
  "image/webp",
] as const;

export const MAX_UPLOAD_BYTES = 100 * 1024 * 1024;

export function createFileKey(fileName: string) {
  const safeName = fileName.replace(/[^a-z0-9._-]/gi, "_").slice(0, 120);
  return `designs/${randomUUID()}-${safeName}`;
}

export async function createUploadUrl(input: {
  designId: string;
  fileKey: string;
  fileName: string;
  fileType: string;
}): Promise<{ uploadUrl: string; storageProvider: "local" | "r2" }> {
  const r2 = getR2Config();

  if (r2) {
    const client = new S3Client({
      region: "auto",
      endpoint: r2.endpoint,
      credentials: {
        accessKeyId: r2.accessKeyId,
        secretAccessKey: r2.secretAccessKey,
      },
      forcePathStyle: true,
    });
    const command = new PutObjectCommand({
      Bucket: r2.bucketName,
      Key: input.fileKey,
      ContentType: input.fileType,
      Metadata: {
        design_id: input.designId,
        file_name: input.fileName,
      },
    });
    const uploadUrl = await getSignedUrl(client, command, { expiresIn: 3600 });
    return { uploadUrl, storageProvider: "r2" };
  }

  const baseUrl = (process.env.LOCAL_UPLOAD_BASE_URL ?? `http://localhost:${getPort()}`).replace(/\/$/, "");

  return {
    uploadUrl: `${baseUrl}/designs/upload/${input.designId}/complete`,
    storageProvider: "local",
  };
}

function getR2Config() {
  const endpoint = process.env.R2_ENDPOINT;
  const bucketName = process.env.R2_BUCKET_NAME;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

  if (!endpoint || !bucketName || !accessKeyId || !secretAccessKey) {
    return null;
  }

  return { endpoint, bucketName, accessKeyId, secretAccessKey };
}

export { getLocalUploadDir };