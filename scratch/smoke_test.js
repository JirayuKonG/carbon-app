const http = require('http');

const ENDPOINTS = [
  { name: 'CF KPI', path: '/api/analytics/cf-kpi' },
  { name: 'CF Trend', path: '/api/analytics/cf-trend' },
  { name: 'CF Process', path: '/api/analytics/cf-process' },
  { name: 'CF Process Activities', path: '/api/analytics/cf-process-activities' },
  { name: 'CF Process Inputs', path: '/api/analytics/cf-process-inputs' },
  { name: 'CF Cane Types', path: '/api/analytics/cf-cane-types' },
  { name: 'CF Camps', path: '/api/analytics/cf-camps' },
  { name: 'CF Camp Fields', path: '/api/analytics/cf-camp-fields' },
  { name: 'CF Spatial Nodes', path: '/api/analytics/cf-spatial-nodes' },
  { name: 'Input Usage Summary', path: '/api/activities/input-usage-summary' }
];

const BASE_URL = 'http://localhost:3000';

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    http.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        const duration = Date.now() - start;
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode} from ${url} (took ${duration}ms)`));
          return;
        }
        try {
          const json = JSON.parse(data);
          resolve({ json, duration });
        } catch (e) {
          reject(new Error(`Failed to parse JSON from ${url}: ${e.message} (took ${duration}ms)`));
        }
      });
    }).on('error', (err) => {
      reject(new Error(`Connection failed for ${url}: ${err.message}`));
    });
  });
}

async function runSmokeTest() {
  console.log('========================================================');
  console.log('      CARBON APP - PHASE 2E API SMOKE TEST / REGRESSION  ');
  console.log(`      Target Host: ${BASE_URL}`);
  console.log('========================================================\n');

  let passCount = 0;
  let failCount = 0;
  const results = [];

  for (const ep of ENDPOINTS) {
    const url = `${BASE_URL}${ep.path}`;
    process.stdout.write(`Testing [${ep.name}] at ${ep.path}... `);
    try {
      const { json, duration } = await fetchJson(url);
      
      // Basic check of returned data
      let itemCount = 0;
      let extraInfo = '';
      
      if (ep.path === '/analytics/cf-kpi') {
        itemCount = json.fields ? 1 : 0;
        extraInfo = `Fields: ${json.fields || 0}, Current Emission: ${json.currentEmission || 0} tCO2e`;
      } else if (ep.path === '/activities/input-usage-summary') {
        const fertilizerCount = Array.isArray(json.fertilizer) ? json.fertilizer.length : 0;
        const fuelCount = Array.isArray(json.fuel) ? json.fuel.length : 0;
        itemCount = fertilizerCount + fuelCount;
        extraInfo = `Fertilizer: ${fertilizerCount} rows, Fuel: ${fuelCount} rows`;
      } else if (Array.isArray(json)) {
        itemCount = json.length;
        extraInfo = `Array length: ${json.length}`;
      } else if (json.data && Array.isArray(json.data)) {
        itemCount = json.data.length;
        extraInfo = `Data length: ${json.data.length}, Source: ${json.source || 'N/A'}`;
      } else if (json.spatialNodes && Array.isArray(json.spatialNodes)) {
        itemCount = json.spatialNodes.length;
        extraInfo = `Spatial Nodes: ${json.spatialNodes.length}`;
      } else {
        itemCount = Object.keys(json).length;
        extraInfo = `Keys: ${itemCount}`;
      }

      console.log(`\x1b[32mPASS\x1b[0m (${duration}ms)`);
      results.push({ name: ep.name, status: 'PASS', duration: `${duration}ms`, items: itemCount, info: extraInfo });
      passCount++;
    } catch (err) {
      console.log(`\x1b[31mFAIL\x1b[0m`);
      console.error(`  Error: ${err.message}`);
      results.push({ name: ep.name, status: 'FAIL', duration: 'N/A', items: 0, info: err.message });
      failCount++;
    }
  }

  console.log('\n========================================================');
  console.log('                      SUMMARY REPORT                    ');
  console.log('========================================================');
  console.table(results.map(r => ({
    'Endpoint Name': r.name,
    'Status': r.status,
    'Resp Time': r.duration,
    'Record Count': r.items,
    'Details / Message': r.info
  })));

  console.log('--------------------------------------------------------');
  console.log(`TOTAL ENDPOINTS: ${ENDPOINTS.length}`);
  console.log(`PASSED: \x1b[32m${passCount}\x1b[0m`);
  console.log(`FAILED: ${failCount > 0 ? `\x1b[31m${failCount}\x1b[0m` : `\x1b[32m0\x1b[0m`}`);
  console.log('========================================================');
  
  if (failCount > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runSmokeTest();
