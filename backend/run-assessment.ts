import { createEntraCollector, EntraCollector } from './src/services/entraCollector';
import * as path from 'path';
import * as fs from 'fs';

const TENANT_CONNECTION_ID = '286e0365-5866-4497-9674-924795474046';
const ASSESSMENT_ID = 'manual-test-' + Date.now();

async function runQuickAssessment() {
  console.log('Starting quick assessment...');
  console.log('Tenant Connection ID:', TENANT_CONNECTION_ID);
  console.log('Assessment ID:', ASSESSMENT_ID);

  const collector = await createEntraCollector(TENANT_CONNECTION_ID);
  if (!collector) {
    console.error('Failed to create EntraCollector - check tenant connection');
    process.exit(1);
  }

  console.log('Collecting data from Microsoft Graph API...');
  const result = await collector.collectForQuickAssessment();

  console.log('\n--- Assessment Result ---');
  console.log('Status:', result.status);
  console.log('Collected At:', result.collectedAt);
  console.log('Total Endpoints:', Object.keys(result.rawData).length);
  console.log('Successful:', Object.values(result.rawData).filter(d => !d?.error).length);
  console.log('Failed:', result.errors.length);

  console.log('\n--- Controls Evaluated ---');
  for (const [id, controlResult] of Object.entries(result.controls)) {
    console.log(`${id}: ${controlResult.result} - ${controlResult.evidence}`);
  }

  if (result.errors.length > 0) {
    console.log('\n--- Errors ---');
    for (const error of result.errors) {
      console.log(`${error.endpoint}: ${error.error}`);
    }
  }

  // Save to files
  const baseDir = path.join(__dirname, 'assessment-data', ASSESSMENT_ID, 'Entra-ID');
  if (!fs.existsSync(baseDir)) {
    fs.mkdirSync(baseDir, { recursive: true });
  }

  // Save each endpoint response
  for (const [endpoint, data] of Object.entries(result.rawData)) {
    const filename = endpoint.replace(/[^a-zA-Z0-9]/g, '_').replace(/_+/g, '_') + '.json';
    const filepath = path.join(baseDir, filename);
    fs.writeFileSync(filepath, JSON.stringify({
      endpoint,
      timestamp: new Date().toISOString(),
      status: data?.error ? 'error' : 'success',
      data: data?.error ? { error: data.error } : data?.value || data,
    }, null, 2));
  }

  // Save summary
  const summaryPath = path.join(baseDir, '_summary.json');
  fs.writeFileSync(summaryPath, JSON.stringify({
    assessmentId: ASSESSMENT_ID,
    moduleName: 'Entra-ID',
    collectedAt: result.collectedAt,
    status: result.status,
    totalEndpoints: Object.keys(result.rawData).length,
    successfulEndpoints: Object.values(result.rawData).filter(d => !d?.error).length,
    failedEndpoints: result.errors.length,
    endpoints: Object.keys(result.rawData).map(endpoint => ({
      endpoint,
      status: result.rawData[endpoint]?.error ? 'error' : 'success',
      error: result.rawData[endpoint]?.error || null,
    })),
  }, null, 2));

  // Save errors
  if (result.errors.length > 0) {
    const errorsPath = path.join(baseDir, '_errors.json');
    fs.writeFileSync(errorsPath, JSON.stringify(result.errors, null, 2));
  }

  console.log('\n--- Files Saved To ---');
  console.log(baseDir);
  console.log('\nDone!');
}

runQuickAssessment().catch(console.error);
