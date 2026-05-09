import { GraphClient } from './lib/client.js';

async function main() {
  const client = new GraphClient('emp', false);
  
  // Check the app's oauth2PermissionGrants
  const clientId = '***REMOVED***';
  
  try {
    const grants = await client.get(`/oauth2PermissionGrants?$filter=clientId eq '${clientId}'`);
    console.log('OAuth grants:', JSON.stringify(grants, null, 2));
  } catch(e) {
    console.log('oauth2 grants error:', e.message);
  }
  
  // Also check if there are any service principals in the tenant
  try {
    const apps = await client.get(`/applicationServicePrincipals?$top=5`);
    console.log('App SPs:', JSON.stringify(apps, null, 2));
  } catch(e) {
    console.log('apps error:', e.message);
  }
}

main().catch(e => console.error(e.message));
