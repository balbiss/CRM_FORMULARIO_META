import { S3Client, PutObjectCommand, HeadBucketCommand, CreateBucketCommand, PutBucketPolicyCommand } from '@aws-sdk/client-s3';

const bucket = process.env.MINIO_BUCKET || 'hinode-imoveis';

export const s3 = new S3Client({
  endpoint: process.env.MINIO_ENDPOINT || 'http://localhost:59000',
  region: 'us-east-1',
  forcePathStyle: true,
  credentials: {
    accessKeyId: process.env.MINIO_ACCESS_KEY || '',
    secretAccessKey: process.env.MINIO_SECRET_KEY || '',
  },
});

/** Cria o bucket se não existir e deixa leitura pública (os arquivos em si — foto/vídeo de
 * imóvel, anexo de template — não são sensíveis; só escrita continua exigindo autenticação). */
export async function ensureBucket() {
  try {
    await s3.send(new HeadBucketCommand({ Bucket: bucket }));
  } catch {
    await s3.send(new CreateBucketCommand({ Bucket: bucket }));
    await s3.send(new PutBucketPolicyCommand({
      Bucket: bucket,
      Policy: JSON.stringify({
        Version: '2012-10-17',
        Statement: [{ Effect: 'Allow', Principal: '*', Action: ['s3:GetObject'], Resource: [`arn:aws:s3:::${bucket}/*`] }],
      }),
    }));
    console.log('MinIO: bucket "' + bucket + '" criado com leitura pública');
  }
}

export async function uploadFile(key: string, body: Buffer, contentType: string): Promise<string> {
  await s3.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: contentType }));
  const publicBase = process.env.MINIO_PUBLIC_URL || (process.env.MINIO_ENDPOINT + '/' + bucket);
  return publicBase.replace(/\/$/, '') + '/' + key;
}
