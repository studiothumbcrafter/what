const assert = require('assert');
const path = require('path');
const fs = require('fs');
const os = require('os');

const tmpDb = path.join(os.tmpdir(), `smartrent-test-wa-${Date.now()}.sqlite`);
process.env.SMARTRENT_TEST_DB = tmpDb;

const { init } = require('../db');
const db = init();
const Customer = require('../models/Customer');
Customer.setDatabase(db);
const Media = require('../models/Media');
Media.setDatabase(db);
const Property = require('../models/Property');
Property.setDatabase(db);
const { setDatabase: waSetDatabase, handleMessage } = require('../services/whatsapp');
waSetDatabase(db);

const sent = [];
const mockClient = {
  sendMessage: async (phone, text, opts) => { sent.push({ phone, text, opts }); },
};
const wa = require('../services/whatsapp');
wa.setClient(mockClient);

async function main() {
  await Property.create({ title: '2BHK Bandra', rent: 12000, location: 'Bandra, Mumbai', bedrooms: 2, bathrooms: 2, furnishing: 'furnished', parking: 1, balcony: 1, floor: 3, facilities: 'Lift,Security', availability_date: '2026-12-01', info: 'x', status: 'available' });
  const all = await Property.getAll();
  const propId = all[0].id;
  await Media.add(propId, 'photo', '/uploads/photos/real.jpg');

  try {
    // Step 1: incomplete -> asks budget
    sent.length = 0;
    await handleMessage('+911111111111', 'I need a house in mumbai', {});
    assert.strictEqual(await Customer.getState('+911111111111'), 'collecting');
    assert.ok(sent.length >= 1, 'should reply');
    const last = sent[sent.length - 1].text;
    assert.ok(/budget/i.test(last), 'should ask about budget, got: ' + last);

    // Step 2: provide budget -> asks bedrooms
    sent.length = 0;
    await handleMessage('+911111111111', 'my budget is 12000', {});
    const last2 = sent[sent.length - 1].text;
    assert.ok(/bedroom|bhk/i.test(last2), 'should ask bedrooms, got: ' + last2);

    // Step 3: provide bedrooms -> now complete -> match
    sent.length = 0;
    await handleMessage('+911111111111', 'i need 2 bedroom', {});
    const replies = sent.map(s => s.text).join('\n');
    assert.ok(/2BHK Bandra/.test(replies), 'should show the matching property, got: ' + replies);
    assert.ok(/Within your budget/.test(replies) || /Within your budget of ₹12000/.test(replies), 'should mention budget match');

    console.log('PASS: whatsapp flow tests');
    for (const s of sent) console.log(' -', s.text.slice(0, 80));
  } catch (err) {
    console.error('FAIL: whatsapp flow tests', err.message);
    try { fs.unlinkSync(tmpDb); } catch (e) {}
    process.exit(1);
  }

  try { fs.unlinkSync(tmpDb); } catch (e) {}
}

module.exports = main();
