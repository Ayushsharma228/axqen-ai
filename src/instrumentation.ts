import type { Instrumentation } from "next";

// Sends every uncaught server error (pages, API routes, crons) to the error log and alert email.
export const onRequestError: Instrumentation.onRequestError = async (err, request, context) => {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { reportError } = await import("@/lib/errors");
  const path = request.path.split("?")[0];
  const source = path.startsWith("/api/cron/") ? `cron ${path.replace("/api/cron/", "")}` : `${context.routeType} ${context.routePath}`;
  await reportError(source, err, `${request.method} ${path}`);
};
