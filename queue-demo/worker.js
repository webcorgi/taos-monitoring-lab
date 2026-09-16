import { Worker } from 'bullmq';
import IORedis from 'ioredis';

const connection = new IORedis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
});

const worker = new Worker(
  'lab-jobs',
  async (job) => {
    console.log(`CONSUMED job=${job.id} data=${JSON.stringify(job.data)}`);
    await new Promise((resolve) => setTimeout(resolve, 700));
    return { ok: true };
  },
  { connection },
);

worker.on('completed', (job) => console.log(`DONE job=${job.id}`));
worker.on('failed', (job, error) => console.log(`FAILED job=${job?.id} ${error.message}`));

console.log('BullMQ worker waiting for jobs...');
