const { suiteParityServices } = require('./suite-parity-services.cjs');
const { ownershipDnsFixture } = require('./ownership-dns-fixture.cjs');

// Reuse the isolated Editorial/broker lifecycle; releases do not require media.
async function releaseParityServices(options) {
  const dns = await ownershipDnsFixture();
  try {
    const services = await suiteParityServices({
      ...options,
      env: { ...options.env, EDITORIAL_OWNERSHIP_DNS_SERVERS: dns.address },
    });
    return {
      ...services,
      dns,
      close: async () => {
        try {
          await services.close();
        } finally {
          await dns.close();
        }
      },
    };
  } catch (error) {
    await dns.close();
    throw error;
  }
}

module.exports = { releaseParityServices };
