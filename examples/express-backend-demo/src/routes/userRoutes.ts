// @ts-nocheck
import { Express } from "express";
import { createAndGetUser, createUser, getUser } from "../controllers/userController";

export function registerUserRoutes(app: Express) {
  app.post("/users", createUser);
  app.post("/users/createAndGet", createAndGetUser);
  app.get("/users/:id", getUser);
}
