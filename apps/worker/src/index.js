require('dotenv').config();

const concurrency = Number(process.env.WORKER_CONCURRENCY || 2);

console.log('[hcphotos-worker] started');
console.log(`[hcphotos-worker] concurrency=${concurrency}`);
console.log('[hcphotos-worker] queue pipeline scaffold is ready (transcode/exif jobs will be added next).');

setInterval(() => {
  console.log(`[hcphotos-worker] heartbeat ${new Date().toISOString()}`);
}, 60_000);
