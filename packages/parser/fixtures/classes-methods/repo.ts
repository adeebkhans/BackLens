export class UserRepository {
  save(user: { id: string }) {
    return user.id;
  }
}
