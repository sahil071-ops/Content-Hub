import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { getStorageErrorMessage } from '@/lib/utils';

function getR2Client(): S3Client {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error(
      'Cloudflare R2 credentials are not configured. Please set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, and R2_SECRET_ACCESS_KEY in your environment variables.'
    );
  }

  return new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });
}

export async function getR2PresignedUploadUrl(
  filePath: string,
  contentType: string,
  expiresIn = 3600
): Promise<string> {
  const client = getR2Client();
  const bucketName = process.env.R2_BUCKET_NAME;

  if (!bucketName) {
    throw new Error('R2_BUCKET_NAME environment variable is not set.');
  }

  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: filePath,
    ContentType: contentType,
  });

  return getSignedUrl(client, command, { expiresIn });
}

export function getR2PublicUrl(filePath: string): string {
  const publicUrl = process.env.R2_PUBLIC_URL;
  if (!publicUrl) {
    throw new Error(
      'R2_PUBLIC_URL environment variable is not set. Set this to your R2 bucket public URL (e.g. https://pub-xxxx.r2.dev).'
    );
  }
  return `${publicUrl.replace(/\/$/, '')}/${filePath}`;
}

export async function uploadToR2(
  filePath: string,
  body: Buffer | Uint8Array,
  contentType: string
): Promise<string> {
  const client = getR2Client();
  const bucketName = process.env.R2_BUCKET_NAME;

  if (!bucketName) {
    throw new Error('R2_BUCKET_NAME environment variable is not set.');
  }

  await client.send(
    new PutObjectCommand({
      Bucket: bucketName,
      Key: filePath,
      Body: body,
      ContentType: contentType,
    })
  );

  return getR2PublicUrl(filePath);
}

export async function deleteFromR2(filePath: string): Promise<void> {
  const client = getR2Client();
  const bucketName = process.env.R2_BUCKET_NAME;

  if (!bucketName) {
    throw new Error('R2_BUCKET_NAME environment variable is not set.');
  }

  await client.send(
    new DeleteObjectCommand({
      Bucket: bucketName,
      Key: filePath,
    })
  );
}

export async function getR2SignedDownloadUrl(
  filePath: string,
  expiresIn = 3600
): Promise<string> {
  const client = getR2Client();
  const bucketName = process.env.R2_BUCKET_NAME;

  if (!bucketName) {
    throw new Error('R2_BUCKET_NAME environment variable is not set.');
  }

  const command = new GetObjectCommand({
    Bucket: bucketName,
    Key: filePath,
  });

  return getSignedUrl(client, command, { expiresIn });
}
