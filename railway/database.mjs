import {DatabaseSync} from 'node:sqlite';
import {mkdirSync,readFileSync,readdirSync} from 'node:fs';
import path from 'node:path';

export function openDatabase(filename) {
  mkdirSync(path.dirname(filename), {recursive:true});
  const sqlite = new DatabaseSync(filename);
  sqlite.exec('PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=10000;');
  sqlite.exec('CREATE TABLE IF NOT EXISTS grokify_migrations(name TEXT PRIMARY KEY, applied INTEGER NOT NULL)');
  for(const name of readdirSync(path.resolve('drizzle')).filter(n=>n.endsWith('.sql')).sort()) {
    if(sqlite.prepare('SELECT 1 FROM grokify_migrations WHERE name=?').get(name)) continue;
    sqlite.exec('BEGIN IMMEDIATE');
    try {
      sqlite.exec(readFileSync(path.resolve('drizzle',name),'utf8'));
      sqlite.prepare('INSERT INTO grokify_migrations VALUES (?,?)').run(name,Date.now());
      sqlite.exec('COMMIT');
    } catch(e) {sqlite.exec('ROLLBACK');throw e;}
  }
  sqlite.exec(`CREATE TABLE IF NOT EXISTS auth_challenges (hash TEXT PRIMARY KEY, wallet TEXT NOT NULL, origin TEXT NOT NULL, message TEXT NOT NULL, expires INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS auth_sessions (hash TEXT PRIMARY KEY, wallet TEXT NOT NULL, origin TEXT NOT NULL, expires INTEGER NOT NULL);
    CREATE INDEX IF NOT EXISTS auth_session_expiry ON auth_sessions(expires);
    CREATE TABLE IF NOT EXISTS auth_limits (key TEXT PRIMARY KEY, count INTEGER NOT NULL, expires INTEGER NOT NULL);`);
  function prepare(sql, args=[]) {
    const result = () => {
      const stmt=sqlite.prepare(sql);
      if(stmt.columns().length) return {results:stmt.all(...args),success:true,meta:{changes:0}};
      const r=stmt.run(...args);
      return {results:[],success:true,meta:{changes:Number(r.changes),last_row_id:Number(r.lastInsertRowid)}};
    };
    return {bind:(...values)=>prepare(sql,values),all:async()=>result(),run:async()=>result(),first:async(column)=>{const row=sqlite.prepare(sql).get(...args);return column?(row?.[column]??null):(row??null)},_execute:result};
  }
  return {sqlite,prepare,batch:async(statements)=>{
    sqlite.exec('BEGIN IMMEDIATE');
    try {const results=statements.map(s=>s._execute());sqlite.exec('COMMIT');return results;}
    catch(e){sqlite.exec('ROLLBACK');throw e;}
  }};
}
export function database() {
  if(!globalThis.__grokifyDatabase) {
    const directory=process.env.RAILWAY_VOLUME_MOUNT_PATH||process.env.GROKIFY_DATA_DIR;
    if(!directory) throw new Error('Persistent storage is required. Attach a Railway volume at /data.');
    globalThis.__grokifyDatabase=openDatabase(path.join(directory,'grokify.sqlite'));
  }
  return globalThis.__grokifyDatabase;
}
