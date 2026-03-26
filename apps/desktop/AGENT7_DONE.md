# Agent 7 -- Fusio Desktop App (Tauri 2.0)

## Status: COMPLETE

## What was built

A full Tauri 2.0 desktop application with React + Vite + Tailwind CSS frontend and Rust backend.

### Frontend (React + TypeScript)

**Pages:**
- `src/pages/RequesterHome.tsx` -- Job submission form + active/recent job lists with 3s polling
- `src/pages/Onboarding.tsx` -- 3-step wizard (Welcome/Role, Setup, Ready)
- `src/pages/JobDetail.tsx` -- Live session view, action log, receipt panel
- `src/pages/WorkerHome.tsx` -- Worker toggle, earnings widget, completed jobs
- `src/pages/Credentials.tsx` -- API key management (add/remove)
- `src/pages/Settings.tsx` -- Orchestrator URL, NATS URL, worker resource limits, wallet

**Components:**
- `src/components/JobCard.tsx` -- Job card with status badge, elapsed time, step count
- `src/components/StatusBadge.tsx` -- Color-coded status badges (active/completed/failed/pending)
- `src/components/EarningsWidget.tsx` -- FUS earnings display (today/week/all time)
- `src/components/LiveSessionView.tsx` -- Real-time screenshot viewer for active jobs

**Hooks:**
- `src/hooks/useOrchestrator.ts` -- Orchestrator HTTP API polling (submitJob, getJobs, getJob)
- `src/hooks/useWorkerDaemon.ts` -- Worker management with Tauri command fallback
- `src/hooks/useWallet.ts` -- Keypair management with localStorage fallback

**Layout:**
- `src/App.tsx` -- Sidebar navigation + react-router-dom routes

### Backend (Rust / Tauri 2.0)

- `src-tauri/src/lib.rs` -- Tauri app builder with plugin and command registration
- `src-tauri/src/main.rs` -- Entry point
- `src-tauri/src/worker.rs` -- Worker process spawn/kill (node worker-node)
- `src-tauri/src/keystore.rs` -- OS keychain stub for keypair storage
- `src-tauri/Cargo.toml` -- Dependencies (tauri 2, serde, tokio)
- `src-tauri/tauri.conf.json` -- Window config (1024x700), CSP, bundle settings

### Config files

- `package.json` -- @fusio/desktop with React 18, Tauri 2, Vite 5
- `vite.config.ts` -- React plugin, Tauri env prefix
- `tsconfig.json` -- ESNext, bundler resolution
- `tailwind.config.js` -- Custom fusio accent color
- `postcss.config.js` -- Tailwind + autoprefixer

### CI/CD

- `.github/workflows/release.yml` -- GitHub Actions matrix build for macOS (ARM+Intel) and Windows

### Website

- `apps/website/download.html` -- Static download page with OS detection

## To run

```bash
cd apps/desktop
python3 scripts/generate-icons.py   # Generate placeholder icons
npm install
npm run dev                          # Frontend dev server only
npm run tauri dev                    # Full Tauri app (requires Rust)
```

## Note

Bash access was denied during this session, so the following manual steps are needed:
1. Run `python3 scripts/generate-icons.py` to generate placeholder icon files
2. Run `npm install` to install dependencies
3. Run `npx tsc --noEmit` to verify TypeScript compiles
4. Run `npm run build` to verify the Vite frontend build
