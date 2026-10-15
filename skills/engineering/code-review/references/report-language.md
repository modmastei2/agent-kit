# Report language

The Markdown report is written in the caller's language. Resolve it in this order and
record it in `reportLanguage` as a language tag (`en`, `th`, `ja`, `pt-BR`, …):

1. `--lang <tag>` was passed → use it.
2. `--input` supplies `reportLanguage` → use it. **Never prompt in an orchestrated run.**
3. The user asked for a language → use it.
4. Otherwise → the language the user is writing in. Ask only when that is genuinely
   unclear, and fold the question into any target clarification so there is one
   interruption.

## What changes and what does not

Only prose follows the language: `summary`, `title`, `message`, `impact`,
`suggestion`, `evidence`, patch `note`, `limitations`, check `details`. Write it the way
a native engineer would, not as a literal translation — keep technical terms (null,
deadlock, migration, race condition) in English where that is how practitioners say
them.

These never change:

- **The JSON contract.** `verdict`, `severity`, `category`, `status` and every other
  enum stay exactly as the schema defines them.
- **Verbatim material.** Identifiers, file paths, commands, log excerpts, quoted code
  and patches. Rule citations keep the source's own wording (`AGENTS.md#layering`).
- **Headings, field labels and status values.** The report title, `Verdict`,
  `Reviewed range`, `Scope`, `Blocking`, `Warnings`, `Suggestions`, `Checks`,
  `Limitations`, `Recommended change`, `Evidence`, `Changes required`, `Passed`,
  `Failed`. These are the terms provider UIs show and teams say out loud; translating
  them would give one thing two names.
- **Script diagnostics.** Validation and argument errors are English — they are
  addressed to the agent fixing the draft, not to the reader.

## Renderer sentences

The renderer writes a few sentences itself (the scope line, "pre-existing", the
disclaimer, …). They live as `{placeholder}` templates in `assets/locales/<tag>.json`,
with `en.json` as the reference set of keys. A tag matches its exact file first, then
its primary subtag (`pt-BR` → `pt`).

When the language has **no bundled locale**, add `reportStrings` to the draft: the
same keys as `en.json`, values translated, placeholders kept. The script refuses a
draft that leaves any key untranslated, so a report never comes out half in English.
For a bundled language `reportStrings` is optional and overrides individual keys.

## Length caps

Caps depend on how the text is written, detected from the text itself — not on the
language tag. Scripts written without inter-word spaces (Thai, Lao, Khmer, Myanmar,
Chinese, Japanese) carry more per character, so their caps are about 60% of the
space-separated ones, and sentence counts are not enforced for them.
