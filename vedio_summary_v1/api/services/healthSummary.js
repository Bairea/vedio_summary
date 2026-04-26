export function summarizeHealth(checks) {
  const requiredFailures = Object.values(checks).filter((item) => item.required && !item.ok);

  if (requiredFailures.length === 0) {
    return {
      ok: true,
      status: "ready",
      summary: "运行基线已满足",
    };
  }

  return {
    ok: false,
    status: "needs_attention",
    summary: `仍需处理：${requiredFailures.map((item) => item.label).join("、")}`,
  };
}
