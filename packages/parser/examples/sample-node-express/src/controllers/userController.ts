import { hashPassword, saveUser } from "../services/userService";

export function createUser(payload: any) {
  const hashed = hashPassword(payload.password);
  return saveUser({ ...payload, password: hashed });
}
