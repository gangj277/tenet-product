# Contributing To Lumen

## Setup

### Fast local run

```bash
git clone https://github.com/gangj277/tenet-product.git
cd tenet-product
npm install
npx codex login
npm run electron:local
```

### Contributor dev mode

```bash
npm run electron:dev
```

Use `electron:local` when you want the app in its normal local-run shape.

Use `electron:dev` when you are actively changing code and need hot reload.

## Before You Open A PR

Run:

```bash
npm run electron:compile
npm run build
npm test
```

Two UI tests are currently known baseline failures in this repo:

- `tests/agent-bubble-process-trace.test.tsx`
- `tests/landing-page.test.tsx`

If your change touches those surfaces, either fix the tests or call that out clearly.

## What We Care About

- source-grounded behavior over generic AI polish
- local-first reliability
- explicit error handling
- regressions covered by tests
- minimal churn outside the task

## Good Issues

The most useful issues include:

- the exact workflow you were running
- whether you were in `electron:local`, `electron:dev`, or web mode
- whether the source was a PDF, URL, or discovered paper
- the exact error text or screenshot
- reproducible steps

## PR Style

- keep patches focused
- add or update tests for behavior changes
- do not revert unrelated user changes
- prefer small, reviewable commits

## Questions

If you are unsure whether something belongs in the app, open an issue first with:

- the user problem
- the proposed behavior
- what tradeoff it introduces
