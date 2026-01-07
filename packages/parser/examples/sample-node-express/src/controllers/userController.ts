import { Request, Response } from "express";
import { createUserService, getUserService } from "../services/userService";
import { validateUserPayload } from "../utils/validator";

export function createUser(req: Request, res: Response) {
  validateUserPayload(req.body);
  const user = createUserService(req.body);
  res.json(user);
}

export function getUser(req: Request, res: Response) {
  const user = getUserService(req.params.id);
  res.json(user);
}
  