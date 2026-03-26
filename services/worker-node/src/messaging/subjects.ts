export const SUBJECTS = {
  JOB_ASSIGNED: (workerId: string) => `fusio.jobs.assigned.${workerId}`,
  JOB_CANCEL: (jobId: string) => `fusio.jobs.cancel.${jobId}`,
  ACTION_PACKET: (jobId: string) => `fusio.action.${jobId}`,
  OBSERVATION: (jobId: string) => `fusio.observation.${jobId}`,
  JOB_COMPLETE: (jobId: string) => `fusio.jobs.complete.${jobId}`,
  JOB_FAILED: (jobId: string) => `fusio.jobs.failed.${jobId}`,
  HEARTBEAT: (workerId: string) => `fusio.heartbeat.${workerId}`,
};
