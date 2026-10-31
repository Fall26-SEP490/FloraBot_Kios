// Read an actual /openapi/v1.json export from FloraBot.Api, preserving the main
// kiosk contract snapshot (which may be from a newer backend branch).
import { readFileSync, writeFileSync } from 'node:fs';
const source = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const paths = Object.fromEntries(Object.entries(source.paths).filter(([path]) => path.includes('/pickup-otp')));
if (Object.keys(paths).length !== 3) throw new Error('Expected the three preorder email pickup operations');
const schemas = {};
function collect(value) {
  if (!value || typeof value !== 'object') return;
  if (typeof value.$ref === 'string' && value.$ref.startsWith('#/components/schemas/')) {
    const name = value.$ref.split('/').at(-1);
    if (!(name in schemas)) {
      schemas[name] = source.components.schemas[name];
      collect(schemas[name]);
    }
  }
  for (const child of Object.values(value)) collect(child);
}
collect(paths);
writeFileSync(new URL('./openapi-pickup-otp.json', import.meta.url), JSON.stringify({
  openapi: source.openapi, info: source.info, paths, components: { schemas },
}, null, 2) + '\n');
