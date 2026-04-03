import { Request, Response } from "express";
import { authenticateUser } from "../services/authService";

export function loginUser(req: Request, res: Response) {
  const token = authenticateUser(req.body.email, req.body.password);
  res.json({ token });
}