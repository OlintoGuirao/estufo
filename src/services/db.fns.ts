import { createServerFn } from "@tanstack/react-start";

export const getDatabaseStatus = createServerFn({ method: "GET" }).handler(async () => {
  const { checkDatabaseConnection } = await import("@/server/db/client");
  return checkDatabaseConnection();
});
