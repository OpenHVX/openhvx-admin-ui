export function useTaskPolling(api) {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  async function waitTaskResult(taskId, { interval = 1200, timeout = 120000 } = {}) {
    const t0 = Date.now();
    while (true) {
      const doc = await api.getTaskById(taskId);   // <- déjà déballé
      const t   = doc?.data ?? doc;                // ceinture + bretelles si autre wrapper

      if (t?.status === "done"  || t?.ok === true)  return t?.result ?? t;
      if (t?.status === "error" || t?.ok === false) throw new Error(t?.error || "Task error");
      if (Date.now() - t0 > timeout)                throw new Error("task timeout");

      await sleep(interval);
    }
  }

  return { waitTaskResult };
}
