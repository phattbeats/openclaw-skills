import { PaperclipClient, COMPANY_ID, AGENT_MAP } from './lib/client.js';

const client = new PaperclipClient();

async function main() {
  const monetId = AGENT_MAP['monet'].id;
  
  // Try different PATCH paths
  const paths = [
    `/api/agents/${monetId}`,
    `/api/agents/${monetId}/adapter-config`,
    `/api/v1/agents/${monetId}`,
    `/api/v1/companies/${COMPANY_ID}/agents/${monetId}`,
  ];
  
  for (const path of paths) {
    try {
      const res = await client.patch<any>(path, {
        adapterConfig: { model: 'litellm/minimax/MiniMax-M2.7' }
      });
      console.log(`PATCH ${path} => SUCCESS:`, JSON.stringify(res).slice(0, 200));
    } catch (e: any) {
      console.log(`PATCH ${path} => ${e.message}`);
    }
  }
  
  // Also try GET all agents to see the full structure
  const data = await client.get<any>(`/api/companies/${COMPANY_ID}/agents`);
  const list = data.agents || data.data || (Array.isArray(data) ? data : []);
  const monet = list.find((a: any) => a.id === monetId);
  console.log('\nMonet adapterConfig keys:', Object.keys(monet?.adapterConfig || {}));
  console.log('Monet adapterConfig.model:', monet?.adapterConfig?.model);
}

main().catch(console.error);
