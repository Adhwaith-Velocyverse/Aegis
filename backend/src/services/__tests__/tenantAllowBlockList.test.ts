import { describe, it, expect } from 'vitest';
import { evaluateEmailSecurityControl, EMAIL_SECURITY_CONTROLS } from '../emailSecurityEvaluator';

describe('Tenant Allow/Block List (merged view)', () => {
  const data = {
    'tenant-allow-block-list-urls': [
      { Value: 'https://bad1.example', ListType: 'Url' },
      { Value: 'https://bad2.example', ListType: 'Url' },
    ],
    'tenant-allow-block-list-senders': [
      { Value: 'spammer@example.com', ListType: 'Sender' },
    ],
    'tenant-allow-block-list-domains': [
      { Value: 'baddomain.com', ListType: 'Fqdn' },
    ],
    'tenant-allow-block-list-filehashes': [
      { Value: 'abc123', ListType: 'FileHash' },
      { Value: 'def456', ListType: 'FileHash' },
    ],
  };

  it('cm-13 totals all merged items', () => {
    const merged = [
      ...data['tenant-allow-block-list-urls'],
      ...data['tenant-allow-block-list-senders'],
      ...data['tenant-allow-block-list-domains'],
      ...data['tenant-allow-block-list-filehashes'],
    ];
    const result = evaluateEmailSecurityControl('email-cm-13', { 'tenant-allow-block-list-items': merged, ...data }, []);
    expect(result?.result).toBe('info');
    expect(result?.details?.count).toBe(6);
  });

  it('cm-14 counts only URLs even when the data object has all 4 lists', () => {
    const result = evaluateEmailSecurityControl('email-cm-14', data, []);
    expect(result?.result).toBe('info');
    expect(result?.details?.count).toBe(2);
  });

  it('cm-15 counts only Senders', () => {
    const result = evaluateEmailSecurityControl('email-cm-15', data, []);
    expect(result?.result).toBe('info');
    expect(result?.details?.count).toBe(1);
  });

  it('cm-17 counts only File hashes', () => {
    const result = evaluateEmailSecurityControl('email-cm-17', data, []);
    expect(result?.result).toBe('info');
    expect(result?.details?.count).toBe(2);
  });

  it('cm-14 still filters out non-URL items even if the array contains them', () => {
    const polluted = {
      'tenant-allow-block-list-urls': [
        { Value: 'https://ok.example', ListType: 'Url' },
        { Value: 'spammer@x.com', ListType: 'Sender' },
      ],
    };
    const result = evaluateEmailSecurityControl('email-cm-14', polluted, []);
    expect(result?.details?.count).toBe(1);
  });

  it('returns 0 when the relevant filtered list is missing', () => {
    const result = evaluateEmailSecurityControl('email-cm-14', { 'tenant-allow-block-list-urls': undefined as any }, []);
    expect(result?.result).toBe('info');
    expect(result?.details?.count).toBe(0);
  });
});
