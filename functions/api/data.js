// Cloudflare Pages Function：/api/data
// 在用户点击“刷新数据”时由 Cloudflare 边缘节点代为拉取上游 JSON 并合并返回，
// 避免浏览器直连 GitHub 在国内不稳定。数据始终是最新的，无需重新部署。
const UPSTREAM_REPO = 'laoma2053/awesome-zhuiju-free';
const UPSTREAM_BRANCH = 'main';

function merge(resourcesJson, availabilityJson) {
  const map = new Map();
  for (const item of (availabilityJson.results || [])) map.set(item.resource_id, item);
  const list = (resourcesJson.resources || []).map((res) => {
    const av = map.get(res.id);
    return Object.assign({}, res, {
      availability: av ? Object.assign({}, av) : { status: 'unchecked' }
    });
  });
  return {
    meta: {
      version: resourcesJson.version || 1,
      updated_at: resourcesJson.updated_at || null,
      generated_at: new Date().toISOString(),
      source_repo: UPSTREAM_REPO,
      source_branch: UPSTREAM_BRANCH
    },
    resources: list
  };
}

export async function onRequestGet() {
  const base = 'https://raw.githubusercontent.com/' + UPSTREAM_REPO + '/' + UPSTREAM_BRANCH;
  const urls = [
    base + '/resources/resources.json',
    base + '/reports/availability.json'
  ];
  try {
    const results = await Promise.all(urls.map((u) => fetch(u)));
    if (!results[0].ok || !results[1].ok) {
      return new Response('upstream fetch failed', { status: 502 });
    }
    const [r, a] = await Promise.all([results[0].json(), results[1].json()]);
    const data = merge(r, a);
    return new Response(JSON.stringify(data), {
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'cache-control': 'no-cache',
        'access-control-allow-origin': '*'
      }
    });
  } catch (err) {
    return new Response('upstream fetch error: ' + err.message, { status: 502 });
  }
}
