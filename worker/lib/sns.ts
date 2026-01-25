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

  const publicKey = await getPublicKeyFromCert(certPem);
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

/**
 * Extract the public key from an X.509 PEM certificate.
 * Cloudflare Workers don't support X509Certificate, so we parse manually.
 */
async function getPublicKeyFromCert(certPem: string): Promise<CryptoKey | null> {
  try {
    // Remove PEM headers and decode base64
    const pemContents = certPem
      .replace(/-----BEGIN CERTIFICATE-----/g, '')
      .replace(/-----END CERTIFICATE-----/g, '')
      .replace(/\s/g, '');

    const binaryDer = Uint8Array.from(atob(pemContents), (c) => c.charCodeAt(0));

    // Parse the X.509 certificate to extract the SubjectPublicKeyInfo (SPKI)
    const spki = extractSpkiFromCert(binaryDer);
    if (!spki) {
      return null;
    }

    // Import the public key using Web Crypto API
    return await crypto.subtle.importKey(
      'spki',
      spki.buffer as ArrayBuffer,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-1' },
      false,
      ['verify'],
    );
  } catch {
    return null;
  }
}

/**
 * Extract SubjectPublicKeyInfo from a DER-encoded X.509 certificate.
 * This is a minimal ASN.1 parser for the specific structure we need.
 */
function extractSpkiFromCert(certDer: Uint8Array): Uint8Array | null {
  try {
    let offset = 0;

    // Parse outer SEQUENCE (Certificate)
    const certSeq = parseAsn1Sequence(certDer, offset);
    if (!certSeq) return null;

    // Parse TBSCertificate SEQUENCE
    const tbsSeq = parseAsn1Sequence(certDer, certSeq.contentOffset);
    if (!tbsSeq) return null;

    let tbsOffset = tbsSeq.contentOffset;

    // Skip version if present (context tag [0])
    if (certDer[tbsOffset] === 0xa0) {
      const versionField = parseAsn1Element(certDer, tbsOffset);
      if (!versionField) return null;
      tbsOffset = versionField.nextOffset;
    }

    // Skip serialNumber (INTEGER)
    const serialNum = parseAsn1Element(certDer, tbsOffset);
    if (!serialNum) return null;
    tbsOffset = serialNum.nextOffset;

    // Skip signature algorithm (SEQUENCE)
    const sigAlg = parseAsn1Element(certDer, tbsOffset);
    if (!sigAlg) return null;
    tbsOffset = sigAlg.nextOffset;

    // Skip issuer (SEQUENCE)
    const issuer = parseAsn1Element(certDer, tbsOffset);
    if (!issuer) return null;
    tbsOffset = issuer.nextOffset;

    // Skip validity (SEQUENCE)
    const validity = parseAsn1Element(certDer, tbsOffset);
    if (!validity) return null;
    tbsOffset = validity.nextOffset;

    // Skip subject (SEQUENCE)
    const subject = parseAsn1Element(certDer, tbsOffset);
    if (!subject) return null;
    tbsOffset = subject.nextOffset;

    // subjectPublicKeyInfo (SEQUENCE) - this is what we want!
    const spkiElement = parseAsn1Element(certDer, tbsOffset);
    if (!spkiElement) return null;

    // Return the entire SPKI element including tag and length
    return certDer.slice(tbsOffset, spkiElement.nextOffset);
  } catch {
    return null;
  }
}

interface Asn1Element {
  tag: number;
  length: number;
  contentOffset: number;
  nextOffset: number;
}

function parseAsn1Element(data: Uint8Array, offset: number): Asn1Element | null {
  if (offset >= data.length) return null;

  const tag = data[offset];
  let lengthOffset = offset + 1;

  if (lengthOffset >= data.length) return null;

  let length = data[lengthOffset];
  let contentOffset = lengthOffset + 1;

  // Long form length
  if (length & 0x80) {
    const numLengthBytes = length & 0x7f;
    if (numLengthBytes > 4 || lengthOffset + numLengthBytes >= data.length) return null;

    length = 0;
    for (let i = 0; i < numLengthBytes; i++) {
      length = (length << 8) | data[lengthOffset + 1 + i];
    }
    contentOffset = lengthOffset + 1 + numLengthBytes;
  }

  return {
    tag,
    length,
    contentOffset,
    nextOffset: contentOffset + length,
  };
}

function parseAsn1Sequence(data: Uint8Array, offset: number): Asn1Element | null {
  const element = parseAsn1Element(data, offset);
  if (!element || element.tag !== 0x30) return null;
  return element;
}
