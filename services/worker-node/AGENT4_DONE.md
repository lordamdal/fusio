# Agent 4 — Worker Node — DONE

## NATS Subjects Subscribed
- `fusio.jobs.assigned.<workerId>` — receives job assignments
- `fusio.action.<jobId>` — receives action packets during job execution
- `fusio.jobs.cancel.<jobId>` — receives cancellation signals

## NATS Subjects Published
- `fusio.observation.<jobId>` — sends observation packets (screenshot + DOM)
- `fusio.jobs.complete.<jobId>` — sends completion receipt
- `fusio.jobs.failed.<jobId>` — sends failure notification

## Docker Image
- Name: `fusio-browser:latest`
- Build: `bash scripts/build-image.sh`
- Platform: `linux/arm64` (Apple Silicon)
- Base: `mcr.microsoft.com/playwright:v1.42.0-jammy`

## Environment Variables
- `ORCHESTRATOR_URL` — orchestrator HTTP base URL (required)
- `NATS_URL` — NATS server URL (default: nats://localhost:4222)
- `WORKER_PORT` — health endpoint port (default: 3001)
- `LOG_LEVEL` — pino log level (default: info)
- `FUSIO_KEY_PASSPHRASE` — keypair encryption passphrase (required)
- `DATA_DIR` — data directory (default: ./data)
- `LOCAL_IP` — this machine's LAN IP for orchestrator callback

## Health Endpoint
- `GET http://localhost:3001/health`
