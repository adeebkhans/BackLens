import { hashPassword } from "../utils/crypto";
import { saveUser, findUserById } from "../repositories/userRepository";
import { sendWelcomeEmail } from "./emailService";
import { logInfo } from "../utils/logger";

// Class-based service to exercise class/method extraction
export class UserService {
  constructor(private source = 'default') {}

  create(payload: any) {
    logInfo(`UserService(${this.source}) creating user`);
    const hashed = hashPassword(payload.password);
    const user = saveUser({ ...payload, password: hashed });

    // call another module method (method call on module export)
    sendWelcomeEmail(user.email);

    return user;
  }

  get(id: string) {
    logInfo(`UserService(${this.source}) fetching user`);
    return findUserById(id);
  }

  // Example instance helper method that calls another method on this class
  createAndGet(payload: any) {
    const u = this.create(payload);
    return this.get(u.id);
  }
}

// Export a ready-to-use instance and keep legacy function API
export const userService = new UserService();

export function createUserService(payload: any) {
  return userService.create(payload);
}

export function getUserService(id: string) {
  return userService.get(id);
}
