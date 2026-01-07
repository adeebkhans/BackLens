import { Express } from "express";
import { createUser, getUser } from "../controllers/userController";

export function registerUserRoutes(app: Express) {
  app.post("/users", createUser);
  app.get("/users/:id", getUser);
}
