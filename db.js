const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

function dbPath() {
  return process.env.SMARTRENT_TEST_DB || path.join(__dirname, 'data', 'smartrent.sqlite');
}

function init() {
  fs.mkdirSync(path.dirname(dbPath()), { recursive: true });
  const db = new Database(dbPath());
  db.pragma('journal_mode = WAL');

  const migration1 = fs.readFileSync(
    path.join(__dirname, 'migrations', '001_initial.sql'),
    'utf8'
  );
  db.exec(migration1);

  const migration2 = fs.readFileSync(
    path.join(__dirname, 'migrations', '002_allowed_contacts.sql'),
    'utf8'
  );
  db.exec(migration2);

  const migration3 = fs.readFileSync(
    path.join(__dirname, 'migrations', '003_visits.sql'),
    'utf8'
  );
  db.exec(migration3);

  const migration4 = fs.readFileSync(
    path.join(__dirname, 'migrations', '004_organizations.sql'),
    'utf8'
  );
  db.exec(migration4);

  const migration5 = fs.readFileSync(
    path.join(__dirname, 'migrations', '005_profiles.sql'),
    'utf8'
  );
  db.exec(migration5);

  const migration6 = fs.readFileSync(
    path.join(__dirname, 'migrations', '006_memberships.sql'),
    'utf8'
  );
  db.exec(migration6);

  const migration7 = fs.readFileSync(
    path.join(__dirname, 'migrations', '007_properties.sql'),
    'utf8'
  );
  try {
    db.exec(migration7);
  } catch (e) {
    if (!e.message.includes('duplicate column name')) throw e;
  }

  const migration8 = fs.readFileSync(
    path.join(__dirname, 'migrations', '008_property_images.sql'),
    'utf8'
  );
  db.exec(migration8);

  const migration9 = fs.readFileSync(
    path.join(__dirname, 'migrations', '009_conversations.sql'),
    'utf8'
  );
  db.exec(migration9);

  const migration10 = fs.readFileSync(
    path.join(__dirname, 'migrations', '010_messages.sql'),
    'utf8'
  );
  db.exec(migration10);

  const migration11 = fs.readFileSync(
    path.join(__dirname, 'migrations', '011_tenant_requirements.sql'),
    'utf8'
  );
  db.exec(migration11);

  const migration12 = fs.readFileSync(
    path.join(__dirname, 'migrations', '012_leads.sql'),
    'utf8'
  );
  db.exec(migration12);

  const migration13 = fs.readFileSync(
    path.join(__dirname, 'migrations', '013_visits.sql'),
    'utf8'
  );
  db.exec(migration13);

  const migration14 = fs.readFileSync(
    path.join(__dirname, 'migrations', '014_subscriptions.sql'),
    'utf8'
  );
  db.exec(migration14);

  const migration15 = fs.readFileSync(
    path.join(__dirname, 'migrations', '015_usage_logs.sql'),
    'utf8'
  );
  db.exec(migration15);

  const migration16 = fs.readFileSync(
    path.join(__dirname, 'migrations', '016_webhook_events.sql'),
    'utf8'
  );
  db.exec(migration16);

  const migration17 = fs.readFileSync(
    path.join(__dirname, 'migrations', '017_audit_logs.sql'),
    'utf8'
  );
  db.exec(migration17);

  const migration18 = fs.readFileSync(
    path.join(__dirname, 'migrations', '018_rls_policies.sql'),
    'utf8'
  );
  try {
    db.exec(migration18);
  } catch (e) {
    if (!e.message.includes('duplicate column name')) throw e;
  }

  const migration19 = fs.readFileSync(
    path.join(__dirname, 'migrations', '019_subscription_plans.sql'),
    'utf8'
  );
  try {
    db.exec(migration19);
  } catch (e) {
    if (!e.message.includes('duplicate column name')) throw e;
  }

  return db;
}

module.exports = { init, dbPath };
