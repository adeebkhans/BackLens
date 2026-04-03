import { UserController } from "./controllers/UserController";
import { InMemoryUserRepository } from "./repositories/InMemoryUserRepository";
import { UserService } from "./services/UserService";

const repo = new InMemoryUserRepository();
const service = new UserService(repo);
const controller = new UserController(service);

export const sampleUser = controller.handleGetUser("u1");
