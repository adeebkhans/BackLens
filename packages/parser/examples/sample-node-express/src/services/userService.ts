import { hashPassword } from "../utils/crypto";
import { saveUser, findUserById } from "../repositories/userRepository";
import { sendWelcomeEmail } from "./emailService";
import { logInfo } from "../utils/logger";

export function createUserService(payload: any) {
  logInfo("Creating user");
  const hashed = hashPassword(payload.password);
  const user = saveUser({ ...payload, password: hashed });

  sendWelcomeEmail(user.email);

  return user;
}

export function getUserService(id: string) {
  logInfo("Fetching user");
  return findUserById(id);
}
