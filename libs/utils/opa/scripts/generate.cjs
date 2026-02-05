/* eslint-disable @typescript-eslint/no-var-requires */
// CommonJS runner that loads TypeScript policy definitions.
// Uses SWC to transpile TS on the fly (no ESM loader headaches).

require('@swc-node/register');

const fs = require('node:fs');
const path = require('node:path');

/** @type {{ discussionPolicy: import('../src/types').DiscussionPolicyDefinition }} */
const { discussionPolicy } = require('../src/discussion.policy');

function workspaceRoot() {
  // scripts are under libs/utils/opa/scripts -> workspace root is 4 levels up
  return path.resolve(__dirname, '..', '..', '..', '..');
}

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function writeFile(p, contents) {
  fs.writeFileSync(p, contents, 'utf8');
}

function jsonStable(obj) {
  return JSON.stringify(obj, null, 2) + '\n';
}

function renderDiscussionBundle(def) {
  const data = {
    authority: {
      permissions_by_role: def.rolePermissions,
      roles_by_identity: def.rolesByIdentityExample ?? {},
    },
  };

  const supportedActionsSet = def.supportedActions
    .map((a) => `    ${JSON.stringify(a)},`)
    .join('\n');

  const constrainedActions = Object.keys(def.resourceConstraints ?? {});
  const constrainedActionsSet = constrainedActions.map((a) => JSON.stringify(a)).join(', ');

  let rego = [
    '# GENERATED FILE. DO NOT EDIT MANUALLY.',
    '# Source: libs/utils/opa/src/discussion.policy.ts',
    `package ${def.packageName}`,
    '',
    'default allow := false',
    '',
    '# Optional deny reasons (useful for debugging and audit logs).',
    'deny contains msg if {',
    '  not has_identity',
    '  msg := "missing_identity"',
    '}',
    '',
    'deny contains msg if {',
    '  has_identity',
    '  action := requested_action',
    '  not supported_action(action)',
    '  msg := sprintf("unsupported_action:%s", [action])',
    '}',
    '',
    'deny contains msg if {',
    '  has_identity',
    '  action := requested_action',
    '  supported_action(action)',
    '  not action_permitted(action)',
    '  msg := sprintf("forbidden:%s", [action])',
    '}',
    '',
    ...(constrainedActions.length
      ? [
          'deny contains msg if {',
          '  has_identity',
          '  action := requested_action',
          `  action in {${constrainedActionsSet}}`,
          '  not resource_constraints_ok(action)',
          '  msg := sprintf("invalid_resource:%s", [action])',
          '}',
          '',
        ]
      : []),
    'allow if {',
    '  has_identity',
    '  action := requested_action',
    '  supported_action(action)',
    '  action_permitted(action)',
    '  resource_constraints_ok(action)',
    '}',
    '',
    '### Input helpers',
    '',
    'has_identity if {',
    '  input.identityId != ""',
    '}',
    '',
    'requested_action := a if { a := input.action } else := a if { a := input.actionName }',
    '',
    'supported_action(a) if {',
    '  a in {',
    supportedActionsSet,
    '  }',
    '}',
    '',
    '### Role/permission checks',
    '',
    'action_permitted(action) if {',
    '  "admin" in subject_roles',
    '}',
    '',
    'action_permitted(action) if {',
    '  some r in subject_roles',
    '  perms := data.authority.permissions_by_role[r]',
    '  "*" in perms',
    '}',
    '',
    'action_permitted(action) if {',
    '  some r in subject_roles',
    '  perms := data.authority.permissions_by_role[r]',
    '  action in perms',
    '}',
    '',
    'subject_roles := roles if {',
    '  roles := input.subject.roles',
    '} else := roles if {',
    '  roles := data.authority.roles_by_identity[input.identityId]',
    '} else := []',
    '',
    '### Resource constraints',
    '',
  ].join('\n');

  if (constrainedActions.length) {
    rego += `resource_constraints_ok(action) if {\n  not action in {${constrainedActionsSet}}\n}\n\n`;
  } else {
    rego += 'resource_constraints_ok(action) if {\n  true\n}\n\n';
  }

  for (const [action, c] of Object.entries(def.resourceConstraints ?? {})) {
    rego += `resource_constraints_ok(${JSON.stringify(action)}) if {\n`;
    rego += `  input.resource.type == ${JSON.stringify(c.type)}\n`;
    if (c.requireId) rego += '  input.resource.id != ""\n';

    if (c.tenantMustMatchInput) {
      rego += '  not input.resource.tenantId\n';
      rego += '}\n\n';
      rego += `resource_constraints_ok(${JSON.stringify(action)}) if {\n`;
      rego += `  input.resource.type == ${JSON.stringify(c.type)}\n`;
      if (c.requireId) rego += '  input.resource.id != ""\n';
      rego += '  input.resource.tenantId == input.tenantId\n';
      rego += '}\n\n';
      continue;
    }

    rego += '}\n\n';
  }

  return { data, rego };
}

function main() {
  const root = workspaceRoot();
  const outDirs = [
    // Source-of-truth bundle (developer-facing).
    path.join(root, 'libs', 'utils', 'opa', 'bundles', 'discussion'),
    // Deployment bundle (GitOps, ArgoCD-managed).
    path.join(root, 'platform', 'cluster', 'opa', 'bundles', 'discussion'),
  ];
  for (const dir of outDirs) ensureDir(dir);

  const rendered = renderDiscussionBundle(discussionPolicy);
  for (const dir of outDirs) {
    writeFile(path.join(dir, 'data.json'), jsonStable(rendered.data));
    writeFile(path.join(dir, 'policy.rego'), rendered.rego);
  }
}

main();

