# Submission

## What did you investigate first, and why?

I asked Claude Code to read the repository and list the problems with
file:line, an example input that breaks each one, and why it matters, ranked
by severity. I had limited time, so I wanted the most serious issues first.
The ranking put security first, then reliability, then tests.

Before relying on the list, I checked the first finding myself: in
`src/mcp-server.ts` the schema declares `repo_path` (line 13) but the handler
read `input.repoPath` (line 19).

From that list I picked MCP safety (#1–3) first, then validation results
(#4–6).


Where possible, I reproduced a bug in my own terminal before fixing it
(the MCP shell command and `--validate "exit 1"`), and ran the same
command again after the fix to confirm it was gone.

## What did you choose to implement or fix?

One commit per step. Each code fix started with a test that failed on the
old code (the CI fix was a config change, verified by CI itself).

1. **MCP reviewed the wrong repository** (`ea725ee`). The handler read
   `repoPath` while the schema sends `repo_path`, so the report said
   `Review Report: undefined`. I removed `input: any` and typed the input
   from the schema, so TypeScript now catches this kind of mismatch.
2. **Git option injection through `baseRef`** (`01393b2`). A base ref like
   `--output=X` made git write a file, from both the CLI and MCP. The ref is
   now resolved with `git rev-parse --verify --end-of-options`, and only the
   resulting commit SHA is passed to `git diff`.
3. **CI fix** (`77cbe13`). Added `vitest.config.ts` so only
   `test/**/*.test.ts` runs. See "Blocker" below.
4. **MCP could run any shell command** (`abf9835`). Validation commands are
   now off by default on MCP. The person starting the server can allow
   specific commands with an exact-match allowlist in
   `INSPECTOR_MCP_ALLOWED_VALIDATIONS` (new `src/validation-policy.ts`). The
   CLI is unchanged. The README and the MCP tool description warn that the
   CLI runs any `--validate` command as given.
5. **Failing validations crashed the review** (`2bf2f24`). A failing command
   is now a `failed` result and later commands still run. Each command has a
   120 s timeout that kills its whole process group. Output is capped at
   16 KiB, keeping the start and end. The CLI exits 1 if any validation
   failed.
6. **MCP timeout vs. client timeout** (`7ae979f`). MCP now has a 50 s
   total budget for all commands in one call. The CLI keeps 120 s per command.
   The README has a short table comparing CLI and MCP behavior.

## What did you intentionally not do?

- I did not fix the git diff parsing: renames, unusual filenames, and
  uncommitted or untracked changes.
- I did not implement `--format json`. It is still accepted and ignored.
- I did not fix the broken `bin` path (`dist/cli.js` vs. `dist/src/cli.js`).
- I did not escape Markdown in the report.
- I did not change anything in `.github/`.
- I did not run `npm audit fix --force`, because it applies breaking
  upgrades.

## Interface decision

- Decision: hybrid. Both interfaces stay, on one shared core, with different
  trust policies.
- Primary user and execution environment: Developers running it locally or in CI, and AI coding agents (such as Claude Code) calling it through MCP on a developer’s machine
- Trust boundary and allowed capabilities: The CLI runs any `--validate`
  command as given. MCP callers are AI models that can be steered by content
  in the repository they review, so on MCP no validation command runs unless
  the person starting the server allowlists it by exact match. Agents can
  also run the CLI through a shell, and that path is not covered by the
  allowlist, so this risk is documented in the README and in the MCP tool
  description.
- Reliability, discoverability, latency/context, and output tradeoffs:
  - Output is capped at 16 KiB per command (start and end kept) so a large
    log does not flood an agent's context.
  - MCP has a 50 s total budget because the TypeScript MCP SDK client gives
    up on a request after 60 s by default. Other clients may differ.
  - The MCP tool description lists the allowed commands, so an agent does not
    have to guess.
  - Exact match is strict (`npm test -- --watch` is not allowed if only
    `npm test` is listed). I chose that because prefix or glob matching is
    easy to bypass.
- How supported interfaces remain consistent: Both call the same
  `reviewRepository` core and produce the same report format and output cap.
  They differ in which commands may run, in the timeout, and in how a failed
validation is signaled: the CLI exits 1, while MCP returns the report with a
"failed" status as a normal result (not isError), because the review itself
succeeded. .
- Evidence that would change this decision: If agents mostly called the CLI through a shell instead of MCP, I would move the allowlist into the shared core so it covers both interfaces. If MCP were rarely used, I would go CLI-first and drop it to reduce the attack surface.

## How did you use an AI coding agent?

I used Claude Code to:

- review the repository and rank the problems
- propose a plan for my limited time
- write a failing test first for each step, then the fix
- run the tests, commit and push

I set the scope of each step, asked it to show failing output before every
fix.
I also used a separate Claude chat as a coach: to plan prompts, decide what to verify, and review my notes. The verification commands listed below I ran myself in my own terminal unless stated otherwise


## Where did you check, correct, or reject an AI suggestion? (required)

- **CLI trust boundary (corrected).** Claude treated the CLI as human-only. I
  pointed out that agents can also run the CLI through a shell. I had this
  documented as a known risk in the README and the MCP tool description
  instead of assuming the CLI is safe.
- **CI fix (checked before accepting).** When CI went red, I asked for the
  real CI log (`gh run list`, `gh run view --log-failed`) and the exact cause
  before accepting the proposed fix.
- **MCP timeout (checked).** I asked Claude to show where the "60 s client
  default" is defined. It is `DEFAULT_REQUEST_TIMEOUT_MSEC = 60000` in
  `@modelcontextprotocol/sdk` `dist/esm/shared/protocol.js:8`. I checked
  that line myself.
- **My own idea corrected.** I asked for a 50 s timeout per command on MCP.
  That was wrong, because the client's 60 s covers the whole call, and two
  commands at 50 s each would take 100 s. Claude changed it to a 50 s total
  budget per call.

## Commands used to verify the result, with outcomes

Claude ran npm test and npm run typecheck after each step (2 → 5 → 17 → 25 → 29
tests, all passing) and checked CI with gh run list after each push.

I ran these myself in my own terminal:
- `npm test && npm run typecheck` after step 2: 5/5 passed, typecheck clean.
- `npm run inspector -- review --repo . --base-ref "--output=/tmp/pwned"`
  → rejected ("Invalid base ref ... does not resolve to a commit");
  `ls /tmp/pwned*` → no matches.
- The MCP reproduction (validationCommands writing /tmp/mcp-poc.txt)
  BEFORE the fix → file written as my user, report looked normal.
  AFTER the fix → rejected ("not allowed by this server"), no file written
- `--validate "exit 1"` BEFORE the fix → Fatal error, no report;
  AFTER → report shows failed, exit code 1.
- `grep` in protocol.js → line 8: DEFAULT_REQUEST_TIMEOUT_MSEC = 60000.
- `git status` → clean, everything pushed.
- `grep '"bin"' package.json; ls dist/cli.js dist/src/cli.js` → bin points to
  dist/cli.js, which doesn't exist; the build outputs dist/src/cli.js.

CI is green on every commit from 77cbe13 onward (red on 01393b2, see Blocker).

## A blocker you hit and how you approached it

CI went red after I pushed the first two commits. I asked for the real CI log
before accepting a fix. The build compiles `test/` into `dist/test/`, and
Vitest ran both copies. The compiled MCP test breaks when run from `dist/`.
The double run already happened before my changes; my test was the first one
to break under it. The fix was `vitest.config.ts`, limiting tests to
`test/**/*.test.ts`, without touching `.github/`. I checked it with
`npm run build && npm test` locally, and CI went green.

## Known limitations and the next three things you would do

Known limitations:

- Invalid input (for example a bad base ref) still ends in a stack trace on
  the CLI.
- Repos whose default branch is `master` fail unless `--base-ref` is given.
- An allowlisted command like `npm test` still runs the reviewed repo's own
  code.
- The timeout and output cap are fixed defaults, with no flag to change them.
- A code fence (```` ``` ````) in command output breaks the Markdown report.
- Killing the process group does not work on Windows.
- The 50 s MCP budget was not tested against the live server (too slow for
  tests).
-  `npm install` reports 15 dependency vulnerabilities (1 critical).
  `npm audit --omit=dev` shows 9 in production dependencies (3 moderate,
  5 high, 1 critical), in proxy-addr, ip-address, qs and zod. Most look like
  they come through the MCP SDK's HTTP-server dependencies, while this tool
  uses stdio, so they may not be reachable — I did not verify that. The zod
  fix needs a breaking upgrade (`npm audit fix --force` → zod 4.6.7), so I
  did not apply it.
  
- MCP reports a failed validation as a normal result, not isError; an agent must read the status.  

Next three:

1. Triage the 9 production vulnerabilities: check which are reachable from
   the stdio MCP server and the CLI, run the non-breaking `npm audit fix`,
   and test the zod upgrade separately.
2. Fix the git parsing (`-z`, renames, uncommitted changes) and the
   hardcoded `main` default.
3. Return structured errors instead of stack traces, and escape Markdown in
   the report.

## Approximate focused-work time

- Start:22:55
- Finish: 00:10
