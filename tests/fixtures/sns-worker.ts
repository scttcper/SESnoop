import { parseSnsMessage, verifySnsSignature } from '../../worker/lib/sns';

import { certificatePem } from './sns-certificate';

// Keep certificate responses offline, but validate fetch options using the real
// Workers Request constructor. Node accepts redirect: 'error'; Workers rejects it.
globalThis.fetch = async (input, init) => {
  new Request(input, init);
  return new Response(certificatePem);
};

export default {
  async fetch(request: Request) {
    const message = parseSnsMessage(await request.json());
    return Response.json({ verified: await verifySnsSignature(message) });
  },
};
