import { GraphClient } from './lib/client.js';

async function main() {
  const client = new GraphClient('emp', false);
  
  // Check what app roles / permissions the current app has in the tenant
  const appId = process.env.MS_GRAPH_CLIENT_ID;
  if (!appId) {
    console.error('ms-graph: missing MS_GRAPH_CLIENT_ID env var');
    process.exit(1);
  }
  
  try {
    // Get the service principal for our app in the tenant
    const r = await client.getRaw(`/servicePrincipals(appId='${appId}')?$select=appRoles,oauth2PermissionGrants`);
    console.log('SP with perms:', r.substring(0, 2000));
  } catch(e) {
    console.log('Error:', e.message);
  }
}

main().catch(e => console.error(e.message));
