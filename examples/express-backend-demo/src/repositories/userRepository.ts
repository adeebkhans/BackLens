import { logInfo } from "../utils/logger";

const fakeDb: any[] = [];

export function saveUser(user: any) {
  logInfo("Saving user");
  const saved = { id: Date.now(), ...user };
  fakeDb.push(saved);
  return saved;
}

export function findUserById(id: string) {
  logInfo("Finding user by ID");
  return fakeDb.find(u => u.id === Number(id));
}

export function findUserByEmail(email: string) {
  logInfo("Finding user by email");
  return fakeDb.find(u => u.email === email);
}
