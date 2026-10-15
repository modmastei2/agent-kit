// The id of a stance (see hooks/stances.ts).
export type StanceId = string

declare module 'claude-code' {
  interface PluginState {
    'subagent-control': {
      // The stance in force.
      stance: StanceId
      // The chord bound to the cycle action, shown as the band's hint.
      chord: string
    }
  }
}
