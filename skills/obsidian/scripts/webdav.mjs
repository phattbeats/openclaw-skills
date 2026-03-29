#!/usr/bin/env node
/**
 * WebDAV sync for Obsidian vault
 * Pulls vault from Nextcloud, allows local work, pushes changes back
 */

import { execSync } from 'child_process';
import { createWriteStream, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const CONFIG = {
  url: 'https://nextcloud.phatt.vip/remote.php/dav/files/phatt',
  user: 'phatt',
  pass: 'WzPyR-fLAH2-2fGgk-kQDo3-ToYtr',
  vaultName: 'Rogue State',
  localBase: '/root/.openclaw/workspace/vault-cache'
};

const localVault = join(CONFIG.localBase, CONFIG.vaultName);

function curl(args) {
  const auth = `-u ${CONFIG.user}:${CONFIG.pass}`;
  return execSync(`curl -s ${auth} ${args}`, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
}

async function download() {
  console.log('📥 Downloading vault from Nextcloud...');
  
  mkdirSync(CONFIG.localBase, { recursive: true });
  mkdirSync(localVault, { recursive: true });

  // List files in vault recursively
  const listUrl = `${CONFIG.url}/${encodeURIComponent(CONFIG.vaultName)}`;
  const listXml = curl(`-X PROPFIND "${listUrl}" --header "Depth: infinity"`);

  // Parse file paths from XML - match both <d:href> and plain <href>
  const fileMatches = listXml.matchAll(/<(?:d:)?href>([^<]+)<\/(?:d:)?href>/g);
  const allPaths = [...fileMatches].map(m => decodeURIComponent(m[1]));
  
  // Filter for .md files only
  const mdFiles = allPaths.filter(p => p.endsWith('.md'));
  console.log(`Found ${mdFiles.length} markdown files`);

  let downloaded = 0;
  for (const file of mdFiles) {
    // Extract relative path within vault
    const vaultPrefix = `/remote.php/dav/files/${CONFIG.user}/${CONFIG.vaultName}/`;
    const relPath = file.split(vaultPrefix)[1];
    if (!relPath) continue;

    const localPath = join(localVault, relPath);
    mkdirSync(dirname(localPath), { recursive: true });

    // URL-encode the path for curl
    const fileUrl = `${CONFIG.url}/${encodeURIComponent(CONFIG.vaultName)}/${encodeURIComponent(relPath)}`;
    try {
      execSync(`curl -s -u "${CONFIG.user}:${CONFIG.pass}" -o "${localPath}" "${fileUrl}"`, { stdio: 'pipe' });
      downloaded++;
    } catch (e) {
      console.log(`  Failed: ${relPath}`);
    }
  }

  console.log(`✅ Downloaded ${downloaded} files to: ${localVault}`);
  return localVault;
}

async function upload() {
  console.log('📤 Uploading changes to Nextcloud...');

  if (!existsSync(localVault)) {
    console.log('❌ No local vault found. Run download first.');
    process.exit(1);
  }

  // Find all .md files
  const files = findMarkdown(localVault);
  console.log(`Found ${files.length} local files`);

  let uploaded = 0;
  for (const file of files) {
    const relPath = file.replace(localVault + '/', '');
    const fileUrl = `${CONFIG.url}/${encodeURIComponent(CONFIG.vaultName)}/${relPath}`;
    
    // Create parent directories first
    const parts = relPath.split('/');
    if (parts.length > 1) {
      for (let i = 1; i < parts.length; i++) {
        const dirPath = parts.slice(0, i).join('/');
        const dirUrl = `${CONFIG.url}/${encodeURIComponent(CONFIG.vaultName)}/${dirPath}`;
        curl(`-X MKCOL "${dirUrl}" 2>/dev/null || true`);
      }
    }

    curl(`-T "${file}" "${fileUrl}"`);
    uploaded++;
  }

  console.log(`✅ Uploaded ${uploaded} files`);
}

function findMarkdown(dir) {
  const files = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      files.push(...findMarkdown(full));
    } else if (entry.endsWith('.md')) {
      files.push(full);
    }
  }
  return files;
}

function status() {
  if (existsSync(localVault)) {
    const files = findMarkdown(localVault);
    console.log(`✅ Vault cached at: ${localVault}`);
    console.log(`📝 Note count: ${files.length}`);
  } else {
    console.log('❌ No local vault. Run "download" first.');
  }
}

// CLI
const cmd = process.argv[2] || 'help';

switch (cmd) {
  case 'download':
  case 'pull':
    download();
    break;
  case 'upload':
  case 'push':
    upload();
    break;
  case 'path':
    console.log(localVault);
    break;
  case 'status':
    status();
    break;
  default:
    console.log(`
Usage: webdav.mjs <command>

Commands:
  download, pull   Download vault from Nextcloud
  upload, push     Upload changes to Nextcloud
  path            Print local vault path
  status          Show cache status
`);
}
