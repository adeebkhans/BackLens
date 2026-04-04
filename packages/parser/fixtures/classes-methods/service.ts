import { UserRepository } from "./repo";

export function saveUser() {
  const repo = new UserRepository();
  return repo.save({ id: "u1" });
}
