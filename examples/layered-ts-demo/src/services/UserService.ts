import { UserRepository } from "../contracts/UserRepository";

export class UserService {
  constructor(private readonly repo: UserRepository) {}

  getUserProfile(userId: string) {
    return this.repo.findById(userId);
  }
}
