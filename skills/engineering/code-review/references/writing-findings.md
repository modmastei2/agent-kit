# Writing findings

## Lead with the consequence

The reader wants **what breaks → why it matters → how to fix it**. How you proved it
comes last, or not at all. Never open a finding with your investigation method.

Hard limits — a finding that exceeds them is not more thorough, it is unread:

| Field | Limit | Contains |
| --- | --- | --- |
| `title` | one line | the defect as a noun phrase |
| `message` | **≤2 sentences** | what is wrong. Not how you found out. |
| `impact` | **≤2 sentences** | the concrete consequence if it ships |
| `suggestion` | **≤3 sentences** | the fix, specific enough to act on |
| `evidence` | **≤2 sentences**, optional | the proof, only when non-obvious |
| `patch` | **no prose cap**, optional | before/after code for the fix |

The script also enforces character caps, adjusted for the writing system — see
[report-language.md](report-language.md#length-caps).

Verification discipline is unchanged — keep verifying exactly as thoroughly. `evidence`
exists so the proof stays available without crowding out the point. Use it only when
the reader would otherwise doubt the claim (a non-obvious command, a byte-level check, a
count across many files). If the cited line speaks for itself, omit it.

Do not list every file you inspected. Name one or two representative ones and give the
count: "every source file at the base commit is CRLF (checked all 120)".

Bad — buries the point under methodology:

> Verified against raw blob bytes with `git cat-file blob` (not `git show`, which can
> apply EOL conversion): every pre-existing source file at the base commit is 100%
> CRLF (`OrderService.cs` 240/240, `PricingCalculator.cs` 360/360,
> `ConfigLoader.cs` 26/26), and the files this PR adds are also committed CRLF, and
> there is no `.gitattributes`, so the rule is violated by the very commit that
> introduces it, and …

Good — same facts, ordered for the reader:

> **message:** This PR adds `.editorconfig` with `end_of_line = lf`, but the whole
> repository is committed CRLF and there is no `.gitattributes` to normalize it.
> **impact:** The first `dotnet format` run rewrites every file, producing whole-file
> diffs unrelated to the change and destroying `git blame` attribution.
> **suggestion:** Either add `.gitattributes` (`* text=auto eol=lf`) and normalize in
> one isolated commit, or set `end_of_line = crlf` to match reality — the lower-risk
> option if there is no active move to LF.
> **evidence:** Checked with `git cat-file blob` rather than `git show`, which converts
> EOL; every file at the base commit and every file this PR adds is CRLF.

## Show the fix as code

`suggestion` says what to do; `patch` shows it. Include a patch whenever the remediation
is a concrete code edit — a reviewer should be able to apply it without reconstructing
it from a description. Omit it when the fix is structural (move this into a shared
service) or a judgement call, where invented code would be worse than none.

```json
"patch": [
  { "file": "src/BatchEditService.cs", "line": 491,
    "before": "var path = Path.Combine(root, param.PathName, param.UploadFile);",
    "after":  "var path = BuildLocalTempFilePath(param.PathName, param.UploadFile);" }
]
```

- One entry per edit site, up to 5. A fix touching more shows one or two representative
  sites and describes the rest.
- `before` is **verbatim from the file**, never paraphrased, or the reader cannot match
  it; omit it for a pure addition. `after` is real code, never a description of code.
- No prose cap, but at most 800 characters per side: the lines that change plus the
  minimum context to locate them, not whole files.
- **Code is never translated.** Comments and identifiers appear exactly as they are, or
  would be, in the file. `note` is prose and follows the report language.

## Record what you dismissed

Anything you examined and decided **not** to report — a pattern that looks wrong but is
deliberate, a risk that turned out to be handled — goes in `dismissed` with the reason,
not in `limitations` prose:

```json
{ "category": "testing", "file": "tests/OrderMappingTests.cs",
  "why": "characterization tests; inline comments and a docs/ writeup make the intent explicit" }
```

A caller that tracks review rounds (such as `review-pr`) carries these forward and
refuses a later review that reports one of them without explanation. Skipping this
field is how a follow-up review ends up silently contradicting its own earlier
conclusion.
