// Repository sanity checks: `npm run verify`.
// Confirms that documentation, configuration and code agree with each other and that no secrets are committed.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => readFileSync(path.join(root, file), 'utf8');
const failures = [];
const check = (label, ok, detail = '') => {
  console.log(`${ok ? '  ok  ' : ' FAIL '} ${label}${!ok && detail ? `\n         ${detail}` : ''}`);
  if (!ok) failures.push(label);
};

const SKIP_DIRS = new Set(['node_modules', 'dist', 'dist.previous', 'data', 'logs', 'logs-test', '.git', 'plugins']);
// Generated service wrappers live in <root>/services; src/services is source code and must be scanned.
const isGeneratedServicesDir = (full) => path.relative(root, full) === 'services';
function* walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      const full = path.join(dir, entry.name);
      if (!SKIP_DIRS.has(entry.name) && !isGeneratedServicesDir(full)) yield* walk(full);
    } else {
      yield path.join(dir, entry.name);
    }
  }
}
const isText = (file) => /\.(ts|js|mjs|json|md|yml|yaml|ps1|xml|template|txt|service|example)$/i.test(file) || /(Dockerfile|\.gitignore|\.dockerignore|\.npmrc)$/.test(file);
const files = [...walk(root)].filter((f) => isText(f) && !/package-lock\.json$/.test(f));

console.log('Required files');
for (const file of ['README.md', 'LICENSE', '.gitignore', '.env.example', 'CONTRIBUTING.md', 'SECURITY.md', 'Dockerfile', 'docker-compose.yml',
  'lavalink/application.yml', 'lavalink/start-lavalink.ps1', 'docs/WINDOWS-SERVER.md', 'branding/logo.png', 'branding/banner.png',
  'branding/logo-prompt.txt', 'branding/banner-prompt.txt', 'scripts/setup-windows.ps1', 'scripts/install-services.ps1',
  'scripts/uninstall-services.ps1', 'scripts/start-services.ps1', 'scripts/stop-services.ps1', 'scripts/restart-services.ps1',
  'scripts/status.ps1', 'scripts/update-bot.ps1']) {
  check(file, existsSync(path.join(root, file)));
}

console.log('\nEnvironment variables');
const exampleKeys = [...read('.env.example').matchAll(/^([A-Z][A-Z0-9_]*)=/gm)].map((m) => m[1]);
const envSource = read('src/config/env.ts');
const schemaKeys = [...envSource.matchAll(/^\s{2}([A-Z][A-Z0-9_]*):/gm)].map((m) => m[1]);
const lavalinkOnly = new Set(['LAVALINK_MEMORY', 'SPOTIFY_ENABLED', 'SPOTIFY_CLIENT_ID', 'SPOTIFY_CLIENT_SECRET', 'SPOTIFY_COUNTRY_CODE', 'YOUTUBE_OAUTH_ENABLED', 'YOUTUBE_OAUTH_REFRESH_TOKEN']);
const missingInExample = schemaKeys.filter((k) => !exampleKeys.includes(k));
check('every variable the bot validates is listed in .env.example', missingInExample.length === 0, missingInExample.join(', '));
const unknown = exampleKeys.filter((k) => !schemaKeys.includes(k) && !lavalinkOnly.has(k));
check('every .env.example variable is used by the bot or Lavalink', unknown.length === 0, unknown.join(', '));
const yml = read('lavalink/application.yml');
const ymlMissing = [...lavalinkOnly].filter((k) => k !== 'LAVALINK_MEMORY' && !yml.includes(`\${${k}`));
check('Lavalink-only variables are consumed by application.yml', ymlMissing.length === 0, ymlMissing.join(', '));
const readme = read('README.md');
const undocumented = exampleKeys.filter((k) => !readme.includes(k));
check('every variable is documented in the README', undocumented.length === 0, undocumented.join(', '));
const exampleText = read('.env.example');
check('.env.example holds placeholders only (no real-looking token)', !/[A-Za-z0-9_-]{23,28}\.[A-Za-z0-9_-]{6,7}\.[A-Za-z0-9_-]{27,}/.test(exampleText));

console.log('\nCommands');
const commandDir = path.join(root, 'src/commands');
const commandNames = [];
for (const file of walk(commandDir)) {
  const match = /\.setName\('([a-z-]+)'\)/.exec(readFileSync(file, 'utf8'));
  if (match && !file.endsWith('settings.ts') && !file.endsWith('setup.ts')) commandNames.push(match[1]);
  if (file.endsWith('settings.ts')) commandNames.push('settings');
  if (file.endsWith('setup.ts')) commandNames.push('setup');
}
const missingInReadme = [...new Set(commandNames)].filter((name) => !readme.includes(`/${name}`));
check(`all ${new Set(commandNames).size} commands are documented in the README`, missingInReadme.length === 0, missingInReadme.join(', '));

console.log('\nScripts');
const pkg = JSON.parse(read('package.json'));
for (const script of ['dev', 'build', 'start', 'lint', 'test']) check(`npm run ${script} exists`, typeof pkg.scripts?.[script] === 'string');
check('production start uses the compiled build', /dist\/index\.js/.test(pkg.scripts.start ?? '') && !/tsx/.test(pkg.scripts.start ?? ''));
const readmeScripts = [...readme.matchAll(/`npm run ([\w:-]+)/g)].map((m) => m[1]);
const unknownScripts = readmeScripts.filter((s) => !(s in pkg.scripts));
check('every npm script mentioned in the README exists', unknownScripts.length === 0, unknownScripts.join(', '));
check('no test or dev tooling is a runtime dependency', !Object.keys(pkg.dependencies ?? {}).some((d) => /vitest|eslint|tsx|typescript|pino-pretty/.test(d)));

console.log('\nHygiene');
const secretPattern = /[A-Za-z0-9_-]{23,28}\.[A-Za-z0-9_-]{6,7}\.[A-Za-z0-9_-]{27,}/;
const leaked = files.filter((f) => !/\.test\.ts$/.test(f) && secretPattern.test(readFileSync(f, 'utf8')));
check('no Discord-token-shaped strings in the source tree', leaked.length === 0, leaked.map((f) => path.relative(root, f)).join(', '));
const todoPattern = /\b(TODO|FIXME|XXX|HACK)\b/;
const todos = files.filter((f) => !/verify-project\.mjs$/.test(f) && !/\.md$/.test(f) && todoPattern.test(readFileSync(f, 'utf8')));
check('no TODO/FIXME markers left', todos.length === 0, todos.map((f) => path.relative(root, f)).join(', '));
check('.env is git-ignored', /^\.env$/m.test(read('.gitignore')));
const bigFiles = files.filter((f) => statSync(f).size > 500_000);
check('no unexpectedly large text files', bigFiles.length === 0, bigFiles.join(', '));

console.log(failures.length === 0 ? '\nAll checks passed.' : `\n${failures.length} check(s) failed.`);
process.exit(failures.length === 0 ? 0 : 1);
