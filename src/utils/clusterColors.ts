export const CLUSTER_COLORS = ['#4a9eff', '#b070ff', '#e8a020', '#e05050', '#00c8a0'];

export function colorForCluster(primaryId: string): string {
  let h = 0;
  for (const c of primaryId) h = (h * 31 + c.charCodeAt(0)) & 0x7fffffff;
  return CLUSTER_COLORS[h % CLUSTER_COLORS.length];
}
