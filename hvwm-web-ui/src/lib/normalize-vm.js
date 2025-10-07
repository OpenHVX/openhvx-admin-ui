function bytesToMB(x) {
  return x ? Math.round(Number(x) / (1024 * 1024)) : undefined;
}
function uiStateFromRequested(req) {
  const s = String(req || "").toLowerCase();
  if (["start", "on", "poweron", "resume"].includes(s)) return "Running";
  if (["off", "poweroff", "shutdown"].includes(s))      return "Off";
  if (["pause", "suspend"].includes(s))                 return "Paused";
  if (s === "save")                                     return "Saved";
  if (["restart", "reboot"].includes(s))                return "Running";
  return undefined;
}

export function vmPatchFromTask(result) {
  // result peut être:
  // - le "task.result" déjà déballé (préféré)
  // - un taskDoc complet (auquel cas on va chercher .result)
  const r0 = result?.result ? result.result : result;

  const t  = r0?.target || r0?.data?.target || {};
  const vm = r0?.vm || {};
  const agentId = t.agentId || vm.agentId;
  const refId   = t.refId   || vm.guid || vm.id || vm.name;
  if (!agentId || !refId) return null;

  // 1) priorité à vm.state si fourni par le script
  // 2) sinon fallback sur requestedState / data.state
  const state =
    vm.state ??
    r0?.state ??
    uiStateFromRequested(r0?.requestedState || r0?.data?.state);

  return {
    agentId,
    guid: refId,
    id: refId,
    name: vm.name ?? refId,
    state,
    cpu: vm.cpu ?? vm.cpuCount ?? undefined,
    ramMB: vm.memoryAssignedMB ?? (vm.memory?.startup ? bytesToMB(vm.memory.startup) : undefined),
    switches: Array.isArray(vm.switches) ? vm.switches : (vm.network ? [vm.network] : undefined),
    ips: vm.ips,
    diskProvMB: vm.disk?.vhd_size ? bytesToMB(vm.disk.vhd_size) : undefined,
    diskUsedMB: vm.disk?.fileSizeMB,
  };
}
