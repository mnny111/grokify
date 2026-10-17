// Intentionally empty by default.
// Add Drizzle tables here when the site actually needs a database.
// See examples/d1/db/schema.ts for an opt-in example.
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
export const projects = sqliteTable('projects', {
 id:text('id').primaryKey(), owner:text('owner').notNull(), name:text('name').notNull(), symbol:text('symbol').notNull(), kind:text('kind').notNull(), prompt:text('prompt').notNull(), description:text('description').notNull(), config:text('config').notNull(), siteSlug:text('site_slug').unique(), status:text('status').notNull().default('draft'), mint:text('mint'), parent:text('parent'), treasury:text('treasury'), secret:text('secret'), created:integer('created').notNull(), updated:integer('updated').notNull(), revision:integer('revision').notNull().default(1)
});
export const messages=sqliteTable('messages',{id:text('id').primaryKey(),project:text('project').notNull(),role:text('role').notNull(),content:text('content').notNull(),created:integer('created').notNull()});
export const builds=sqliteTable('builds',{id:text('id').primaryKey(),project:text('project').notNull(),version:integer('version').notNull(),spec:text('spec').notNull(),html:text('html'),created:integer('created').notNull()});
export const records=sqliteTable('records',{id:text('id').primaryKey(),project:text('project').notNull(),owner:text('owner').notNull(),type:text('type').notNull(),data:text('data').notNull(),created:integer('created').notNull()});
export const jobs=sqliteTable('jobs',{id:text('id').primaryKey(),project:text('project').notNull(),kind:text('kind').notNull(),status:text('status').notNull(),signature:text('signature'),payload:text('payload').notNull(),error:text('error'),created:integer('created').notNull(),updated:integer('updated').notNull()});
export const policies=sqliteTable('policies',{project:text('project').primaryKey(),enabled:integer('enabled').notNull().default(0),percent:integer('percent').notNull().default(80),maxLamports:text('max_lamports').notNull().default('100000000'),reserveLamports:text('reserve_lamports').notNull().default('20000000'),dailyLamports:text('daily_lamports').notNull().default('500000000'),revision:integer('revision').notNull().default(1)});
export const locks=sqliteTable('locks',{project:text('project').primaryKey(),token:text('token').notNull(),expires:integer('expires').notNull()});
