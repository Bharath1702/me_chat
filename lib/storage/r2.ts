import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export interface MediaStorageProvider {
  createUploadPresignedUrl(key: string, contentType: string, maxSizeBytes: number): Promise<string>;
  getReadPresignedUrl(key: string, expiresInSeconds?: number): Promise<string>;
  getPublicOrPresignedUrl(key: string): Promise<string>;
  uploadBufferDirectly?(key: string, buffer: Buffer, contentType: string): Promise<string>;
}

class CloudflareR2StorageProvider implements MediaStorageProvider {
  private client: S3Client | null = null;
  private bucketName: string;
  private publicUrlBase: string;

  private getClient(): S3Client {
    if (this.client) return this.client;
    const accountId = process.env.R2_ACCOUNT_ID;
    const accessKeyId = process.env.R2_ACCESS_KEY_ID;
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
    if (accountId && accessKeyId && secretAccessKey) {
      this.client = new S3Client({
        region: "auto",
        endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
        credentials: { accessKeyId, secretAccessKey },
      });
      return this.client;
    }
    throw new Error("Cloudflare R2 storage credentials are not configured on the server.");
  }

  constructor() {
    this.bucketName = process.env.R2_BUCKET_NAME || "productez";
    this.publicUrlBase = process.env.R2_PUBLIC_URL || "";
  }

  async createUploadPresignedUrl(key: string, contentType: string): Promise<string> {
    const client = this.getClient();
    const bucket = process.env.R2_BUCKET_NAME || this.bucketName;
    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      ContentType: contentType,
    });
    return await getSignedUrl(client, command, { expiresIn: 600 });
  }

  async uploadBufferDirectly(key: string, buffer: Buffer, contentType: string): Promise<string> {
    const client = this.getClient();
    const bucket = process.env.R2_BUCKET_NAME || this.bucketName;
    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    });
    await client.send(command);
    return this.getPublicOrPresignedUrl(key);
  }

  async getReadPresignedUrl(key: string, expiresInSeconds = 3600): Promise<string> {
    const client = this.getClient();
    const bucket = process.env.R2_BUCKET_NAME || this.bucketName;
    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    });
    return await getSignedUrl(client, command, { expiresIn: expiresInSeconds });
  }

  async getPublicOrPresignedUrl(key: string): Promise<string> {
    const base = (process.env.R2_PUBLIC_URL || this.publicUrlBase).replace(/\/$/, "");
    if (base) {
      return `${base}/${key}`;
    }
    return this.getReadPresignedUrl(key);
  }
}

export const storageProvider: MediaStorageProvider = new CloudflareR2StorageProvider();
