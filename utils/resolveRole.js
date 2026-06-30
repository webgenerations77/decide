// Pure precedence: an existing Firestore doc is authoritative (even when role is null,
// which represents an explicit revoke). With no doc, fall back to the hardcoded seed map.
// hasDoc defaults to true when firestoreRole is explicitly provided (not undefined).
export function resolveRole({ firestoreRole, fallbackMap, email, hasDoc }) {
  const docExists = hasDoc ?? (firestoreRole !== undefined);
  if (docExists) return firestoreRole ?? null;
  const key = email?.toLowerCase?.().trim();
  return (key && fallbackMap[key]) || null;
}
