import type { FastifyInstance } from 'fastify';
import { v4 as uuidv4 } from 'uuid';
import * as registry from '../core/registry.js';

interface RegisterBody {
  workerId: string;
  capabilities: string[];
}

interface HeartbeatParams {
  id: string;
}

export function registerWorkerRoutes(app: FastifyInstance): void {
  app.post<{ Body: RegisterBody }>('/workers/register', async (request, reply) => {
    const { workerId, capabilities } = request.body;
    if (!workerId || !capabilities || !Array.isArray(capabilities)) {
      return reply.status(400).send({ error: 'workerId and capabilities[] are required' });
    }
    const token = uuidv4();
    registry.register(workerId, token, capabilities);
    return reply.status(200).send({ registered: true, token });
  });

  app.post<{ Params: HeartbeatParams }>('/workers/:id/heartbeat', async (request, reply) => {
    const { id } = request.params;
    const updated = registry.updateHeartbeat(id);
    if (!updated) {
      return reply.status(404).send({ error: 'Worker not found' });
    }
    return { ok: true };
  });

  app.get('/workers', async () => {
    return registry.getAll();
  });
}
