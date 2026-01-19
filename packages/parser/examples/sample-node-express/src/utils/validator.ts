import { AppError } from "../errors/AppError";

export function validateUserPayload(payload: any) {
  if (!payload.email || !payload.password) {
    throw new AppError("Invalid payload");
  }
}
