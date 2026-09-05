import { readFileSync, writeFileSync, copyFileSync } from 'node:fs';

// Both policies query data.authority. Merge the role facts at that root rather
// than loading two bundles with overlapping roots or nesting their data.
const authority = { permissions_by_role: {}, roles_by_identity: {} };
for (const name of ['discussion', 'identity-admin']) {
  const data = JSON.parse(readFileSync(`/bundles/${name}/data.json`, 'utf8'));
  for (const section of Object.keys(authority)) {
    for (const [key, values] of Object.entries(data.authority[section] ?? {})) {
      authority[section][key] = [...new Set([...(authority[section][key] ?? []), ...values])];
    }
  }
  copyFileSync(`/bundles/${name}/policy.rego`, `/policies/${name}.rego`);
}
writeFileSync('/policies/data.json', JSON.stringify({ authority }));
