#!/usr/bin/env node
const crypto = require('crypto');
const https = require('https');
const { Command } = require('commander');
const { webcrypto } = crypto; // Node 15+ has webcrypto
const { subtle } = webcrypto; // Export for reuse

const isAgent = !process.stdout.isTTY;

function base64url(buf) {
  return buf.toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function detectKeyType(privateKey) {
  if (privateKey.includes('BEGIN EC PRIVATE KEY')) return 'sec1';
  if (privateKey.includes('BEGIN PRIVATE KEY')) return 'pkcs8';
  if (privateKey.includes('BEGIN RSA PRIVATE KEY')) return 'pkcs1';
  return 'pkcs8';
}

function createJwt(issuerId, keyId, privateKey) {
  const header = { alg: 'ES256', kid: keyId, typ: 'JWT' };
  const payload = {
    iss: issuerId,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600,
    aud: 'https://api-business.apple.com'
  };
  const enc = obj => base64url(Buffer.from(JSON.stringify(obj), 'utf8'));
  const b64Header = enc(header);
  const b64Payload = enc(payload);
  const signingInput = `${b64Header}.${b64Payload}`;
  const sign = crypto.createSign('SHA256');
  sign.update(signingInput);
  const keyType = detectKeyType(privateKey);
  const pk = crypto.createPrivateKey({ key: privateKey, format: 'pem', type: keyType });
  const sig = sign.sign(pk, 'base64');
  const b64Sig = base64url(Buffer.from(sig, 'base64'));
  return `${signingInput}.${b64Sig}`;
}

function getConfig() {
  const issuerId = process.env.ABM_ISSUER_ID;
  const keyId = process.env.ABM_KEY_ID;
  const privateKey = process.env.ABM_PRIVATE_KEY;
  if (!issuerId || !keyId || !privateKey) {
    return null;
  }
  return { issuerId, keyId, privateKey };
}

function request(method, path, body = null) {
  const config = getConfig();
  const jwt = createJwt(config.issuerId, config.keyId, config.privateKey);
  const url = new URL('https://api-business.apple.com/v1' + path);
  return new Promise((resolve, reject) => {
    const req = https.request(url, {
      method,
      headers: {
        'Authorization': `Bearer ${jwt}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve({ status: res.statusCode, body: json });
        } catch (e) {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

function truncateResult(items, maxItems = 100) {
  if (items.length <= maxItems) return { items, count: items.length, truncated: false };
  const tmpPath = `/tmp/abm-results-${Date.now()}.json`;
  require('fs').writeFileSync(tmpPath, JSON.stringify(items, null, 2));
  return { items: items.slice(0, maxItems), count: items.length, truncated: true, full_results: tmpPath };
}

function success(command, result, next_actions = []) {
  return { ok: true, command, result, next_actions };
}

function error(command, message, code, fix, next_actions = []) {
  return { ok: false, command, error: { message, code }, fix, next_actions };
}

function exitWithEnvelope(env) {
  console.log(JSON.stringify(env));
  process.exit(env.ok ? 0 : 1);
}

const program = new Command();

program
  .name('abm')
  .description('Apple Business Manager CLI')
  .version('1.0.0');

if (process.argv.length === 2) {
  const commands = [
    { command: 'abm mdm-servers list', description: 'List MDM servers' },
    { command: 'abm mdm-servers get <id>', description: 'Get MDM server details' },
    { command: 'abm devices list', description: 'List devices' },
    { command: 'abm devices get <serial>', description: 'Get device details' },
    { command: 'abm devices assign --serial <serial> --mdm-server-id <id>', description: 'Assign device to MDM server' },
    { command: 'abm devices release --serial <serial>', description: 'Release device from MDM server' },
    { command: 'abm users list', description: 'List users' },
    { command: 'abm users get <user-id>', description: 'Get user details' },
    { command: 'abm users create --email <email> --first <first> --last <last>', description: 'Create Managed Apple ID' },
    { command: 'abm users deactivate <user-id>', description: 'Deactivate user' },
    { command: 'abm structure-classes list', description: 'List structure classes' }
  ];
  if (isAgent) {
    const commandList = commands.map(c => ({ command: c.command, description: c.description }));
    const ok = success('abm', { description: 'Apple Business Manager CLI', version: '1.0.0', commands: commands }, commandList);
    console.log(JSON.stringify(ok));
  } else {
    console.log(`Apple Business Manager CLI v1.0.0

Commands:
${commands.map(c => '  ' + c.command.padEnd(70) + ' ' + c.description).join('\n')}

Environment:
  ABM_ISSUER_ID       Issuer ID from ABM API credentials
  ABM_KEY_ID          Key ID from ABM
  ABM_PRIVATE_KEY     EC private key (PEM format)

Examples:
  abm mdm-servers list
  abm devices list --status enrolled
  abm devices assign --serial C02XXXXXX --mdm-server-id ms-123456
  abm users create --email john@company.com --first John --last Smith
`);
  }
  process.exit(0);
}

// Explicit parent commands to avoid duplicate registration
const mdmCmd = program.command('mdm-servers').description('Manage MDM servers');
mdmCmd
  .command('list')
  .description('List all MDM servers')
  .action(async () => {
    if (!getConfig()) {
      exitWithEnvelope(error('abm mdm-servers list', 'ABM_ISSUER_ID, ABM_KEY_ID, ABM_PRIVATE_KEY must be set', 'MISSING_ENV', 'Set all three ABM_* environment variables.'));
    }
    try {
      const res = await request('GET', '/mdmservers');
      const servers = (res.body && res.body.data) || [];
      const truncated = truncateResult(servers, 100);
      exitWithEnvelope(success('abm mdm-servers list', {
        mdm_servers: truncated.items,
        count: truncated.count,
        truncated: truncated.truncated,
        ...(truncated.full_results ? { full_results: truncated.full_results } : {})
      }, [
        { command: 'abm mdm-servers get <id>', description: 'View MDM server details' }
      ]));
    } catch (e) {
      exitWithEnvelope(error('abm mdm-servers list', e.message || String(e), 'REQUEST_FAILED', 'Verify network access to api-business.apple.com.'));
    }
  });

mdmCmd
  .command('get <id>')
  .description('Get MDM server details')
  .action(async (id) => {
    try {
      const res = await request('GET', '/mdmservers/' + encodeURIComponent(id));
      if (res.status !== 200) {
        exitWithEnvelope(error('abm mdm-servers get', `API returned ${res.status}`, 'API_ERROR', 'Check server ID.', []));
      }
      exitWithEnvelope(success('abm mdm-servers get', { server: res.body?.data }, [
        { command: 'abm devices list', description: 'List devices' },
        { command: 'abm devices assign --serial <serial> --mdm-server-id ' + id, description: 'Assign device to this server' }
      ]));
    } catch (e) {
      exitWithEnvelope(error('abm mdm-servers get', e.message || String(e), 'REQUEST_FAILED', 'Verify network and server ID.'));
    }
  });

const devicesCmd = program.command('devices').description('Manage devices');

devicesCmd
  .command('list')
  .description('List devices')
  .option('--serial <serial>', 'Filter by serial number')
  .option('--status <status>', 'Filter by status (purchased, enrolled, retired)')
  .option('--limit <n>', 'Max results', '100')
  .action(async (options) => {
    if (!getConfig()) {
      exitWithEnvelope(error('abm devices list', 'ABM_ISSUER_ID, ABM_KEY_ID, ABM_PRIVATE_KEY must be set', 'MISSING_ENV', 'Set all three ABM_* environment variables.'));
    }
    try {
      const params = new URLSearchParams();
      if (options.serial) params.append('filter[serial]', options.serial);
      if (options.status) params.append('filter[status]', options.status);
      params.append('limit', options.limit);
      const query = params.toString() ? '?' + params : '';
      const res = await request('GET', '/devices' + query);
      if (res.status !== 200) {
        exitWithEnvelope(error('abm devices list', `API returned ${res.status}`, 'API_ERROR', 'Check filters and credentials.', []));
      }
      const devices = res.body?.data || [];
      const truncated = truncateResult(devices, 100);
      const nextCursor = res.body?.pagination?.next;
      exitWithEnvelope(success('abm devices list', {
        devices: truncated.items,
        count: truncated.count,
        truncated: truncated.truncated,
        ...(truncated.full_results ? { full_results: truncated.full_results } : {}),
        ...(nextCursor ? { next_cursor: nextCursor } : {})
      }, [
        { command: 'abm devices get <serial>', description: 'View device details' },
        { command: 'abm devices assign --serial <serial> --mdm-server-id <id>', description: 'Assign device to MDM server' }
      ]));
    } catch (e) {
      exitWithEnvelope(error('abm devices list', e.message || String(e), 'REQUEST_FAILED', 'Verify network access.'));
    }
  });

devicesCmd
  .command('get <serial>')
  .description('Get device details')
  .action(async (serial) => {
    try {
      const res = await request('GET', '/devices/' + encodeURIComponent(serial));
      if (res.status !== 200) {
        exitWithEnvelope(error('abm devices get', `API returned ${res.status}`, 'API_ERROR', 'Verify serial number.', []));
      }
      exitWithEnvelope(success('abm devices get', { device: res.body?.data }, [
        { command: 'abm devices assign --serial ' + serial + ' --mdm-server-id <id>', description: 'Assign this device' }
      ]));
    } catch (e) {
      exitWithEnvelope(error('abm devices get', e.message || String(e), 'REQUEST_FAILED', 'Check serial format.'));
    }
  });

devicesCmd
  .command('assign')
  .requiredOption('--serial <serial>', 'Device serial number')
  .requiredOption('--mdm-server-id <id>', 'MDM server ID')
  .description('Assign device to MDM server')
  .action(async (options) => {
    if (!getConfig()) {
      exitWithEnvelope(error('abm devices assign', 'ABM_ISSUER_ID, ABM_KEY_ID, ABM_PRIVATE_KEY must be set', 'MISSING_ENV', 'Set all three ABM_* environment variables.'));
    }
    try {
      const res = await request('POST', '/devices/' + encodeURIComponent(options.serial) + '/mdm', { mdmServerId: options.mdmServerId });
      if (res.status !== 200) {
        const errMsg = res.body && res.body.error ? res.body.error : `API returned ${res.status}`;
        exitWithEnvelope(error('abm devices assign', errMsg, 'ASSIGN_FAILED', 'Verify serial and MDM server ID.', [
          { command: 'abm mdm-servers list', description: 'List available MDM servers' }
        ]));
      }
      exitWithEnvelope(success('abm devices assign', {
        assigned: { serial: options.serial, mdm_server_id: options.mdmServerId },
        message: 'Device assigned to MDM server'
      }, [
        { command: 'abm devices get ' + options.serial, description: 'Verify assignment' }
      ]));
    } catch (e) {
      exitWithEnvelope(error('abm devices assign', e.message || String(e), 'REQUEST_FAILED', 'Verify network access.'));
    }
  });

devicesCmd
  .command('release')
  .requiredOption('--serial <serial>', 'Device serial number')
  .description('Release device from MDM server')
  .action(async (options) => {
    if (!getConfig()) {
      exitWithEnvelope(error('abm devices release', 'ABM_ISSUER_ID, ABM_KEY_ID, ABM_PRIVATE_KEY must be set', 'MISSING_ENV', 'Set all three ABM_* environment variables.'));
    }
    try {
      const res = await request('DELETE', '/devices/' + encodeURIComponent(options.serial) + '/mdm');
      if (res.status !== 204 && res.status !== 200) {
        exitWithEnvelope(error('abm devices release', `API returned ${res.status}`, 'RELEASE_FAILED', 'Verify serial number.', []));
      }
      exitWithEnvelope(success('abm devices release', {
        released: { serial: options.serial },
        message: 'Device released from MDM server'
      }, [
        { command: 'abm devices get ' + options.serial, description: 'Verify release' }
      ]));
    } catch (e) {
      exitWithEnvelope(error('abm devices release', e.message || String(e), 'REQUEST_FAILED', 'Check network access.'));
    }
  });

const usersCmd = program.command('users').description('Manage users');

usersCmd
  .command('list')
  .description('List users')
  .option('--email <email>', 'Filter by email')
  .option('--limit <n>', 'Max results', '100')
  .action(async (options) => {
    if (!getConfig()) {
      exitWithEnvelope(error('abm users list', 'ABM_ISSUER_ID, ABM_KEY_ID, ABM_PRIVATE_KEY must be set', 'MISSING_ENV', 'Set all three ABM_* environment variables.'));
    }
    try {
      const params = new URLSearchParams();
      if (options.email) params.append('filter[username]', options.email);
      params.append('limit', options.limit);
      const query = params.toString() ? '?' + params : '';
      const res = await request('GET', '/users' + query);
      if (res.status !== 200) {
        exitWithEnvelope(error('abm users list', `API returned ${res.status}`, 'API_ERROR', 'Check credentials.', []));
      }
      const users = res.body?.data || [];
      const truncated = truncateResult(users, 100);
      const nextCursor = res.body?.pagination?.next;
      exitWithEnvelope(success('abm users list', {
        users: truncated.items,
        count: truncated.count,
        truncated: truncated.truncated,
        ...(truncated.full_results ? { full_results: truncated.full_results } : {}),
        ...(nextCursor ? { next_cursor: nextCursor } : {})
      }, [
        { command: 'abm users get <user-id>', description: 'View user details' },
        { command: 'abm users create --email <email> --first <first> --last <last>', description: 'Create a new user' }
      ]));
    } catch (e) {
      exitWithEnvelope(error('abm users list', e.message || String(e), 'REQUEST_FAILED', 'Verify network access.'));
    }
  });

usersCmd
  .command('get <user-id>')
  .description('Get user details')
  .action(async (userId) => {
    try {
      const res = await request('GET', '/users/' + encodeURIComponent(userId));
      if (res.status !== 200) {
        exitWithEnvelope(error('abm users get', `API returned ${res.status}`, 'API_ERROR', 'Verify user ID.', []));
      }
      exitWithEnvelope(success('abm users get', { user: res.body?.data }, [
        { command: 'abm users deactivate ' + userId, description: 'Deactivate this user' }
      ]));
    } catch (e) {
      exitWithEnvelope(error('abm users get', e.message || String(e), 'REQUEST_FAILED', 'Check user ID format.'));
    }
  });

usersCmd
  .command('create')
  .requiredOption('--email <email>', 'Email address (must be on verified domain)')
  .requiredOption('--first <first>', 'First name')
  .requiredOption('--last <last>', 'Last name')
  .description('Create Managed Apple ID')
  .action(async (options) => {
    if (!getConfig()) {
      exitWithEnvelope(error('abm users create', 'ABM_ISSUER_ID, ABM_KEY_ID, ABM_PRIVATE_KEY must be set', 'MISSING_ENV', 'Set all three ABM_* environment variables.'));
    }
    try {
      const res = await request('POST', '/users', {
        username: options.email,
        name: { first: options.first, last: options.last }
      });
      if (res.status !== 201 && res.status !== 200) {
        const errMsg = res.body && res.body.error ? res.body.error : `API returned ${res.status}`;
        exitWithEnvelope(error('abm users create', errMsg, 'CREATE_FAILED', 'Verify email is on a verified ABM domain.', [
          { command: 'abm users list', description: 'List users to check domain setup' }
        ]));
      }
      exitWithEnvelope(success('abm users create', {
        user: res.body?.data,
        message: 'User created. They must accept the invitation email.'
      }, [
        { command: 'abm users get <user-id>', description: 'View new user details' }
      ]));
    } catch (e) {
      exitWithEnvelope(error('abm users create', e.message || String(e), 'REQUEST_FAILED', 'Check network access and email domain.'));
    }
  });

usersCmd
  .command('deactivate <user-id>')
  .description('Deactivate a user')
  .action(async (userId) => {
    try {
      const res = await request('DELETE', '/users/' + encodeURIComponent(userId));
      if (res.status !== 204 && res.status !== 200) {
        exitWithEnvelope(error('abm users deactivate', `API returned ${res.status}`, 'DEACTIVATE_FAILED', 'Verify user ID.', []));
      }
      exitWithEnvelope(success('abm users deactivate', {
        deactivated: { user_id: userId },
        message: 'User deactivated'
      }, [
        { command: 'abm users list', description: 'Verify user is no longer active' }
      ]));
    } catch (e) {
      exitWithEnvelope(error('abm users deactivate', e.message || String(e), 'REQUEST_FAILED', 'Check network access.'));
    }
  });

// Structure Classes
program
  .command('structure-classes list')
  .description('List structure classes')
  .action(async () => {
    if (!getConfig()) {
      exitWithEnvelope(error('abm structure-classes list', 'ABM_ISSUER_ID, ABM_KEY_ID, ABM_PRIVATE_KEY must be set', 'MISSING_ENV', 'Set all three ABM_* environment variables.'));
    }
    try {
      const res = await request('GET', '/structure-classes');
      if (res.status !== 200) {
        exitWithEnvelope(error('abm structure-classes list', `API returned ${res.status}`, 'API_ERROR', 'Check credentials.'));
      }
      exitWithEnvelope(success('abm structure-classes list', { classes: res.body?.data || [] }, []));
    } catch (e) {
      exitWithEnvelope(error('abm structure-classes list', e.message || String(e), 'REQUEST_FAILED', 'Verify network access.'));
    }
  });

program.parse(process.argv);
