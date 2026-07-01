// Union two lists of history items by `id`, keeping the entry with the newer
// stamp (updatedAt preferred, then timestamp). Ordered by timestamp desc. Pure.
function stamp(item) {
  return item.updatedAt ?? item.timestamp ?? 0;
}

export function mergeById(localList = [], remoteList = []) {
  const byId = new Map();
  // remote first, then local, so a local item wins ties (it is the just-saved copy).
  for (const item of [...remoteList, ...localList]) {
    if (!item || item.id == null) continue;
    const existing = byId.get(item.id);
    if (!existing || stamp(item) >= stamp(existing)) byId.set(item.id, item);
  }
  return [...byId.values()].sort((a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0));
}
