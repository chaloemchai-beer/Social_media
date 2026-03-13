// MongoDB change-stream watcher removed — chat now uses PostgreSQL.
// Real-time is handled directly in /api/chat/messages via Socket.IO + chatBus.
export async function ensureMessageWatcher() {}
