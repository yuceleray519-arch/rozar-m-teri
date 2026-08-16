import { relations } from 'drizzle-orm';
import { boolean, integer, pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(),
  email: text('email').notNull(),
  role: text('role').notNull().default('personnel'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const rooms = pgTable('rooms', {
  id: serial('id').primaryKey(),
  number: text('number').notNull().unique(),
  floor: integer('floor').notNull(),
  capacity: integer('capacity').notNull(),
  status: text('status').notNull().default('Available'), // Available, Occupied, Dirty
  orderIndex: integer('order_index').notNull().default(0),
  isDeleted: boolean('is_deleted').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const guestRegistrations = pgTable('guest_registrations', {
  id: serial('id').primaryKey(),
  firstName: text('first_name').notNull(),
  lastName: text('last_name').notNull(),
  tcId: text('tc_id').notNull(),
  phone: text('phone').notNull(),
  roomId: integer('room_id').references(() => rooms.id).notNull(),
  numGuests: integer('num_guests').notNull(),
  paymentType: text('payment_type').notNull().default('Nakit'),
  paymentAmount: integer('payment_amount').notNull().default(0),
  paymentType2: text('payment_type2'),
  paymentAmount2: integer('payment_amount2'),
  checkInDate: timestamp('check_in_date').notNull().defaultNow(),
  checkOutDate: timestamp('check_out_date'),
  checkInPersonnelId: integer('check_in_personnel_id').references(() => users.id).notNull(),
  checkOutPersonnelId: integer('check_out_personnel_id').references(() => users.id),
  notes: text('notes'),
  status: text('status').notNull().default('Active'), // Active, CheckedOut
  isDeleted: boolean('is_deleted').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const logs = pgTable('logs', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id).notNull(),
  action: text('action').notNull(),
  details: text('details').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

export const settings = pgTable('settings', {
  id: serial('id').primaryKey(),
  key: text('key').notNull().unique(),
  value: text('value').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const usersRelations = relations(users, ({ many }) => ({
  guestRegistrationsCheckIn: many(guestRegistrations, { relationName: 'checkInPersonnel' }),
  guestRegistrationsCheckOut: many(guestRegistrations, { relationName: 'checkOutPersonnel' }),
  logs: many(logs),
}));

export const roomsRelations = relations(rooms, ({ many }) => ({
  guestRegistrations: many(guestRegistrations),
}));

export const guestRegistrationsRelations = relations(guestRegistrations, ({ one }) => ({
  room: one(rooms, {
    fields: [guestRegistrations.roomId],
    references: [rooms.id],
  }),
  checkInPersonnel: one(users, {
    fields: [guestRegistrations.checkInPersonnelId],
    references: [users.id],
    relationName: 'checkInPersonnel'
  }),
  checkOutPersonnel: one(users, {
    fields: [guestRegistrations.checkOutPersonnelId],
    references: [users.id],
    relationName: 'checkOutPersonnel'
  }),
}));

export const logsRelations = relations(logs, ({ one }) => ({
  user: one(users, {
    fields: [logs.userId],
    references: [users.id],
  }),
}));
