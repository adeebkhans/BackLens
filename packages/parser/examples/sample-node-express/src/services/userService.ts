export function hashPassword(pw: string) {
  // fake hash
  return `HASHED:${pw}`;
}

export function saveUser(u: any) {
  // pretend DB write
  return { id: Date.now(), ...u };
}
