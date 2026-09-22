import { spawn } from 'node:child_process';
import { resolve } from 'node:path';

const DEFAULT_TIMEOUT_MS = 8000;

/**
 * Opt-in local stdio MCP tools/list.
 * - Only stdio servers (command + args)
 * - Caller must pass an explicit allowlist of server names
 * - No HTTP/SSE remote transports
 */
export async function listToolsViaStdio(server, options = {}) {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const cwd = options.cwd ?? process.cwd();

  if (!server?.command) {
    throw new Error(`Server "${server?.name}" has no local command (stdio only)`);
  }
  if (server.transport === 'http' || server.url) {
    throw new Error(`Refusing remote/HTTP transport for "${server.name}" (stdio only)`);
  }

  const args = (server.args || []).map((a) =>
    typeof a === 'string' && a.startsWith('./') ? resolve(cwd, a) : a,
  );

  const child = spawn(server.command, args, {
    cwd,
    env: { ...process.env, ...(server.env || {}) },
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  let stderr = '';
  child.stderr.setEncoding('utf8');
  child.stderr.on('data', (d) => {
    stderr += d;
  });

  const pending = new Map();
  let nextId = 1;
  let buf = Buffer.alloc(0);

  function send(msg) {
    const body = Buffer.from(JSON.stringify(msg), 'utf8');
    child.stdin.write(`Content-Length: ${body.length}\r\n\r\n`);
    child.stdin.write(body);
  }

  function request(method, params) {
    const id = nextId++;
    return new Promise((resolvePromise, reject) => {
      pending.set(id, { resolve: resolvePromise, reject });
      send({ jsonrpc: '2.0', id, method, params });
    });
  }

  child.stdout.on('data', (chunk) => {
    buf = Buffer.concat([buf, chunk]);
    while (true) {
      const headerEnd = buf.indexOf('\r\n\r\n');
      if (headerEnd === -1) return;
      const header = buf.slice(0, headerEnd).toString('utf8');
      const m = header.match(/Content-Length:\s*(\d+)/i);
      if (!m) {
        buf = buf.slice(headerEnd + 4);
        continue;
      }
      const len = Number(m[1]);
      const start = headerEnd + 4;
      if (buf.length < start + len) return;
      const json = buf.slice(start, start + len).toString('utf8');
      buf = buf.slice(start + len);
      let msg;
      try {
        msg = JSON.parse(json);
      } catch {
        continue;
      }
      if (msg.id != null && pending.has(msg.id)) {
        const { resolve: res, reject } = pending.get(msg.id);
        pending.delete(msg.id);
        if (msg.error) reject(new Error(msg.error.message || JSON.stringify(msg.error)));
        else res(msg.result);
      }
    }
  });

  const timeout = setTimeout(() => {
    child.kill('SIGTERM');
    for (const { reject } of pending.values()) {
      reject(new Error(`stdio tools/list timed out after ${timeoutMs}ms`));
    }
    pending.clear();
  }, timeoutMs);

  try {
    await request('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'mcp-census', version: '0.1.0' },
    });
    send({ jsonrpc: '2.0', method: 'notifications/initialized' });
    const result = await request('tools/list', {});
    const tools = result?.tools;
    if (!Array.isArray(tools)) {
      throw new Error('tools/list returned no tools array');
    }
    return tools;
  } finally {
    clearTimeout(timeout);
    try {
      child.stdin.end();
    } catch {
      /* ignore */
    }
    child.kill('SIGTERM');
  }
}

export function assertAllowlisted(serverName, allowServers) {
  if (!allowServers?.length) {
    throw new Error('Live stdio requires --allow-server <name> (explicit allowlist)');
  }
  if (allowServers.includes('*')) {
    throw new Error('Wildcard allowlist is not permitted; name each server');
  }
  if (!allowServers.includes(serverName)) {
    throw new Error(`Server "${serverName}" not in --allow-server allowlist`);
  }
}
