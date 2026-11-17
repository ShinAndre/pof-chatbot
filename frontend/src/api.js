const BASE_URL = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

async function request(path, options = {}) {
  const res = await fetch(`${BASE_URL}/api${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Errore ${res.status}`);
  return data;
}

export function getUserId() {
  const KEY = 'pof_user_id';
  try {
    let id = localStorage.getItem(KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(KEY, id);
    }
    return id;
  } catch {
    return crypto.randomUUID();
  }
}

export const api = {
  chat: (userId, conversationId, message) =>
    request('/chat', { method: 'POST', body: JSON.stringify({ userId, conversationId, message }) }),
  listConversations: (userId) => request(`/conversations?userId=${userId}`),
  getConversation: (userId, id) => request(`/conversations/${id}?userId=${userId}`),
  deleteConversation: (userId, id) => request(`/conversations/${id}?userId=${userId}`, { method: 'DELETE' }),
  getPreferences: (userId) => request(`/users/${userId}/preferences`),
  clearPreferences: (userId) => request(`/users/${userId}/preferences`, { method: 'DELETE' }),
};
