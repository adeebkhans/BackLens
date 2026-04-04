class Counter {
  increase() {
    return this.value();
  }

  value() {
    return 1;
  }
}

export function useCounter() {
  const c = new Counter();
  return c.increase();
}
