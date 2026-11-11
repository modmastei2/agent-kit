declare module 'claude-code' {
  interface PluginState {
    'subagent-control': {
      // The model every subagent runs on; '' is Auto.
      model: string
      // The effort every subagent thinks with; '' is Auto.
      effort: string
      // The chord bound to the model button, shown as the band's hint.
      chord: string
    }
  }
}

export {}
