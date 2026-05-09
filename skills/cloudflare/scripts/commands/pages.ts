import { Command } from 'commander';
import { cf, ACCOUNT_ID } from '../lib/client.js';
import { run, table, outputOk, outputErr, isJsonMode } from '../lib/envelope.js';
import { readdir, readFile } from 'fs/promises';
import { join, relative } from 'path';

interface PagesProject {
  name: string;
  subdomain: string;
  domains: string[];
  source?: { type: string; config?: { repo_name?: string } };
  latest_deployment?: { id: string; url: string; created_on: string; environment: string };
  created_on: string;
}

interface PagesDomain {
  name: string;
  status: string;
  created_on: string;
}

interface PagesDeployment {
  id: string;
  url: string;
  environment: string;
  created_on: string;
  latest_stage: { name: string; status: string };
}

async function getAllFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const e of entries) {
    const full = join(dir, e.name);
    if (e.isDirectory()) {
      files.push(...(await getAllFiles(full)));
    } else {
      files.push(full);
    }
  }
  return files;
}

export function registerPages(program: Command) {
  const pages = program.command('pages').description('Manage Cloudflare Pages projects');

  pages
    .command('list')
    .description('List all Pages projects')
    .option('--json', 'Output JSON envelope')
    .action(async (opts) => {
      if (opts.json) (await import('../lib/envelope.js')).setJsonMode(true);
      await run('pages list', async () => {
        const res = await cf.get<PagesProject[]>(`/accounts/${ACCOUNT_ID}/pages/projects`);
        if (isJsonMode()) {
          outputOk(res.result, res.result.length);
        } else {
          table(
            res.result.map((p) => ({
              Name: p.name,
              Subdomain: p.subdomain,
              Domains: (p.domains ?? []).join(', ') || '–',
              'Latest Deploy': p.latest_deployment?.created_on?.slice(0, 10) ?? '–',
            }))
          );
        }
      });
    });

  pages
    .command('get <project-name>')
    .description('Get a Pages project by name')
    .option('--json', 'Output JSON envelope')
    .action(async (name, opts) => {
      if (opts.json) (await import('../lib/envelope.js')).setJsonMode(true);
      await run('pages get', async () => {
        const res = await cf.get<PagesProject>(`/accounts/${ACCOUNT_ID}/pages/projects/${name}`);
        const p = res.result;
        if (isJsonMode()) {
          outputOk(p);
        } else {
          console.log(`Name:       ${p.name}`);
          console.log(`Subdomain:  ${p.subdomain}`);
          console.log(`Domains:    ${(p.domains ?? []).join(', ') || '–'}`);
          console.log(`Created:    ${p.created_on}`);
          if (p.latest_deployment) {
            console.log(`\nLatest Deployment:`);
            console.log(`  ID:  ${p.latest_deployment.id}`);
            console.log(`  URL: ${p.latest_deployment.url}`);
            console.log(`  Env: ${p.latest_deployment.environment}`);
            console.log(`  At:  ${p.latest_deployment.created_on}`);
          }
        }
      });
    });

  // pages domains subcommand
  const domains = pages.command('domains <project-name>').description('Manage custom domains');

  // List domains (default action)
  domains
    .argument('[project-name]')
    .option('--json', 'Output JSON envelope')
    .action(async (projectName, opts) => {
      if (opts.json) (await import('../lib/envelope.js')).setJsonMode(true);
      await run('pages domains', async () => {
        const res = await cf.get<PagesDomain[]>(
          `/accounts/${ACCOUNT_ID}/pages/projects/${projectName}/domains`
        );
        if (isJsonMode()) {
          outputOk(res.result, res.result.length);
        } else {
          table(
            res.result.map((d) => ({
              Domain: d.name,
              Status: d.status,
              Created: d.created_on?.slice(0, 10) ?? '–',
            }))
          );
        }
      });
    });

  pages
    .command('domains-add <project-name> <domain>')
    .description('Add a custom domain to a Pages project')
    .option('--json', 'Output JSON envelope')
    .action(async (projectName, domain, opts) => {
      if (opts.json) (await import('../lib/envelope.js')).setJsonMode(true);
      await run('pages domains add', async () => {
        const res = await cf.post<PagesDomain>(
          `/accounts/${ACCOUNT_ID}/pages/projects/${projectName}/domains`,
          { name: domain }
        );
        if (isJsonMode()) {
          outputOk(res.result);
        } else {
          console.log(`Added domain: ${res.result.name} (status: ${res.result.status})`);
        }
      });
    });

  pages
    .command('domains-remove <project-name> <domain>')
    .description('Remove a custom domain from a Pages project')
    .option('--json', 'Output JSON envelope')
    .action(async (projectName, domain, opts) => {
      if (opts.json) (await import('../lib/envelope.js')).setJsonMode(true);
      await run('pages domains remove', async () => {
        await cf.delete(`/accounts/${ACCOUNT_ID}/pages/projects/${projectName}/domains/${domain}`);
        if (isJsonMode()) {
          outputOk({ removed: domain });
        } else {
          console.log(`Removed domain: ${domain}`);
        }
      });
    });

  pages
    .command('deployments <project-name>')
    .description('List recent deployments for a Pages project')
    .option('--top <n>', 'Number of deployments to show', '5')
    .option('--json', 'Output JSON envelope')
    .action(async (projectName, opts) => {
      if (opts.json) (await import('../lib/envelope.js')).setJsonMode(true);
      await run('pages deployments', async () => {
        const res = await cf.get<PagesDeployment[]>(
          `/accounts/${ACCOUNT_ID}/pages/projects/${projectName}/deployments`
        );
        const top = res.result.slice(0, parseInt(opts.top, 10));
        if (isJsonMode()) {
          outputOk(top, top.length);
        } else {
          table(
            top.map((d) => ({
              ID: d.id.slice(0, 8) + '…',
              URL: d.url,
              Env: d.environment,
              Stage: d.latest_stage?.name ?? '–',
              Status: d.latest_stage?.status ?? '–',
              Created: d.created_on?.slice(0, 16) ?? '–',
            }))
          );
        }
      });
    });

  pages
    .command('deploy <project-name> <dir>')
    .description('Deploy a directory to a Pages project (Direct Upload)')
    .option('--json', 'Output JSON envelope')
    .action(async (projectName, dir, opts) => {
      if (opts.json) (await import('../lib/envelope.js')).setJsonMode(true);
      await run('pages deploy', async () => {
        // Step 1: Build manifest + upload session
        const files = await getAllFiles(dir);
        if (!files.length) {
          outputErr('No files found in directory', 'Ensure the directory is not empty');
          return;
        }

        const manifest: Record<string, { digest: string; size: number }> = {};
        for (const filePath of files) {
          const relPath = relative(dir, filePath);
          const content = await readFile(filePath);
          const buf = Buffer.from(content);
          const { createHash } = await import('crypto');
          const digest = 'sha256:' + createHash('sha256').update(buf).digest('hex');
          manifest[relPath] = { digest, size: buf.length };
        }

        const manifestStr = JSON.stringify(manifest);
        const sessionForm = new FormData();
        sessionForm.append('manifest', manifestStr);
        const session = await cf.postForm<{ id: string }>(
          `/accounts/${ACCOUNT_ID}/pages/projects/${projectName}/deployments`,
          sessionForm
        );

        const deploymentId = session.result?.id;
        if (!deploymentId) throw new Error('No deployment ID returned from session creation');

        // Step 2: Upload files as multipart
        const form = new FormData();
        for (const filePath of files) {
          const relPath = relative(dir, filePath);
          const content = await readFile(filePath);
          const blob = new Blob([content]);
          form.append('files', blob, relPath);
        }

        const uploaded = await cf.postForm<PagesDeployment>(
          `/accounts/${ACCOUNT_ID}/pages/projects/${projectName}/deployments/${deploymentId}/upload`,
          form
        );

        if (isJsonMode()) {
          outputOk(uploaded.result);
        } else {
          console.log(`Deployed ${files.length} file(s) to: ${uploaded.result?.url ?? '(pending)'}`);
          console.log(`Deployment ID: ${deploymentId}`);
        }
      });
    });
}
