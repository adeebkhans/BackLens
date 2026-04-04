import { UserService } from "../services/UserService";

export class UserController {
  constructor(private readonly service: UserService) {}

  handleGetUser(id: string) {
    return this.service.getUserProfile(id);
  }
}
