const { createSocket } = require('node:dgram');

// Controlled TXT transport, also used by the original ownership storage qualifier.
// The production resolver still performs the lookup; no proof result is injected.
async function ownershipDnsFixture() {
  const records = new Map(),
    queries = [];
  const server = createSocket('udp4');
  let unavailable = false;
  server.on('message', (query, address) => {
    let offset = 12;
    const labels = [];
    while (query[offset]) {
      const size = query[offset++];
      labels.push(query.subarray(offset, offset + size).toString());
      offset += size;
    }
    offset += 5;
    const name = labels.join('.');
    queries.push(name);
    const value = unavailable ? undefined : records.get(name);
    const header = Buffer.alloc(12);
    header.writeUInt16BE(query.readUInt16BE(0), 0);
    header.writeUInt16BE(unavailable ? 0x8182 : 0x8180, 2);
    header.writeUInt16BE(1, 4);
    header.writeUInt16BE(value === undefined ? 0 : 1, 6);
    const parts = [header, query.subarray(12, offset)];
    if (value !== undefined) {
      const bytes = Buffer.from(value);
      const answer = Buffer.alloc(13);
      answer.writeUInt16BE(0xc00c, 0);
      answer.writeUInt16BE(16, 2);
      answer.writeUInt16BE(1, 4);
      answer.writeUInt32BE(1, 6);
      answer.writeUInt16BE(bytes.length + 1, 10);
      answer.writeUInt8(bytes.length, 12);
      parts.push(answer, bytes);
    }
    server.send(Buffer.concat(parts), address.port, address.address);
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.bind(0, '127.0.0.1', resolve);
  });
  return {
    server,
    records,
    queries,
    address: '127.0.0.1:' + server.address().port,
    fail: (value) => {
      unavailable = value;
    },
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

module.exports = { ownershipDnsFixture };
