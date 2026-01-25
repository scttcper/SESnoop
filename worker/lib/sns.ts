import { z } from '@hono/zod-openapi';

const snsMessageSchema = z.object({
  Type: z.string(),
  MessageId: z.string(),
  Message: z.string().optional(),
  Subject: z.string().optional(),
  Timestamp: z.string().optional(),
  TopicArn: z.string().optional(),
  Token: z.string().optional(),
  SubscribeURL: z.string().optional(),
  SigningCertURL: z.string().optional(),
  Signature: z.string().optional(),
  SignatureVersion: z.string().optional(),
});

export type SnsMessage = z.infer<typeof snsMessageSchema>;

const signingFields = {
  Notification: ['Message', 'MessageId', 'Subject', 'Timestamp', 'TopicArn', 'Type'],
  SubscriptionConfirmation: [
    'Message',
    'MessageId',
    'SubscribeURL',
    'Timestamp',
    'Token',
    'TopicArn',
    'Type',
  ],
  UnsubscribeConfirmation: [
    'Message',
    'MessageId',
    'SubscribeURL',
    'Timestamp',
    'Token',
    'TopicArn',
    'Type',
  ],
} as const;

export function parseSnsMessage(payload: unknown): SnsMessage {
  return snsMessageSchema.parse(payload);
}

export function shouldVerifySnsSignature(disableFlag?: string): boolean {
  return disableFlag !== 'true';
}

export async function verifySnsSignature(snsMessage: SnsMessage): Promise<boolean> {
  if (!snsMessage.SignatureVersion || snsMessage.SignatureVersion !== '1') {
    return false;
  }

  const certUrl = snsMessage.SigningCertURL;
  if (!certUrl || !snsMessage.Signature) {
    return false;
  }

  if (!isValidCertUrl(certUrl)) {
    return false;
  }

  const toSign = buildStringToSign(snsMessage);
  if (!toSign) {
    return false;
  }

  const certPem = await fetchCert(certUrl);
  if (!certPem) {
    return false;
  }

  const publicKey = getPublicKeyFromCert(certPem);
  if (!publicKey) {
    return false;
  }

  const signatureBytes = Uint8Array.from(atob(snsMessage.Signature), (char) => char.charCodeAt(0));
  const dataBytes = new TextEncoder().encode(toSign);

  return crypto.subtle.verify(
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-1' },
    publicKey,
    signatureBytes,
    dataBytes,
  );
}

function buildStringToSign(snsMessage: SnsMessage): string | null {
  const fields = signingFields[snsMessage.Type as keyof typeof signingFields];
  if (!fields) {
    return null;
  }

  let output = '';
  for (const field of fields) {
    const value = snsMessage[field as keyof SnsMessage];
    if (value === undefined) {
      continue;
    }
    output += `${field}\n${value}\n`;
  }
  return output;
}

function isValidCertUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return (
      parsed.protocol === 'https:' &&
      parsed.hostname.endsWith('.amazonaws.com') &&
      parsed.pathname.endsWith('.pem')
    );
  } catch {
    return false;
  }
}

async function fetchCert(url: string): Promise<string | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      return null;
    }
    return await response.text();
  } catch {
    return null;
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type X509CertificateConstructor = new (cert: string) => { publicKey: CryptoKey };

function getPublicKeyFromCert(certPem: string): CryptoKey | null {
  // X509Certificate may be available on crypto or globalThis depending on the runtime
  const X509Certificate =
    (crypto as unknown as { X509Certificate?: X509CertificateConstructor }).X509Certificate ??
    (globalThis as unknown as { X509Certificate?: X509CertificateConstructor }).X509Certificate;

  if (!X509Certificate) {
    return null;
  }

  try {
    const cert = new X509Certificate(certPem);
    return cert.publicKey;
  } catch {
    return null;
  }
}
