import { bigint, index, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid, varchar, type AnyPgColumn } from "drizzle-orm/pg-core";

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

export const githubInstallationsTable = pgTable("github_installations", {
    id: uuid("id").primaryKey().defaultRandom(),
    installationId: bigint("installation_id", { mode: "number" }).notNull(),
    workspaceId: uuid("workspace_id").references(() => workspaceTable.id, { onDelete: "cascade" }).notNull(),
    accountLogin: text("account_login").notNull(),
    accountType: text("account_type").notNull(),
    createdBy: uuid("created_by").references(() => usersTable.id, { onDelete: "set null" }),
    suspendedAt: timestamp("suspended_at", { withTimezone: true, mode: "date" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().$onUpdateFn(() => new Date())
}, (table) => [
    uniqueIndex("github_installations_installation_workspace_idx").on(table.installationId, table.workspaceId),
])

export const applicationStatus = pgEnum("status", ["NOT STARTED", "QUEUED", "DEPLOYED"])
export const deployModeEnum = pgEnum("deploy_mode", ["MANUAL", "AUTOMATIC"])

export const applicationTable = pgTable("application", {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 255 }).notNull(),
    workspaceId: uuid("workspace_id").references(() => workspaceTable.id, { onDelete: "cascade" }).notNull(),
    sourceRepository: text("source_repository").notNull().unique(),
    repositoryName: text("repo_name").notNull(),
    githubInstallationId: uuid("github_installation_id").references(() => githubInstallationsTable.id, { onDelete: "set null" }),
    githubRepositoryId: bigint("github_repository_id", { mode: "number" }),
    branch: text("branch").default("main").notNull(),
    deployMode: deployModeEnum("deploy_mode").default("MANUAL").notNull(),
    rootDirectory: text("root_directory").default("").notNull(),
    dockerfilePath: text("dockerfile_path").default("Dockerfile").notNull(),
    status: applicationStatus("application_status").default("NOT STARTED").notNull(),
    activeDeploymentId: uuid("active_deployment_id").references((): AnyPgColumn => deploymentsTable.id, { onDelete: "set null" }),
    createdBy: uuid("created_by").references(() => usersTable.id, { onDelete: "cascade" }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().$onUpdateFn(() => new Date())
})

export const deploymentStatus = pgEnum("deployment_status", ["QUEUED", "BUILDING", "BUILT", "DEPLOYING", "LIVE", "FAILED", "CANCELLED"])
export const deploymentTrigger = pgEnum("deployment_trigger", ["MANUAL", "PUSH", "ROLLBACK"])

export const deploymentsTable = pgTable("deployments", {
    id: uuid("id").primaryKey().defaultRandom(),
    applicationId: uuid("application_id").references(() => applicationTable.id, { onDelete: "cascade" }).notNull(),
    status: deploymentStatus("status").default("QUEUED").notNull(),
    trigger: deploymentTrigger("trigger").default("MANUAL").notNull(),
    branch: text("branch").notNull(),
    commitSha: varchar("commit_sha", { length: 40 }),
    commitMessage: text("commit_message"),
    imageTag: text("image_tag"),
    error: text("error"),
    logs: text("logs"),
    triggeredBy: uuid("triggered_by").references(() => usersTable.id, { onDelete: "set null" }),
    startedAt: timestamp("started_at", { withTimezone: true, mode: "date" }),
    finishedAt: timestamp("finished_at", { withTimezone: true, mode: "date" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().$onUpdateFn(() => new Date())
}, (table) => [
    index("deployments_application_id_created_at_idx").on(table.applicationId, table.createdAt),
    index("deployments_status_idx").on(table.status),
])

export type User = typeof usersTable.$inferSelect
export type NewUser = typeof usersTable.$inferInsert
export type Workspace = typeof workspaceTable.$inferSelect
export type NewWorkspace = typeof workspaceTable.$inferInsert
export type Application = typeof applicationTable.$inferSelect
export type NewApplication = typeof applicationTable.$inferInsert
export type GithubInstallation = typeof githubInstallationsTable.$inferSelect
export type Deployment = typeof deploymentsTable.$inferSelect
export type NewDeployment = typeof deploymentsTable.$inferInsert
