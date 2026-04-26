export async function retry(fn, opts) {
  const retries = opts?.retries ?? 3;
  const baseDelayMs = opts?.baseDelayMs ?? 200;
  const maxDelayMs = opts?.maxDelayMs ?? 3000;
  const jitter = opts?.jitter ?? 0.2;
  const signal = opts?.signal;

  let attempt = 0;
  while (attempt <= retries) {
    if (signal?.aborted) throw new Error("aborted");
    try {
      return await fn({ attempt });
    } catch (e) {
      if (attempt >= retries) throw e;
      const exp = Math.min(maxDelayMs, baseDelayMs * Math.pow(2, attempt));
      const rand = exp * jitter * (Math.random() * 2 - 1);
      const delay = Math.max(0, Math.round(exp + rand));
      await sleep(delay, signal);
      attempt += 1;
    }
  }
  throw new Error("unreachable");
}

export async function sleep(ms, signal) {
  if (ms <= 0) return;
  await new Promise((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    if (!signal) return;
    const onAbort = () => {
      clearTimeout(t);
      reject(new Error("aborted"));
    };
    if (signal.aborted) onAbort();
    else signal.addEventListener("abort", onAbort, { once: true });
  });
}

