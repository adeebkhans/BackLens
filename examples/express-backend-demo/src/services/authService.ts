import { findUserByEmail } from "../repositories/userRepository";
import { hashPassword } from "../utils/crypto";
import { AppError } from "../errors/AppError";

export function authenticateUser(email: string, password: string) {
  const user = findUserByEmail(email);
  const hashed = hashPassword(password);

  if (!user || user.password !== hashed) {
    throw new AppError("Invalid credentials");
  }

  return `TOKEN-${user.id}`;
}
