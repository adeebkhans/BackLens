import { UserRepository } from "../contracts/UserRepository";

export class InMemoryUserRepository implements UserRepository {
  findById(id: string) {
    return { id, email: "demo@example.com" };
  }
}
