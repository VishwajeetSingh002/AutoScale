import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

const region = process.env.AWS_REGION || 'us-east-1';
const bucketName = process.env.AWS_S3_BUCKET_NAME;
const hasStaticCredentials = process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY;
const hasRoleCredentials = process.env.AWS_ROLE_ARN || process.env.AWS_CONTAINER_CREDENTIALS_RELATIVE_URI || process.env.AWS_EC2_METADATA_DISABLED === 'false';
export const useS3 = !!(bucketName && (hasStaticCredentials || hasRoleCredentials));

let s3Client = null;
if (useS3) {
  console.log(`[S3 Configuration] Active. Targets bucket: ${bucketName}`);
  s3Client = new S3Client({ region });
} else {
  console.log('[S3 Configuration] Inactive or missing credentials. Falling back to local storage.');
}

const uploadDir = path.resolve('./uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const allowedTypes = /jpeg|jpg|png|webp/;
const fileFilter = (req, file, cb) => {
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);
  if (extname && mimetype) {
    return cb(null, true);
  }
  cb(new Error('Only images are allowed (jpg, jpeg, png, webp)'));
};

const memoryStorage = multer.memoryStorage();
const diskStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

export const upload = multer({
  storage: useS3 ? memoryStorage : diskStorage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }
});

export const uploadToS3 = async (fileBuffer, originalName, contentType) => {
  if (!useS3) {
    throw new Error('AWS S3 is not configured for this environment.');
  }

  const key = `uploads/${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(originalName)}`;
  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: key,
    Body: fileBuffer,
    ContentType: contentType || 'application/octet-stream',
    ACL: 'public-read'
  });

  await s3Client.send(command);

  const url = region === 'us-east-1'
    ? `https://${bucketName}.s3.amazonaws.com/${encodeURI(key)}`
    : `https://${bucketName}.s3.${region}.amazonaws.com/${encodeURI(key)}`;

  return { url, key };
};
