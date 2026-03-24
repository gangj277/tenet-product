# Open Source Surface And Local Launch Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make the repo launchable as an open-source local Electron app from GitHub, with a polished README and contributor-facing GitHub surface.

**Architecture:** Keep `electron:dev` for contributor iteration, add a separate `electron:local` launcher that builds Next standalone output and starts Electron in local-production mode, and rewrite the repo surface around GitHub clone + local run rather than signed desktop binaries. Add repo metadata docs (`README`, `CONTRIBUTING`, `CITATION`, issue templates) and a ready-to-upload social preview asset.

**Tech Stack:** Next.js standalone output, Electron main process, Node launcher scripts, GitHub repository metadata files, SVG social preview asset.

---

### Task 1: Add a local-production Electron launch path

**Files:**
- Create: `scripts/electron-local-start.mjs`
- Modify: `package.json`
- Modify: `electron/main.ts`
- Modify: `electron/server-launch.ts`
- Test: `tests/electron-server-launch.test.tsx`

**Step 1: Write the failing test**
- Add a test for a local standalone server launch config that points to `.next/standalone/server.js` and `.next/static`.

**Step 2: Run test to verify it fails**
- Run: `node --import tsx --test tests/electron-server-launch.test.tsx`

**Step 3: Write minimal implementation**
- Add `getLocalProductionServerLaunchConfig(...)`.
- Teach `electron/main.ts` to use local-production mode when `LUMEN_ELECTRON_MODE=local`.
- Add `scripts/electron-local-start.mjs` to run `electron:compile`, `build`, then launch Electron with the local-production env.
- Add `npm run electron:local`.

**Step 4: Run test to verify it passes**
- Run: `node --import tsx --test tests/electron-server-launch.test.tsx`

### Task 2: Replace the README with a real open-source front page

**Files:**
- Modify: `README.md`

**Step 1: Write the content**
- Add product positioning, screenshots, install paths, `npx degit` clone flow, `npm run electron:local`, contributor setup, and release expectations.

**Step 2: Verify links and commands**
- Check commands against `package.json`.

### Task 3: Add open-source repository metadata

**Files:**
- Create: `.github/ISSUE_TEMPLATE/bug_report.yml`
- Create: `.github/ISSUE_TEMPLATE/feature_request.yml`
- Create: `.github/ISSUE_TEMPLATE/config.yml`
- Create: `.github/pull_request_template.md`
- Create: `CONTRIBUTING.md`
- Create: `CITATION.cff`

**Step 1: Add templates and contributor docs**
- Focus on researcher-friendly bug reports and workflow feedback.

**Step 2: Verify YAML and markdown syntax**
- Run a quick file sanity read.

### Task 4: Add a GitHub social preview asset

**Files:**
- Create: `public/images/github-social-preview.svg`

**Step 1: Create the asset**
- Use existing Lumen visual language and repo positioning.

**Step 2: Verify**
- Open the SVG text and ensure dimensions/title match GitHub preview usage.

### Task 5: Final verification

**Files:**
- Verify all modified files

**Step 1: Run targeted tests**
- Run: `node --import tsx --test tests/electron-server-launch.test.tsx`

**Step 2: Run build checks**
- Run: `npm run electron:compile`
- Run: `npm run build`

**Step 3: Run broader test suite**
- Run: `npm test`

**Step 4: Manual command verification**
- Confirm README commands match real scripts:
  - `npx degit <repo> lumen`
  - `npm install`
  - `npm run electron:local`
