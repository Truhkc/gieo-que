/**
 * lib/storage/r2-sigv4 —— Cloudflare R2（S3 兼容接口）的 AWS SigV4 请求签名
 *
 * 只需要 GET（线上查盘）和 PUT（scripts/dataset/upload-r2.ts 上传），为这两个动作
 * 拉一整个 AWS SDK 不划算。签名算法见 AWS 文档「Signature Version 4」，
 * scripts/regression/interp-dataset.test.ts 用 AWS 官方的 GET 示例向量核对。
 *
 * 不带 'server-only'：上传脚本在 Node 里直接用。密钥只从调用方传进来，本模块不读 env。
 */
import { createHash, createHmac } from 'node:crypto';

export interface S3Credentials {
  accessKeyId: string;
  secretAccessKey: string;
}

export interface SignInput {
  method: 'GET' | 'PUT' | 'HEAD';
  /** 完整 URL，路径部分按 S3 规则逐段编码前的原样即可 */
  url: string;
  /** R2 固定写 'auto' */
  region: string;
  service?: string;
  /** 参与签名的额外请求头（小写键） */
  headers?: Record<string, string>;
  /** 请求体的 SHA-256（hex）；不传则签 UNSIGNED-PAYLOAD */
  payloadSha256?: string;
  /** 测试用：固定签名时间 */
  now?: Date;
}

const sha256Hex = (data: string | Buffer) => createHash('sha256').update(data).digest('hex');
const hmac = (key: Buffer | string, data: string) => createHmac('sha256', key).update(data).digest();

/** S3 的 URI 编码：除 A-Z a-z 0-9 - _ . ~ 外都要 %XX，路径里的 / 保留 */
function encodeS3Path(path: string): string {
  return path.split('/').map(seg =>
    encodeURIComponent(decodeURIComponent(seg)).replace(/[!'()*]/g, c => `%${c.charCodeAt(0).toString(16).toUpperCase()}`),
  ).join('/');
}

/** 返回要附加到请求上的头（含 authorization、x-amz-date、x-amz-content-sha256） */
export function signS3Request(input: SignInput, creds: S3Credentials): Record<string, string> {
  const url = new URL(input.url);
  const service = input.service ?? 's3';
  const amzDate = (input.now ?? new Date()).toISOString().replace(/[:-]|\.\d{3}/g, '');
  const day = amzDate.slice(0, 8);
  const payload = input.payloadSha256 ?? 'UNSIGNED-PAYLOAD';

  const headers: Record<string, string> = {
    ...Object.fromEntries(Object.entries(input.headers ?? {}).map(([k, v]) => [k.toLowerCase(), v.trim()])),
    host: url.host,
    'x-amz-content-sha256': payload,
    'x-amz-date': amzDate,
  };
  const names = Object.keys(headers).sort();
  const canonicalHeaders = names.map(n => `${n}:${headers[n]}\n`).join('');
  const signedHeaders = names.join(';');

  const query = [...url.searchParams.entries()]
    .map(([k, v]) => [encodeURIComponent(k), encodeURIComponent(v)])
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${k}=${v}`)
    .join('&');

  const canonicalRequest = [
    input.method, encodeS3Path(url.pathname), query, canonicalHeaders, signedHeaders, payload,
  ].join('\n');

  const scope = `${day}/${input.region}/${service}/aws4_request`;
  const stringToSign = ['AWS4-HMAC-SHA256', amzDate, scope, sha256Hex(canonicalRequest)].join('\n');
  const kSigning = hmac(hmac(hmac(hmac(`AWS4${creds.secretAccessKey}`, day), input.region), service), 'aws4_request');
  const signature = createHmac('sha256', kSigning).update(stringToSign).digest('hex');

  const { host: _host, ...rest } = headers;
  return {
    ...rest,
    authorization: `AWS4-HMAC-SHA256 Credential=${creds.accessKeyId}/${scope}, ` +
      `SignedHeaders=${signedHeaders}, Signature=${signature}`,
  };
}

export { sha256Hex };

/** R2 的 S3 接口地址：https://<account>.r2.cloudflarestorage.com/<bucket>/<key> */
export function r2ObjectUrl(accountId: string, bucket: string, key: string): string {
  return `https://${accountId}.r2.cloudflarestorage.com/${bucket}/${key}`;
}
