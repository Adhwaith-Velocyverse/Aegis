import 'dotenv/config';
import fs from 'fs';
import path from 'path';

const QUICK_ENDPOINTS = [
  { id: 'anti-phish-policy', category: 'anti-phishing' },
  { id: 'anti-phish-rule', category: 'anti-phishing' },
  { id: 'hosted-content-filter-policy', category: 'anti-spam' },
  { id: 'hosted-content-filter-rule', category: 'anti-spam' },
  { id: 'hosted-outbound-spam-filter-policy', category: 'anti-spam' },
  { id: 'hosted-outbound-spam-filter-rule', category: 'anti-spam' },
  { id: 'malware-filter-policy', category: 'anti-malware' },
  { id: 'malware-filter-rule', category: 'anti-malware' },
  { id: 'safe-links-policy', category: 'safe-links' },
  { id: 'safe-links-rule', category: 'safe-links' },
  { id: 'safe-attachment-policy', category: 'safe-attachments' },
  { id: 'safe-attachment-rule', category: 'safe-attachments' },
  { id: 'accepted-domain', category: 'permissions-rbac' },
  { id: 'transport-config', category: 'smtp-auth' },
  { id: 'exo-cas-mailbox', category: 'pop-imap' },
  { id: 'inbound-connector', category: 'connectors' },
  { id: 'outbound-connector', category: 'connectors' },
  { id: 'transport-rule', category: 'transport-rules' },
  { id: 'exo-mailbox', category: 'common-metrics' },
  { id: 'distribution-group', category: 'common-metrics' },
  { id: 'dynamic-distribution-group', category: 'common-metrics' },
  { id: 'unified-group', category: 'common-metrics' },
  { id: 'tenant-allow-block-list-urls', category: 'common-metrics' },
  { id: 'tenant-allow-block-list-senders', category: 'common-metrics' },
  { id: 'tenant-allow-block-list-filehashes', category: 'common-metrics' },
  { id: 'graph-users', category: 'permissions-rbac' },
  { id: 'graph-directory-roles', category: 'permissions-rbac' },
  { id: 'graph-security-alerts', category: 'common-metrics' },
  { id: 'graph-security-incidents', category: 'common-metrics' },
  { id: 'tenant-allow-block-list-items', category: 'common-metrics' },
];

const FAILED_IDS = [
  '1083e65f-c227-4111-ad33-d4e22b1a1dd7',
  '4cc38b38-2ff7-42cf-84aa-ccff04e86dc7',
  '6ddb70e7-8d7e-4a90-99fd-71a75e51ecac',
  'e55956c4-0eef-401c-87a9-672f73b4f1ef',
];

async function main() {
  for (const assessmentId of FAILED_IDS) {
    const baseDir = path.join(__dirname, '..', 'assessment-data', assessmentId, 'email-security');
    if (!fs.existsSync(baseDir)) {
      console.log('Skipping', assessmentId, '(no email-security dir)');
      continue;
    }
    const errorsFile = path.join(baseDir, '_errors.json');
    if (!fs.existsSync(errorsFile)) {
      console.log('Skipping', assessmentId, '(no _errors.json)');
      continue;
    }
    const errorsData = JSON.parse(fs.readFileSync(errorsFile, 'utf-8'));
    const errMsg = errorsData.errors[0]?.error ?? 'Unknown error';
    const ts = errorsData.collectedAt ?? new Date().toISOString();

    for (const ep of QUICK_ENDPOINTS) {
      const categoryDir = path.join(baseDir, ep.category);
      fs.mkdirSync(categoryDir, { recursive: true });
      const filename = `${ep.id}.json`;
      const filepath = path.join(categoryDir, filename);
      if (fs.existsSync(filepath)) continue;
      const content = {
        endpoint: ep.id,
        timestamp: ts,
        status: 'error',
        error: `Connection failed: ${errMsg}`,
        durationMs: 0,
      };
      fs.writeFileSync(filepath, JSON.stringify(content, null, 2));
    }

    for (const sub of fs.readdirSync(baseDir, { withFileTypes: true })) {
      if (!sub.isDirectory()) continue;
      const subDir = path.join(baseDir, sub.name);
      const subErrors = path.join(subDir, '_errors.json');
      if (fs.existsSync(subErrors)) {
        fs.unlinkSync(subErrors);
      }
    }

    const summaryPath = path.join(baseDir, '_summary.json');
    if (fs.existsSync(summaryPath)) {
      const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf-8'));
      summary.collectedEndpoints = QUICK_ENDPOINTS.map((ep) => ({
        endpoint: ep.id,
        status: 'error',
        durationMs: 0,
        recordCount: 0,
      }));
      summary.metrics = summary.metrics ?? {};
      summary.metrics.totalEndpoints = QUICK_ENDPOINTS.length;
      summary.metrics.successfulEndpoints = 0;
      summary.metrics.failedEndpoints = QUICK_ENDPOINTS.length;
      fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
    }

    console.log('Backfilled', assessmentId);
  }
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
