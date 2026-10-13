import { loadConfig } from "./platform/config.js";
import { start } from "./app/bootstrap.js";
try {
  const application = await start(loadConfig());
  for (const signal of ["SIGINT", "SIGTERM"] as const) process.once(signal, () => {
    void application.stop().then(() => process.exit(0));
  });
} catch { console.error(JSON.stringify({ event: "startup_failed" })); process.exitCode = 1; }
