import { PaperclipClient, COMPANY_ID, AGENT_MAP } from './lib/client.js';

const client = new PaperclipClient();

async function main() {
  const monetId = AGENT_MAP['monet'].id;
  console.log('Monet ID:', monetId);
  
  // First, get the current agent data
  const data = await client.get<any>(`/api/companies/${COMPANY_ID}/agents`);
  const list = data.agents || data.data || (Array.isArray(data) ? data : []);
  const monet = list.find((a: any) => a.id === monetId);
  
  if (monet) {
    console.log('Current adapterConfig:', JSON.stringify(monet.adapterConfig, null, 2));
  }
  
  // Try to update the model
  try {
    const result = await client.patch<any>(
      `/api/companies/${COMPANY_ID}/agents/${monetId}`,
      {
        adapterConfig: {
          model: 'litellm/minimax/MiniMax-M2.7'
        }
      }
    );
    console.log('Update result:', JSON.stringify(result, null, 2));
  } catch (e: any) {
    console.log('Update error:', e.message);
  }
}

main().catch(console.error);
