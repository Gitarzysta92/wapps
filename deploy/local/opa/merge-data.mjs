import {
  readFileSync,
  writeFileSync,
  copyFileSync,
  readdirSync,
} from 'node:fs';
import { join } from 'node:path';

const bundleDirectory = process.env.OPA_BUNDLE_DIRECTORY ?? '/bundles';
const policyDirectory = process.env.OPA_POLICY_DIRECTORY ?? '/policies';

// Policies share role facts under data.authority.
const authority = { permissions_by_role: {}, roles_by_identity: {} };
for (const name of ['discussion', 'identity-admin', 'editorial']) {
  const data = JSON.parse(
    readFileSync(join(bundleDirectory, name, 'data.json'), 'utf8')
  );
  for (const section of Object.keys(authority)) {
    for (const [key, values] of Object.entries(data.authority[section] ?? {})) {
      authority[section][key] = [
        ...new Set([...(authority[section][key] ?? []), ...values]),
      ];
    }
  }
  for (const file of readdirSync(join(bundleDirectory, name))) {
    if (!file.endsWith('.rego') || file.endsWith('_test.rego')) continue;
    copyFileSync(
      join(bundleDirectory, name, file),
      join(policyDirectory, `${name}-${file}`)
    );
  }
}
writeFileSync(
  join(policyDirectory, 'data.json'),
  JSON.stringify({ authority })
);
