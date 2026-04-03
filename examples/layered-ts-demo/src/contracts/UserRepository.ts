export interface UserRepository {
  findById(id: string): { id: string; email: string } | null;
}
