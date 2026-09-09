import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { createTestHarness } from 'wrangler';

import { verifySnsSignature, type SnsMessage } from '../worker/lib/sns';

import { certificatePem, privateKeyPem } from './fixtures/sns-certificate';

afterEach(() => vi.unstubAllGlobals());

async function signedMessage(version: '1' | '2'): Promise<SnsMessage> {
  const message: SnsMessage = {
    Type: 'Notification',
    MessageId: 'test-message',
    Message: '{"eventType":"Send"}',
    Subject: 'Test\nsubject',
    Timestamp: '2025-01-01T00:00:00Z',
    TopicArn: 'arn:aws:sns:us-east-1:123456789012:test',
    SigningCertURL: 'https://sns.us-east-1.amazonaws.com/SimpleNotificationService-test.pem',
    SignatureVersion: version,
  };
  const der = Uint8Array.from(atob(privateKeyPem.replaceAll(/-----[^\n]+-----|\s/g, '')), (c) =>
    c.charCodeAt(0),
  );
  const key = await crypto.subtle.importKey(
    'pkcs8',
    der,
    {
      name: 'RSASSA-PKCS1-v1_5',
      hash: version === '1' ? 'SHA-1' : 'SHA-256',
    },
    false,
    ['sign'],
  );
  const text = ['Message', 'MessageId', 'Subject', 'Timestamp', 'TopicArn', 'Type']
    .map((field) => `${field}\n${message[field as keyof SnsMessage]}\n`)
    .join('');
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    key,
    new TextEncoder().encode(text),
  );
  message.Signature = btoa(String.fromCharCode(...new Uint8Array(signature)));
  return message;
}

describe('SNS signature verification', () => {
  it.each(['1', '2'] as const)('verifies version %s and rejects tampering', async (version) => {
    const fetch = vi.fn().mockImplementation(async () => new Response(certificatePem));
    vi.stubGlobal('fetch', fetch);
    const message = await signedMessage(version);
    expect(await verifySnsSignature(message)).toBe(true);
    expect(fetch).toHaveBeenCalledWith(message.SigningCertURL, { redirect: 'manual' });
    expect(await verifySnsSignature({ ...message, Message: 'tampered' })).toBe(false);
    expect(await verifySnsSignature({ ...message, Signature: 'not base64!' })).toBe(false);
    expect(await verifySnsSignature({ ...message, TopicArn: undefined })).toBe(false);
  });

  it.each([
    'https://bucket.s3.us-east-1.amazonaws.com/SimpleNotificationService-test.pem',
    'https://sns.us-east-1.amazonaws.com.evil.example/SimpleNotificationService-test.pem',
    'http://sns.us-east-1.amazonaws.com/SimpleNotificationService-test.pem',
    'https://user:password@sns.us-east-1.amazonaws.com/SimpleNotificationService-test.pem',
    'https://sns.us-east-1.amazonaws.com:444/SimpleNotificationService-test.pem',
    'https://sns.us-east-1.amazonaws.com/other.pem',
    'https://sns.us-east-1.amazonaws.com/SimpleNotificationService-test.pem?redirect=elsewhere',
  ])('rejects untrusted certificate URL %s without fetching', async (SigningCertURL) => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    expect(await verifySnsSignature({ ...(await signedMessage('1')), SigningCertURL })).toBe(false);
    expect(fetch).not.toHaveBeenCalled();
  });

  it.each([301, 302, 307, 308, 404, 500])('rejects certificate HTTP status %s', async (status) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(certificatePem, { status })));
    expect(await verifySnsSignature(await signedMessage('2'))).toBe(false);
  });

  it('rejects unavailable certificates', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('redirect disallowed')));
    expect(await verifySnsSignature(await signedMessage('2'))).toBe(false);
  });
});

describe('SNS signature verification in Workers', () => {
  const server = createTestHarness({
    workers: [
      {
        config: {
          name: 'sns-verification-test',
          main: './tests/fixtures/sns-worker.ts',
          compatibility_date: '2025-12-20',
        },
      },
    ],
  });

  beforeAll(async () => {
    await server.listen();
  });
  afterAll(async () => {
    await server.close();
  });

  it.each(['1', '2'] as const)(
    'verifies version %s with runtime request validation',
    async (version) => {
      const response = await server.fetch('http://example.com', {
        method: 'POST',
        body: JSON.stringify(await signedMessage(version)),
      });
      expect(await response.json()).toEqual({ verified: true });
    },
  );
});
