import { Queue } from 'bullmq';
import IORedis from 'ioredis';

const connection = new IORedis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
});
const queue = new Queue('lab-jobs', { connection });

for (let i = 1; i <= 5; i += 1) {
  const job = await queue.add('analyze-telemetry', { deviceId: 'ESS-LAB-01', sequence: i });
  console.log(`PRODUCED job=${job.id}`);
}

await queue.close();
await connection.quit();
