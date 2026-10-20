import type connectDB from "../db";

export type Database = ReturnType<typeof connectDB>["db"]
