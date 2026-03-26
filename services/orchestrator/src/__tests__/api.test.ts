import { describe, it, expect, beforeEach } from 'vitest';
import Fastify from 'fastify';
import { generateKeypair, createManifest } from '@fusio/protocol-types';
import { registerRoutes } from '../api/routes.js';
import * as registry from '../core/registry.js';
import * as ledger from '../core/ledger.js';
import * as jobStore from '../db/jobs.js';

function buildApp() {
  const app = Fastify();
  registerRoutes(app, null); // null NATS - not needed for tests
  return app;
}

describe('API routes', () => {
  let app: ReturnType<typeof Fastify>;

  beforeEach(async () => {
    registry.clear();
    ledger.clearAll();
    jobStore.clear();
    ledger.seedBalance('requester', 100);
    app = buildApp();
  });

  it('GET /health returns 200', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.status).toBe('ok');
    expect(body.version).toBeDefined();
  });

  it('POST /jobs with valid manifest returns 201', async () => {
    const keypair = generateKeypair();

    // Register a worker first and seed its agent balance
    registry.register('w1', 'tok', ['browse']);
    ledger.seedBalance(keypair.identity.agentId, 100);

    const manifest = createManifest(
      {
        agentId: keypair.identity.agentId,
        capability: 'browse',
        estimatedMinutes: 5,
        maxPriceAgr: 1,
        browser: 'chromium',
        declaredPurpose: 'test job',
        category: 'test.ping',
        memoryPolicy: 'ephemeral',
        failoverPolicy: 'abort',
      },
      keypair
    );

    const res = await app.inject({
      method: 'POST',
      url: '/jobs',
      payload: manifest,
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.jobId).toBe(manifest.jobId);
    expect(body.status).toBe('active');
    expect(body.workerId).toBe('w1');
  });

  it('POST /jobs with invalid manifest returns 400', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/jobs',
      payload: { bad: 'data' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('POST /jobs with prohibited category returns 400', async () => {
    const keypair = generateKeypair();
    const manifest = createManifest(
      {
        agentId: keypair.identity.agentId,
        capability: 'browse',
        estimatedMinutes: 5,
        maxPriceAgr: 1,
        browser: 'chromium',
        declaredPurpose: 'fill form',
        category: 'form.submit',
        memoryPolicy: 'ephemeral',
        failoverPolicy: 'abort',
      },
      keypair
    );

    const res = await app.inject({
      method: 'POST',
      url: '/jobs',
      payload: manifest,
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toContain('prohibited');
  });

  it('POST /jobs with no workers returns 503', async () => {
    const keypair = generateKeypair();
    const manifest = createManifest(
      {
        agentId: keypair.identity.agentId,
        capability: 'browse',
        estimatedMinutes: 5,
        maxPriceAgr: 1,
        browser: 'chromium',
        declaredPurpose: 'test',
        category: 'test.ping',
        memoryPolicy: 'ephemeral',
        failoverPolicy: 'abort',
      },
      keypair
    );

    const res = await app.inject({
      method: 'POST',
      url: '/jobs',
      payload: manifest,
    });
    expect(res.statusCode).toBe(503);
  });
});
