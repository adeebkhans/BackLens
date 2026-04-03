import { Request, Response } from "express";
import { userService, createUserService, getUserService } from "../services/userService";
import { validateUserPayload } from "../utils/validator";

export function createUser(req: Request, res: Response) {
  validateUserPayload(req.body);

  // Use instance method (should result in class/method node + method_call edges)
  const user = userService.create(req.body);
  res.json(user);
}

export function getUser(req: Request, res: Response) {
  // Alternate: call legacy function which delegates to the instance
  const user = getUserService(req.params.id);
  res.json(user);
}

export function createAndGetUser(req: Request, res: Response) {
  validateUserPayload(req.body);
  // This will call createAndGet which internally calls create() then get()
  const user = userService.createAndGet(req.body);
  res.json(user);
}
  