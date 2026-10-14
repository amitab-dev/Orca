import { bigint, index, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";

export const providerEnum = pgEnum("provider", ["GITHUB", "GITLAB"])
export const roleEnum = pgEnum("user_role", ["USER", "ADMIN", "SUPERADMIN"])

export const usersTable = pgTable("users", {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 255 }).notNull(),
    email: varchar("email", { length: 255 }).notNull().unique(),
    passsword: text("password"),
    avatar: text("avatar").notNull().default(""),
    role: roleEnum("user_role").default("USER").notNull(),
    provider: providerEnum("provider"),
    provderId: bigint("provider_id", { mode: "number" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().$onUpdateFn(() => new Date())
});

export const tokensTable = pgTable("tokens", {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").references(() => usersTable.id, { onDelete: "cascade" }).notNull(),
    refreshToken: text("refresh_token").notNull().unique(),
    revokedAt: timestamp("revoked_at", { mode: "date", withTimezone: true }),
    expiresAt: timestamp("expires_at", { mode: "date", withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
}, (table) => [
    index("tokens_user_id_idx").on(table.userId),
])