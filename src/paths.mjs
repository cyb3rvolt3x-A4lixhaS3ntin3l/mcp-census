import { homedir, platform } from 'node:os';
import { join } from 'node:path';

/** Well-known MCP client config paths (exist-or-skip). */
export function defaultConfigCandidates(home = homedir(), os = platform()) {
  const out = [];
  // Cursor
  out.push(join(home, '.cursor', 'mcp.json'));
  out.push(join(home, '.cursor', 'mcp', 'mcp.json'));
  // Claude Desktop
  if (os === 'darwin') {
    out.push(join(home, 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json'));
  } else if (os === 'win32') {
    out.push(join(home, 'AppData', 'Roaming', 'Claude', 'claude_desktop_config.json'));
  } else {
    out.push(join(home, '.config', 'Claude', 'claude_desktop_config.json'));
  }
  // Continue
  out.push(join(home, '.continue', 'config.json'));
  out.push(join(home, '.continue', 'mcpServers.json'));
  // Generic / project
  out.push(join(process.cwd(), '.cursor', 'mcp.json'));
  out.push(join(process.cwd(), 'mcp.json'));
  return out;
}
