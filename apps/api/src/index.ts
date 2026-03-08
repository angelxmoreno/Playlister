import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import authRoutes from "./routes/auth.js";
import playlistRoutes from "./routes/playlists.js";
import snapshotRoutes from "./routes/snapshots.js";

const app = new Hono();

app.use(
  "*",
  cors({
    origin: process.env.FRONTEND_URL ?? "http://localhost:5173",
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
    credentials: false,
  })
);

app.use("*", logger());

app.get("/health", (c) => c.json({ status: "ok" }));

app.route("/auth", authRoutes);
app.route("/playlists", playlistRoutes);
app.route("/", snapshotRoutes);

const port = parseInt(process.env.PORT ?? "3001");
console.log(`API server starting on port ${port}`);

export default {
  port,
  fetch: app.fetch,
};
