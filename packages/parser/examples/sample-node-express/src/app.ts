import express from "express";
import { registerUserRoutes } from "./routes/userRoutes";
import { registerAuthRoutes } from "./routes/authRoutes";

export function createApp() {
  const app = express();
  app.use(express.json());

  registerUserRoutes(app);
  registerAuthRoutes(app);

  return app;
}
