// PostgreSQL adapter with the same async surface as the SQLite wrapper:
// get(sql, params), all(sql, params), run(sql, params), exec(sql), transaction(fn).
// Named (@name) and positional (?) parameters are translated to $1..$n.

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

function normalizeDatabaseUrl(raw) {
  const value = String(raw || '').trim();
  try {
    new URL(value);
    return value;
  } catch (e) {
    // A raw '#' inside the password is read as a fragment; encode it before the last '@'.
    const at = value.lastIndexOf('@');
    if (at > 0) {
      const encoded = value.slice(0, at).replace(/#/g, '%23') + value.slice(at);
      new URL(encoded);
      return encoded;
    }
    throw e;
  }
}

function translate(sql, params) {
  if (params === undefined || params === null) {
    return { text: sql, values: [] };
  }

  if (Array.isArray(params)) {
    let index = 0;
    const text = sql.replace(/\?/g, function () {
      index += 1;
      return '$' + index;
    });
    return { text: text, values: params };
  }

  const order = [];
  const values = [];
  const text = sql.replace(/@([A-Za-z_][A-Za-z0-9_]*)/g, function (match, name) {
    let index = order.indexOf(name);
    if (index === -1) {
      order.push(name);
      values.push(params[name]);
      index = order.length - 1;
    }
    return '$' + (index + 1);
  });
  return { text: text, values: values };
}

function createClientAdapter(client) {
  async function query(sql, params) {
    const translated = translate(sql, params);
    return client.query(translated.text, translated.values);
  }
  return {
    get: async function (sql, params) { return (await query(sql, params)).rows[0]; },
    all: async function (sql, params) { return (await query(sql, params)).rows; },
    run: async function (sql, params) { const r = await query(sql, params); return { changes: r.rowCount, rowCount: r.rowCount }; },
    exec: async function (sql) { return client.query(sql); },
  };
}

async function runSchema(pool) {
  const file = path.join(__dirname, '..', 'migrations', 'postgres', '001_schema.sql');
  const sql = fs.readFileSync(file, 'utf8');
  await pool.query(sql);
}

function createPostgresAdapter(rawUrl) {
  const pool = new Pool({
    connectionString: normalizeDatabaseUrl(rawUrl),
    ssl: { rejectUnauthorized: false },
    max: 5,
    idleTimeoutMillis: 10000,
    connectionTimeoutMillis: 15000,
  });

  const ready = runSchema(pool).catch(function (err) {
    console.error('[postgres] schema init failed:', err.message);
    throw err;
  });

  async function query(sql, params) {
    await ready;
    const translated = translate(sql, params);
    return pool.query(translated.text, translated.values);
  }

  const adapter = {
    kind: 'postgres',
    ready: ready,
    get: async function (sql, params) { return (await query(sql, params)).rows[0]; },
    all: async function (sql, params) { return (await query(sql, params)).rows; },
    run: async function (sql, params) { const r = await query(sql, params); return { changes: r.rowCount, rowCount: r.rowCount }; },
    exec: async function (sql) { await ready; return pool.query(sql); },
    transaction: async function (fn) {
      await ready;
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const result = await fn(createClientAdapter(client));
        await client.query('COMMIT');
        return result;
      } catch (err) {
        await client.query('ROLLBACK').catch(function () {});
        throw err;
      } finally {
        client.release();
      }
    },
    close: function () { return pool.end(); },
  };

  return adapter;
}

module.exports = { createPostgresAdapter, normalizeDatabaseUrl, translate };
