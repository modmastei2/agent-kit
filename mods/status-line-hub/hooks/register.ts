import type { Register } from 'claude-code'

// The hub draws through the `statusLine` setting, which a plugin cannot set for
// the person; this hook only says how when it is not pointed at the hub yet.
export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const result = await next(e)

    const { statusLine } = await $.settings.read()
    const command =
      statusLine !== null && typeof statusLine === 'object' && 'command' in statusLine
        ? String(statusLine.command)
        : ''

    if (!command.includes('status-line-hub')) {
      const hub = `${$.plugin.root.replaceAll('\\', '/')}/scripts/hub.mjs`
      $.ui.toast(
        `status-line-hub is installed but not in use. Add to ~/.claude/settings.json: ` +
          `"statusLine": { "type": "command", "command": "node \\"${hub}\\"" }`,
        { timeoutMs: 15000 },
      )
    }

    return result
  })
}
