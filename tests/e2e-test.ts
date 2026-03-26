import { generateKeypair, createManifest } from '@fusio/protocol-types';

async function runE2ETest() {
  console.log('[E2E] Starting Fusio protocol end-to-end test');

  // 1. Generate requester keypair
  const requesterKeypair = generateKeypair();
  console.log('[E2E] Requester keypair generated:', requesterKeypair.identity.agentId.slice(0, 12) + '...');

  // 2. Create a test job manifest
  const manifest = createManifest({
    agentId: requesterKeypair.identity.agentId,
    capability: 'browser.full',
    estimatedMinutes: 2,
    maxPriceAgr: 1.0,
    browser: 'chromium',
    declaredPurpose: 'Navigate to example.com and take a screenshot',
    category: 'test.ping',
    memoryPolicy: 'ephemeral',
    failoverPolicy: 'abort',
    url: 'https://example.com',
  }, requesterKeypair);

  console.log('[E2E] Manifest created, jobId:', manifest.jobId);

  // 3. Submit to orchestrator
  const response = await fetch('http://localhost:3000/jobs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(manifest),
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(`[E2E] Job submission failed: ${JSON.stringify(err)}`);
  }

  const assignment = await response.json() as { workerId?: string };
  console.log('[E2E] Job assigned to worker:', assignment.workerId?.slice(0, 12) + '...');

  // 4. Poll job status until complete or timeout
  const startTime = Date.now();
  const TIMEOUT_MS = 3 * 60 * 1000; // 3 minutes

  while (Date.now() - startTime < TIMEOUT_MS) {
    await new Promise(r => setTimeout(r, 3000));

    const statusResp = await fetch(`http://localhost:3000/jobs/${manifest.jobId}`);
    const job = await statusResp.json() as {
      status: string;
      stepCount?: number;
      receiptId?: string;
      actionCount?: number;
      faultClass?: string;
      errorMessage?: string;
    };

    console.log(`[E2E] Job status: ${job.status} | Step: ${job.stepCount ?? 0}`);

    if (job.status === 'completed') {
      console.log('[E2E] Job completed successfully');
      console.log('[E2E] Receipt ID:', job.receiptId);
      console.log('[E2E] Action count:', job.actionCount);
      return { success: true, job };
    }

    if (job.status === 'failed') {
      throw new Error(`[E2E] Job failed: ${job.faultClass} — ${job.errorMessage}`);
    }
  }

  throw new Error('[E2E] Test timed out after 3 minutes');
}

runE2ETest()
  .then(result => {
    console.log('[E2E] ALL CHECKS PASSED');
    console.log('[E2E] Result:', JSON.stringify(result, null, 2));
    process.exit(0);
  })
  .catch(err => {
    console.error('[E2E] TEST FAILED:', err.message);
    process.exit(1);
  });
