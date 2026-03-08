import { createMiddleware } from "hono/factory";
import { lucia } from "../auth/lucia.js";
import type { User, Session } from "lucia";

type AuthEnv = {
  Variables: {
    user: User;
    session: Session;
  };
};

export const authMiddleware = createMiddleware<AuthEnv>(async (c, next) => {
  const authHeader = c.req.header("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const sessionId = authHeader.slice(7);
  const { session, user } = await lucia.validateSession(sessionId);

  if (!session || !user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  c.set("user", user);
  c.set("session", session);
  await next();
});
