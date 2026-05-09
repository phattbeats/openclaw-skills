import { GraphClient } from './lib/client.js';

async function main() {
  const client = new GraphClient('emp', false);
  
  // Get a token and decode it to see scopes (JWT decode without verification)
  const raw = (client as any);
  const token = await raw.fetchToken();
  
  // JWT decode
  const parts = token.split('.');
  const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
  const scopes = payload.scp || payload.roles || [];
  console.log('Token scopes:', JSON.stringify(scopes, null, 2));
  console.log('Tenant:', payload.tid);
  console.log('App ID:', payload.appid);
}

main().catch(e => console.error(e.message));
