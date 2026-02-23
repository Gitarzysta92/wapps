import { MysqlClient } from './mysql';

describe('MysqlClient', () => {
  it('should work', () => {
    const client = new MysqlClient();
    expect(client).toBeInstanceOf(MysqlClient);
  });
});
