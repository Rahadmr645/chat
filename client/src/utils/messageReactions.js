/** Group reactions by emoji for display (one reaction per user on server). */
export function aggregateReactions(reactions, myUserId) {
  const list = Array.isArray(reactions) ? reactions : [];
  const by = new Map();
  for (const r of list) {
    const em = String(r.emoji || "").trim();
    if (!em) continue;
    if (!by.has(em)) {
      by.set(em, { emoji: em, count: 0, mine: false });
    }
    const g = by.get(em);
    g.count += 1;
    if (String(r.userId) === String(myUserId)) g.mine = true;
  }
  return [...by.values()].sort((a, b) => b.count - a.count || a.emoji.localeCompare(b.emoji));
}
