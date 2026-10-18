import { bigint, index, pgEnum, pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";

export const providerEnum = pgEnum("provider", ["GITHUB", "GITLAB"])
export const roleEnum = pgEnum("user_role", ["USER", "ADMIN", "SUPERADMIN"])

export const usersTable = pgTable("users", {
    id: uuid("id").primaryKey().defaultRandom(),
    fullName: varchar("full_name", { length: 255 }).notNull(),
    email: varchar("email", { length: 255 }).notNull().unique(),
    password: text("password"),
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

export const workspaceTable = pgTable("workspace", {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("workspace_name", { length: 255 }).notNull(),
    slug: text("slug").notNull().unique(),
    ownerId: uuid("ownerId").references(() => usersTable.id, { onDelete: "cascade" }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().$onUpdateFn(() => new Date())
})

export const membersRole = pgEnum("role", ["OWNER", "MEMEBER", "VIEWER"])

export const membersTable = pgTable("members", {
    id: uuid("id").primaryKey().defaultRandom(),
    memberId: uuid("member_id").references(() => usersTable.id, { onDelete: "cascade" }).notNull(),
    workspaceId: uuid("workspace_id").references(() => workspaceTable.id, { onDelete: "cascade" }).notNull(),
    workspaceRole: membersRole("workspace_role").default("VIEWER").notNull(),
    joinedAt: timestamp("joined_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
})

export const applicationStatus = pgEnum("status", ["NOT STARTED", "QUEUED", "DEPLOYED"])

export const applicationTable = pgTable("application", {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 255 }).notNull(),
    workspaceId: uuid("workspace_id").references(() => workspaceTable.id, { onDelete: "cascade" }).notNull(),
    sourceRepository: text("source_repository").notNull().unique(),
    repositoryName: text("repo_name").notNull(),
    status: applicationStatus("application_status").default("NOT STARTED").notNull(),
    createdBy: uuid("created_by").references(() => usersTable.id, { onDelete: "cascade" }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().$onUpdateFn(() => new Date())
})

export type User = typeof usersTable.$inferSelect
export type NewUser = typeof usersTable.$inferInsert
export type Workspace = typeof workspaceTable.$inferSelect
export type NewWorkspace = typeof workspaceTable.$inferInsert