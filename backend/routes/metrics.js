import express from 'express';
import os from 'os';
import { exec } from 'child_process';

const router = express.Router();

// State variables for simulated/artificial CPU spikes
let cpuSpikeInterval = null;
let simulatedCpuLoad = 0; // percentage

// Function to burn CPU at ~80% load without completely locking up the Express event loop
const startCpuBurner = () => {
  if (cpuSpikeInterval) return;
  
  simulatedCpuLoad = 85;
  console.log('[Metrics] CPU spike simulation started.');

  const burn = () => {
    const start = Date.now();
    // Busy loop for 80 milliseconds
    while (Date.now() - start < 80) {
      Math.sqrt(Math.random() * 100000);
    }
    // Yield to event loop for 20 milliseconds
    if (simulatedCpuLoad > 0) {
      setTimeout(burn, 20);
    }
  };
  
  burn();
};

const stopCpuBurner = () => {
  simulatedCpuLoad = 0;
  if (cpuSpikeInterval) {
    clearInterval(cpuSpikeInterval);
    cpuSpikeInterval = null;
  }
  console.log('[Metrics] CPU spike simulation stopped.');
};

// GET /api/metrics/health - Simple ALB Health Check
router.get('/health', (req, res) => {
  res.status(200).json({ status: 'healthy', timestamp: new Date() });
});

// GET /api/metrics - Get telemetry metrics
router.get('/', async (req, res) => {
  // Read real CPU load average (1 minute)
  const loadAvg = os.loadavg()[0];
  const cpus = os.cpus().length;
  // Calculate approximate CPU utilization percentage from load average
  let realCpuUsage = Math.min(Math.round((loadAvg / cpus) * 100), 100);

  // If artificial spike is active, use the simulated load instead
  const currentCpuUsage = simulatedCpuLoad > 0 ? simulatedCpuLoad : Math.max(realCpuUsage, 5);

  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const memoryUsage = Math.round(((totalMem - freeMem) / totalMem) * 100);

  res.json({
    hostname: os.hostname(),
    platform: os.platform(),
    uptime: Math.round(os.uptime()),
    cpuUsage: currentCpuUsage,
    memoryUsage: memoryUsage,
    loadAverage: loadAvg.toFixed(2),
    cpuSpikeActive: simulatedCpuLoad > 0,
    timestamp: new Date()
  });
});

// POST /api/metrics/cpu-spike - Trigger CPU spike (defaults to 60 seconds)
router.post('/cpu-spike', (req, res) => {
  const duration = parseInt(req.body.duration || '60', 10);
  
  startCpuBurner();

  // Schedule cooldown automatically
  if (cpuSpikeInterval) clearTimeout(cpuSpikeInterval);
  cpuSpikeInterval = setTimeout(() => {
    stopCpuBurner();
  }, duration * 1000);

  res.json({ 
    message: `CPU spike initiated at ~85% load for ${duration} seconds.`,
    cpuSpikeActive: true
  });
});

// POST /api/metrics/cpu-cooldown - Terminate CPU spike immediately
router.post('/cpu-cooldown', (req, res) => {
  stopCpuBurner();
  res.json({ 
    message: 'CPU load returned to normal.',
    cpuSpikeActive: false
  });
});

export default router;
