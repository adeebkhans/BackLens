import { Express } from "express";
import { loginUser } from "../controllers/authController";

export function registerAuthRoutes(app: Express) {
  app.post("/login", loginUser);
}
