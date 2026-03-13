import { S3Client, PutObjectCommand, CopyObjectCommand } from '@aws-sdk/client-s3';

function getB2Client(): S3Client {
  const endpoint = process.env.B2_ENDPOINT;
  const accessKeyId = process.env.B2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.B2_SECRET_ACCESS_KEY;

  if (!endpoint || !accessKeyId || !secretAccessKey) {
    throw new Error(
      'Backblaze B2 credentials are not configured. Please set B2_ENDPOINT, B2_ACCESS_KEY_ID, and B2_SECRET_ACCESS_KEY in your environment variables.'
    );
  }

  // Extract region from endpoint (e.g. "s3.eu-central-003.backblazeb2.com" → "eu-central-003")
  const regionMatch = endpoint.match(/s3\.([^.]+)\./);
  const region = regionMatch ? regionMatch[1] : 'us-west-004';

  return new S3Client({
    region,
    endpoint: endpoint.startsWith('https://') ? endpoint : `https://${endpoint}`,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });
}

/**
 * Upload a file to Backblaze B2.
 * This is called asynchronously after a successful R2 upload — users do not wait for this.
 */
export async function uploadToB2(
  filePath: string,
  body: Buffer | Uint8Array,
  contentType: string
): Promise<string> {
  const client = getB2Client();
  const bucketName = process.env.B2_BUCKET_NAME;

  if (!bucketName) {
    throw new Error('B2_BUCKET_NAME environment variable is not set.');
  }

  await client.send(
    new PutObjectCommand({
      Bucket: bucketName,
      Key: filePath,
      Body: body,
      ContentType: contentType,
    })
  );

  const endpoint = process.env.B2_ENDPOINT!.replace(/^https?:\/\//, '');
  return `https://${endpoint}/${bucketName}/${filePath}`;
}

/**
 * Backup by fetching from R2 URL and uploading to B2.
 * Called from the /api/backup route for async backup.
 */
export async function backupUrlToB2(
  sourceUrl: string,
  filePath: string,
  contentType: string
): Promise<string> {
  // Fetch the file from R2's public URL
  const response = await fetch(sourceUrl);
  if (!response.ok) {
    throw new Error(
      `Failed to fetch file from R2 for backup. Status: ${response.status} ${response.statusText}. URL: ${sourceUrl}`
    );
  }

  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  return uploadToB2(filePath, buffer, contentType);
}
