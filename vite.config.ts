import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));
const CHECK_FUNCTION_PATH = "/functions/api/soundcloud/check.ts";

export default defineConfig({
  plugins: [react(), soundCloudCheckDevApi()],
  resolve: {
    alias: {
      "@": path.resolve(projectRoot, "src")
    }
  }
});

/**
 * 開発サーバーで /api/soundcloud/check を本番と同じ Pages Function に渡す。
 * 同じオリジンで動くので、スマホから LAN の IP で開いても判定できる。
 */
function soundCloudCheckDevApi(): Plugin {
  return {
    name: "soundcloud-check-dev-api",
    configureServer(server) {
      server.middlewares.use("/api/soundcloud/check", async (req, res) => {
        if (req.method !== "GET") {
          res.statusCode = 405;
          res.end();
          return;
        }

        try {
          const headers = new Headers();

          for (const [key, value] of Object.entries(req.headers)) {
            if (typeof value === "string") {
              headers.set(key, value);
            }
          }

          const requestUrl = new URL(req.originalUrl ?? req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
          const { onRequestGet } = (await server.ssrLoadModule(CHECK_FUNCTION_PATH)) as {
            onRequestGet: (context: { request: Request }) => Promise<Response>;
          };
          const response = await onRequestGet({ request: new Request(requestUrl, { headers }) });

          res.statusCode = response.status;
          response.headers.forEach((value, key) => res.setHeader(key, value));
          res.end(await response.text());
        } catch (error) {
          server.config.logger.error(String(error));
          res.statusCode = 500;
          res.end();
        }
      });
    }
  };
}
