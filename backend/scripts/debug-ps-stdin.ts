import { spawn } from 'child_process';

const ps = spawn('powershell.exe', ['-NoProfile', '-Command', '-'], {
  stdio: ['pipe', 'pipe', 'pipe'],
});

ps.stdout!.setEncoding('utf8');
ps.stderr!.setEncoding('utf8');

ps.stdout!.on('data', (d: string) => process.stdout.write(`OUT: ${d}`));
ps.stderr!.on('data', (d: string) => process.stdout.write(`ERR: ${d}`));

ps.stdin!.write('Import-Module ExchangeOnlineManagement -ErrorAction Stop\n');
setTimeout(() => {
  const wrapped = 'try {\n  Get-AntiPhishPolicy | ConvertTo-Json -Depth 10\n  Write-Output "<<<MARK>>>"\n} catch {\n  Write-Output "<<<MARK>>>"\n  Write-Error $_.Exception.Message\n}';
  console.log(`writing wrapped: ${JSON.stringify(wrapped)}`);
  ps.stdin!.write(wrapped + '\n');
  setTimeout(() => {
    ps.kill();
    process.exit(0);
  }, 60000);
}, 15000);
