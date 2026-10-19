export function appendMomentsPiece<T extends { id?: string }>(messages: T[], piece: T): T[] {
  const list = Array.isArray(messages) ? messages.slice() : [];
  let id = String(piece?.id || "");
  if (!id || list.some((item) => item?.id === id)) {
    id = `piece_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  }
  return [...list, { ...piece, id }];
}
