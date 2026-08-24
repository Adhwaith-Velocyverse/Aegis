import axios from 'axios';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3001';
let authToken: string | null = null;
let testOrgId: string | null = null;
let testConnectionId: string | null = null;

async function request(method: string, path: string, body?: any) {
  const headers: Record<string, string> = {};
  if (authToken) headers['Authorization'] = `Bearer ${authToken}`;
  if (body) headers['Content-Type'] = 'application/json';

  const response = await axios({ method, url: `${BASE_URL}${path}`, headers, data: body });
  return response.data;
}

async function smokeTest() {
  console.log('=== Aegis M365 Connection Module Smoke Test ===\n');

  try {
    console.log('1. Testing backend health...');
    const health = await request('GET', '/health');
    console.log('   Backend status:', health.status || 'OK');

    console.log('\n2. Testing unauthenticated endpoints...');
    try {
      const plans = await request('GET', '/api/billing/plans');
      console.log('   Billing plans available:', plans.data?.length || 0);
    } catch (err: any) {
      console.log('   Billing plans error:', err.response?.status, err.response?.data?.error || err.message);
    }

    console.log('\n3. Testing trial questions endpoint (requires auth)...');
    try {
      const questions = await request('GET', '/api/assessments/trial/questions');
      console.log('   Questions count:', questions.data?.length || 0);
    } catch (err: any) {
      if (err.response?.status === 401) {
        console.log('   Auth required (expected for trial questions)');
      } else {
        console.log('   Error:', err.response?.status, err.response?.data?.error || err.message);
      }
    }

    console.log('\n4. Testing tenant connections list (requires auth)...');
    try {
      const connections = await request('GET', '/api/tenants');
      console.log('   Connections count:', connections.data?.length || 0);
    } catch (err: any) {
      if (err.response?.status === 401) {
        console.log('   Auth required (expected for tenant list)');
      } else {
        console.log('   Error:', err.response?.status, err.response?.data?.error || err.message);
      }
    }

    console.log('\n=== Smoke test completed ===');
  } catch (error: any) {
    console.error('\nSmoke test failed:', error.message);
    if (error.response?.data) {
      console.error('Response:', error.response.data);
    }
    process.exit(1);
  }
}

smokeTest();
