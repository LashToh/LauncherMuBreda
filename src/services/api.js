function unwrap(json) {
  if (json && typeof json === 'object' && 'data' in json) return json.data;
  return json;
}

async function getJson(url, timeoutMs = 8000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return unwrap(await res.json());
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchServerInfo(apiUrl) {
  if (!apiUrl) return null;
  return getJson(`${apiUrl.replace(/\/$/, '')}/api/server`);
}

export async function fetchNews(apiUrl) {
  if (!apiUrl) return [];
  const data = await getJson(`${apiUrl.replace(/\/$/, '')}/api/news`);
  return Array.isArray(data?.items) ? data.items : Array.isArray(data) ? data : [];
}
