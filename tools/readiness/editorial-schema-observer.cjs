/* Read-only metadata observation for the bounded fresh-initialization investigation. */
const { MysqlQueryRunner } = require('typeorm/driver/mysql/MysqlQueryRunner');
const getTable = MysqlQueryRunner.prototype.getTable;
MysqlQueryRunner.prototype.getTable = async function (...args) {
  const table = await getTable.apply(this, args);
  if (table?.name === 'application_image_cleanup')
    process.send?.({
      schema: table.name,
      columns: table.columns.map(
        ({ name, type, length, isNullable, unsigned, isPrimary }) => ({
          name,
          type,
          length,
          isNullable,
          unsigned,
          isPrimary,
        })
      ),
      indices: table.indices.map(({ name, columnNames, isUnique }) => ({
        name,
        columnNames,
        isUnique,
      })),
    });
  return table;
};
process.channel?.unref();
