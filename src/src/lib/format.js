export function fmtInt(n) {
  const v = Number(n || 0);
  return v.toLocaleString();
}
export function fmtBytes(b) {
  const v = Number(b || 0);
  if (v >= 1024**4) return (v/1024**4).toFixed(1) + ' TB';
  if (v >= 1024**3) return (v/1024**3).toFixed(1) + ' GB';
  if (v >= 1024**2) return (v/1024**2).toFixed(1) + ' MB';
  if (v >= 1024)    return (v/1024).toFixed(1) + ' KB';
  return v + ' B';
}
export function pct(part, total) {
  const p = Number(part||0), t = Number(total||0);
  if (!t) return 0;
  return Math.round((p / t) * 100);
}
