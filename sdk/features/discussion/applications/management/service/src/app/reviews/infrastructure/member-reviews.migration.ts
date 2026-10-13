import type { MigrationInterface, QueryRunner } from 'typeorm';

type Column = [string, string, boolean?];
type Key = { name: string; columns: string[]; unique?: boolean };
type Table = {
  name: string;
  columns: Column[];
  keys: Key[];
  checks?: Record<string, string>;
};
const scope: Column[] = [
  ['tenantId', 'varchar(128)'],
  ['applicationId', 'varchar(36)'],
];
const primary = (...columns: string[]): Key => ({
  name: 'PRIMARY',
  columns,
  unique: true,
});
const tables: Table[] = [
  {
    name: 'review_applications',
    columns: [...scope, ['revision', 'bigint unsigned']],
    keys: [primary('tenantId', 'applicationId')],
  },
  {
    name: 'member_reviews',
    columns: [
      ['id', 'varchar(36)'],
      ...scope,
      ['ownerId', 'varchar(128)'],
      ['revision', 'bigint unsigned'],
      ['contentRevision', 'bigint unsigned'],
      ['withdrawn', 'tinyint unsigned'],
      ['hidden', 'tinyint unsigned'],
      ['moderationReason', 'varchar(1000)', true],
      ['createdAt', 'bigint unsigned'],
      ['updatedAt', 'bigint unsigned'],
    ],
    keys: [
      primary('id'),
      {
        name: 'uq_review_author',
        columns: ['tenantId', 'applicationId', 'ownerId'],
        unique: true,
      },
      {
        name: 'idx_review_public',
        columns: [
          'tenantId',
          'applicationId',
          'hidden',
          'withdrawn',
          'createdAt DESC',
          'id',
        ],
      },
      {
        name: 'idx_review_all',
        columns: ['tenantId', 'applicationId', 'createdAt DESC', 'id'],
      },
    ],
    checks: {
      ck_review_state: 'withdrawn IN (0, 1) AND hidden IN (0, 1)',
      ck_review_revision: 'contentRevision > 0 AND revision >= contentRevision',
    },
  },
  {
    name: 'review_versions',
    columns: [
      ['reviewId', 'varchar(36)'],
      ['revision', 'bigint unsigned'],
      ['displayName', 'varchar(80)'],
      ['rating', 'tinyint unsigned'],
      ['text', 'text'],
    ],
    keys: [primary('reviewId', 'revision')],
    checks: {
      ck_review_rating: 'rating BETWEEN 1 AND 5',
      ck_review_text: 'CHAR_LENGTH(text) BETWEEN 1 AND 6000',
    },
  },
  {
    name: 'review_helpful',
    columns: [
      ['reviewId', 'varchar(36)'],
      ['actorId', 'varchar(128)'],
      ['createdAt', 'bigint unsigned'],
    ],
    keys: [primary('reviewId', 'actorId')],
  },
  {
    name: 'review_reports',
    columns: [
      ['id', 'varchar(36)'],
      ['reviewId', 'varchar(36)'],
      ['actorId', 'varchar(128)'],
      ['contentRevision', 'bigint unsigned'],
      ['reason', 'varchar(1000)'],
      ['createdAt', 'bigint unsigned'],
      ['resolution', 'varchar(16)'],
      ['resolvedAt', 'bigint unsigned', true],
      ['resolutionReason', 'varchar(1000)', true],
    ],
    keys: [
      primary('id'),
      {
        name: 'uq_review_report',
        columns: ['reviewId', 'actorId', 'contentRevision'],
        unique: true,
      },
      {
        name: 'idx_review_reports',
        columns: ['reviewId', 'createdAt DESC', 'id'],
      },
    ],
    checks: {
      ck_review_report_resolution:
        "resolution IN ('open', 'dismissed', 'hidden')",
    },
  },
  {
    name: 'review_commands',
    columns: [
      ...scope,
      ['actorId', 'varchar(128)'],
      ['commandKey', 'varchar(128)'],
      ['fingerprint', 'varchar(64)'],
      ['reviewId', 'varchar(36)'],
      ['revision', 'bigint unsigned'],
      ['createdAt', 'bigint unsigned'],
    ],
    keys: [primary('tenantId', 'applicationId', 'actorId', 'commandKey')],
  },
  {
    name: 'review_events',
    columns: [
      ['reviewId', 'varchar(36)'],
      ['revision', 'bigint unsigned'],
      ...scope,
      ['contentRevision', 'bigint unsigned'],
      ['actorId', 'varchar(128)'],
      ['type', 'varchar(16)'],
      ['reason', 'varchar(1000)', true],
      ['createdAt', 'bigint unsigned'],
    ],
    keys: [
      primary('reviewId', 'revision'),
      {
        name: 'idx_review_events',
        columns: [
          'tenantId',
          'applicationId',
          'createdAt',
          'reviewId',
          'revision',
        ],
      },
    ],
  },
];

export const reviewErasureIndexes = [
  ['member_reviews', 'idx_review_owner', ['ownerId', 'id']],
  ['review_helpful', 'idx_helpful_actor', ['actorId', 'reviewId']],
  ['review_reports', 'idx_report_actor', ['actorId', 'id']],
  [
    'review_reports',
    'idx_report_resolution',
    ['reviewId', 'resolutionRevision', 'id'],
  ],
  [
    'review_reports',
    'idx_report_version',
    ['reviewId', 'contentRevision', 'id'],
  ],
  [
    'review_commands',
    'idx_review_command_actor',
    ['actorId', 'tenantId', 'applicationId', 'commandKey'],
  ],
  ['review_commands', 'idx_review_command_history', ['reviewId', 'revision']],
  [
    'review_events',
    'idx_review_event_actor',
    ['actorId', 'reviewId', 'revision'],
  ],
  ['review_events', 'idx_review_event_type', ['reviewId', 'type', 'revision']],
] as const;

export const reviewErasureChecks = {
  ck_review_erased:
    '(erasedAt IS NULL AND contentRevision IS NOT NULL) OR (erasedAt IS NOT NULL AND erasedAt > 0 AND ownerId IS NULL AND contentRevision IS NULL AND withdrawn=1 AND moderationReason IS NULL)',
  ck_review_resolution_revision:
    "(resolution='open' AND resolutionRevision IS NULL AND resolvedAt IS NULL AND resolutionReason IS NULL) OR (resolution<>'open' AND resolutionRevision IS NOT NULL AND resolutionRevision>0 AND resolvedAt IS NOT NULL)",
};

function schema(erasure: boolean): Table[] {
  if (!erasure) return tables;
  return [
    ...tables.map(
      (table): Table => ({
        ...table,
        columns: table.columns
          .map(
            ([name, type, nullable]): Column => [
              name,
              type,
              table.name === 'member_reviews' &&
              ['ownerId', 'contentRevision'].includes(name)
                ? true
                : nullable,
            ]
          )
          .concat(
            table.name === 'member_reviews'
              ? [['erasedAt', 'bigint unsigned', true]]
              : table.name === 'review_reports'
              ? [['resolutionRevision', 'bigint unsigned', true]]
              : []
          ),
        keys: [
          ...table.keys,
          ...reviewErasureIndexes
            .filter(([name]) => name === table.name)
            .map(([, name, columns]) => ({ name, columns: [...columns] })),
        ],
        checks: {
          ...table.checks,
          ...(table.name === 'member_reviews'
            ? { ck_review_erased: reviewErasureChecks.ck_review_erased }
            : {}),
          ...(table.name === 'review_reports'
            ? {
                ck_review_resolution_revision:
                  reviewErasureChecks.ck_review_resolution_revision,
              }
            : {}),
        },
      })
    ),
    {
      name: 'review_erasure_targets',
      columns: [
        ['identityId', 'varchar(128)'],
        ['erasureRevision', 'bigint unsigned'],
        ['reviewId', 'varchar(36)'],
        ['cutoffRevision', 'bigint unsigned'],
      ],
      keys: [
        primary('identityId', 'reviewId'),
        { name: 'uq_review_erasure', columns: ['reviewId'], unique: true },
      ],
    },
  ];
}

/** Additive, restartable DDL. A completed migration must never recreate lost authority. */
export class MemberReviews1791676827000 implements MigrationInterface {
  transaction = false;

  async up(runner: QueryRunner, pendingErasureSchema = false): Promise<void> {
    const history =
      runner.connection.options.migrationsTableName ?? 'migrations';
    const completed = (await runner.hasTable(history))
      ? await runner.query(
          `SELECT id FROM ${runner.connection.driver.escape(
            history
          )} WHERE name = ?`,
          [this.constructor.name]
        )
      : [];
    const erasureHistory = (await runner.hasTable(history))
      ? await runner.query(
          `SELECT id FROM ${runner.connection.driver.escape(
            history
          )} WHERE name=?`,
          ['ReviewErasure1791840008000']
        )
      : [];
    // The successor validates its complete new shape before migration history is committed.
    const erasure = pendingErasureSchema || erasureHistory.length > 0;
    for (const table of schema(erasure)) {
      if (!(await runner.hasTable(table.name))) {
        if (completed.length)
          throw new Error(`Completed review table is missing: ${table.name}`);
        const columns = table.columns.map(
          ([name, type, nullable]) =>
            `\`${name}\` ${type} ${nullable ? 'NULL' : 'NOT NULL'}`
        );
        const keys = table.keys.map(
          (key) =>
            `${
              key.name === 'PRIMARY'
                ? 'PRIMARY KEY'
                : `${key.unique ? 'UNIQUE ' : ''}KEY ${key.name}`
            } (${key.columns.join(', ')})`
        );
        const checks = Object.entries(table.checks ?? {}).map(
          ([name, expression]) => `CONSTRAINT ${name} CHECK (${expression})`
        );
        await runner.query(
          `CREATE TABLE ${table.name} (${[...columns, ...keys, ...checks].join(
            ', '
          )}) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin`
        );
      }
      const columns: {
        name: string;
        type: string;
        nullable: string;
        collation: string | null;
        engine: string;
      }[] = await runner.query(
        `SELECT c.COLUMN_NAME AS name, c.COLUMN_TYPE AS type, c.IS_NULLABLE AS nullable,
         c.COLLATION_NAME AS collation, t.ENGINE AS engine FROM information_schema.COLUMNS c
         JOIN information_schema.TABLES t ON t.TABLE_SCHEMA=c.TABLE_SCHEMA AND t.TABLE_NAME=c.TABLE_NAME
         WHERE c.TABLE_SCHEMA=DATABASE() AND c.TABLE_NAME=? ORDER BY c.ORDINAL_POSITION`,
        [table.name]
      );
      if (
        columns.length !== table.columns.length ||
        columns.some((column, i) => {
          const [name, type, nullable] = table.columns[i];
          return (
            column.name !== name ||
            column.type !== type ||
            column.nullable !== (nullable ? 'YES' : 'NO') ||
            column.engine !== 'InnoDB' ||
            ((type.startsWith('varchar') || type === 'text') &&
              column.collation !== 'utf8mb4_bin')
          );
        })
      )
        throw new Error(`Incompatible review columns: ${table.name}`);
      for (const key of table.keys) {
        const actual: {
          name: string;
          direction: string;
          nonUnique: number;
          prefix: number | null;
        }[] = await runner.query(
          `SELECT COLUMN_NAME AS name, COLLATION AS direction, NON_UNIQUE AS nonUnique, SUB_PART AS prefix
           FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? AND INDEX_NAME=? ORDER BY SEQ_IN_INDEX`,
          [table.name, key.name]
        );
        if (
          actual.length !== key.columns.length ||
          actual.some(
            (column, i) =>
              `${column.name}${column.direction === 'D' ? ' DESC' : ''}` !==
                key.columns[i] ||
              Number(column.nonUnique) !== (key.unique ? 0 : 1) ||
              column.prefix !== null
          )
        )
          throw new Error(
            `Incompatible review index: ${table.name}.${key.name}`
          );
      }
      for (const [name, expression] of Object.entries(table.checks ?? {})) {
        const checks: { clause: string; enforced: string }[] =
          await runner.query(
            `SELECT c.CHECK_CLAUSE AS clause, t.ENFORCED AS enforced FROM information_schema.TABLE_CONSTRAINTS t
           JOIN information_schema.CHECK_CONSTRAINTS c ON c.CONSTRAINT_SCHEMA=t.CONSTRAINT_SCHEMA AND c.CONSTRAINT_NAME=t.CONSTRAINT_NAME
           WHERE t.TABLE_SCHEMA=DATABASE() AND t.TABLE_NAME=? AND t.CONSTRAINT_NAME=?`,
            [table.name, name]
          );
        const normalize = (value: string) =>
          value
            .replace(/\\'/g, "'")
            .split(/('[^']*')/)
            .map((part, index) =>
              index % 2
                ? part
                : part
                    .toLowerCase()
                    .replace(/_utf8mb4/g, '')
                    .replace(/[()\x60\s]/g, '')
            )
            .join('');
        if (
          checks.length !== 1 ||
          checks[0].enforced !== 'YES' ||
          normalize(checks[0].clause) !== normalize(expression)
        )
          throw new Error(`Incompatible review constraint: ${name}`);
      }
    }
    const invalid = await runner.query(`SELECT r.id FROM member_reviews r
      LEFT JOIN review_applications a ON a.tenantId=r.tenantId AND a.applicationId=r.applicationId
      LEFT JOIN review_versions v ON v.reviewId=r.id AND v.revision=r.contentRevision
      WHERE a.applicationId IS NULL OR ${
        erasure
          ? '(r.erasedAt IS NULL AND v.reviewId IS NULL)'
          : 'v.reviewId IS NULL'
      } OR r.revision < 1 OR r.createdAt < 1 OR r.updatedAt < r.createdAt
      ${
        erasure
          ? "OR (r.erasedAt IS NULL AND r.ownerId IS NULL AND v.displayName<>'Deleted account')"
          : ''
      } LIMIT 1`);
    if (invalid.length) throw new Error('Invalid review authority');
  }

  async down(): Promise<void> {
    throw new Error(
      'Use a reviewed data-preserving forward migration for member reviews'
    );
  }
}
