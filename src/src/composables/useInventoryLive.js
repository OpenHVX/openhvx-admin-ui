// Envoi de tâche + patch local du tableau
import { vmPatchFromTask } from "@/lib/normalize-vm";

export function useInventoryLive(rowsRef, api) {
  const rowKey = (r) => `${r.agentId}::${r.guid || r.id || r.name}`;

  function applyPatch(patch) {
    if (!patch) return;
    const key = `${patch.agentId}::${patch.guid}`;
    const idx = rowsRef.value.findIndex((r) => rowKey(r) === key);
    const cleaned = Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined));
    if (idx >= 0) rowsRef.value[idx] = { ...rowsRef.value[idx], ...cleaned };
    else rowsRef.value.unshift(cleaned);
  }

  async function enqueueAndMaybeOptimistic(payload, optimisticVmPatch) {
    const t = await api.enqueueTask(payload);
    if (optimisticVmPatch) applyPatch(optimisticVmPatch);
    return t?.taskId || t?.id;
  }

  function patchFromTaskResult(result) {
    applyPatch(vmPatchFromTask(result));
  }

  return { enqueueAndMaybeOptimistic, patchFromTaskResult };
}
