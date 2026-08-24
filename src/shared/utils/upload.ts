import { PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { s3 } from "../config/storage";
import { env } from "../config/env";
import { AppError } from "./app-error";
import crypto from "crypto";
import path from "path";

const BUCKET = env.R2_BUCKET_INCIDENTS;

const publicUrlFor = (key: string): string => {
  if (!env.R2_PUBLIC_URL) {
    throw new AppError("R2_PUBLIC_URL is not configured", 500);
  }
  return `${env.R2_PUBLIC_URL}/${key}`;
};

/**
 * Uploads an incident photo to R2, after client-side compression (upstream,
 * in the PWA). Returns the public URL to store in Incident.photoUrl.
 */
export const uploadIncidentPhoto = async (file: Express.Multer.File): Promise<string> => {
  const ext = path.extname(file.originalname) || ".jpg";
  const key = `incidents/${crypto.randomUUID()}${ext}`;

  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: file.buffer,
      ContentType: file.mimetype,
    }),
  );

  return publicUrlFor(key);
};

export const deleteIncidentPhoto = async (url: string): Promise<void> => {
  if (!env.R2_PUBLIC_URL || !url.startsWith(env.R2_PUBLIC_URL)) return;

  const key = url.slice(env.R2_PUBLIC_URL.length + 1);
  if (!key) return;

  await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
};