# AI essay critique (Claude)

SOAR Hub can draft a structured critique of an applicant's essay with Claude. A reviewer must approve, edit or reject
every AI critique before the applicant sees it, and AI never rewrites the essay.

## Turn it on

1. Create an API key at **console.anthropic.com** (Settings → API keys). Add a payment method; usage is pay-as-you-go.
2. Add to `.env` (never commit this file):
   ```bash
   AI_PROVIDER=anthropic
   AI_API_KEY=sk-ant-...
   ```
   The model defaults to `claude-opus-5-5`. To use another model, set `AI_MODEL`.
3. Restart the app. **Admin → Settings → Integrations** shows "AI critique: Anthropic Claude, Active".
4. Click **Admin → Settings → Test AI critique → Run a test critique**. It runs one real critique on a short built-in
   essay and shows the model, time, token counts and the summary. That costs a few US cents.

## How it's used

- When an applicant submits an essay for review, a draft critique is generated straight away (switch this off under
  **Settings → AI, registration & maintenance**), and the essay waits for a human reviewer.
- Reviewers can also request a critique from the essay review page.
- Drafts wait in **Admin → AI approval queue** / the reviewer's essay page. Approve (optionally editing), flag or reject.
- If the model declines a request, the API automatically retries on a fallback model (server-side fallback).
  Output is validated against a fixed schema and safety-checked (no rewrites of the essay, no promises of selection).
