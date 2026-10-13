// CommonJS runner that loads TypeScript policy definitions.
// Uses SWC to transpile TS on the fly (no ESM loader headaches).

require('@swc-node/register');

const fs = require('node:fs');
const path = require('node:path');

/** @type {{ discussionPolicy: import('../src/types').DiscussionPolicyDefinition }} */
const { discussionPolicy } = require('../src/discussion.policy');
/** @type {{ identityAdminPolicy: import('../src/types').DiscussionPolicyDefinition }} */
const { identityAdminPolicy } = require('../src/identity-admin.policy');
const { editorialPolicy } = require('../src/editorial.policy');
const { profileAudiencePolicy } = require('../src/profile-audience.policy');

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function writeFile(p, contents) {
  fs.writeFileSync(p, contents, 'utf8');
}

function jsonStable(obj) {
  return JSON.stringify(obj, null, 2) + '\n';
}

function renderPolicyBundle(def, sourceFileForHeader) {
  for (const action of def.selfActions ?? []) {
    if (
      !def.supportedActions.includes(action) ||
      !def.resourceConstraints?.[action]?.identityMustMatchInput
    )
      throw new Error(
        'Self actions require an explicit matching identity constraint'
      );
  }
  const data = {
    authority: {
      permissions_by_role: def.rolePermissions,
      roles_by_identity: {},
    },
  };

  const supportedActionsSet = def.supportedActions
    .map((a) => `    ${JSON.stringify(a)},`)
    .join('\n');

  const constrainedActions = Object.keys(def.resourceConstraints ?? {});
  const constrainedActionsSet = constrainedActions
    .map((a) => JSON.stringify(a))
    .join(', ');

  let rego = [
    '# GENERATED FILE. DO NOT EDIT MANUALLY.',
    `# Source: ${sourceFileForHeader}`,
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
    '  is_array(subject_roles)',
    '  every role in subject_roles { is_string(role) }',
    '  action := requested_action',
    '  supported_action(action)',
    '  action_permitted(action)',
    '  resource_constraints_ok(action)',
    '}',
    '',
    '### Input helpers',
    '',
    'has_identity if {',
    '  is_string(input.identityId)',
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
    ...((def.selfActions ?? []).length
      ? [
          'action_permitted(action) if {',
          `  action in {${def.selfActions
            .map((a) => JSON.stringify(a))
            .join(', ')}}`,
          '}',
          '',
        ]
      : []),
    'action_permitted(_) if {',
    '  "admin" in subject_roles',
    '}',
    '',
    'action_permitted(_) if {',
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
    rego += 'resource_constraints_ok(_) if {\n  true\n}\n\n';
  }

  for (const [action, c] of Object.entries(def.resourceConstraints ?? {})) {
    rego += `resource_constraints_ok(${JSON.stringify(action)}) if {\n`;
    rego += `  input.resource.type == ${JSON.stringify(c.type)}\n`;
    if (c.requireId)
      rego += '  is_string(input.resource.id)\n  input.resource.id != ""\n';
    if (c.exactId)
      rego += `  input.resource.id == ${JSON.stringify(c.exactId)}\n`;
    if (c.identityMustMatchInput)
      rego += '  input.resource.id == input.identityId\n';
    if (c.serviceOnly) {
      rego += `  input.identityId == ${JSON.stringify(
        c.serviceOnly.identityId
      )}\n`;
      rego += `  input.tenantId == ${JSON.stringify(c.serviceOnly.tenantId)}\n`;
      rego += `  input.subject.roles == [${JSON.stringify(
        c.serviceOnly.role
      )}]\n`;
    }

    if (c.tenantMustMatchInput) {
      rego += '  is_string(input.resource.tenantId)\n';
      rego += '  input.resource.tenantId != ""\n';
      rego += '  input.resource.tenantId == input.tenantId\n';
      rego += '}\n\n';
      continue;
    }

    rego += '}\n\n';
  }

  return { data, rego };
}

function main() {
  const policies = [
    {
      name: 'editorial',
      def: editorialPolicy,
      source:
        'sdk/features/identity/packages/infrastructure/opa/src/editorial.policy.ts',
    },
    {
      name: 'discussion',
      def: discussionPolicy,
      source:
        'sdk/features/identity/packages/infrastructure/opa/src/discussion.policy.ts',
    },
    {
      name: 'identity-admin',
      def: identityAdminPolicy,
      source:
        'sdk/features/identity/packages/infrastructure/opa/src/identity-admin.policy.ts',
    },
  ];

  for (const p of policies) {
    const outDirs = [
      // Source-of-truth bundle (developer-facing).
      path.resolve(__dirname, '../bundles', p.name),
    ];
    for (const dir of outDirs) ensureDir(dir);

    const rendered = renderPolicyBundle(p.def, p.source);
    for (const dir of outDirs) {
      writeFile(path.join(dir, 'data.json'), jsonStable(rendered.data));
      writeFile(path.join(dir, 'policy.rego'), rendered.rego);
    }
  }
  writeFile(
    path.resolve(__dirname, '../bundles/identity-admin/profile-audience.rego'),
    profileAudiencePolicy
  );
}

main();
