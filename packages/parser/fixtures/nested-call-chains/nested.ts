export function outer() {
  function inner() {
    return leaf();
  }

  return inner();
}

function leaf() {
  return "leaf";
}
