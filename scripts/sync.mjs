import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const SITE_DIR = join(ROOT, 'site');
const DATA_FILE = join(SITE_DIR, 'data.json');

const UPSTREAM_REPO = process.env.UPSTREAM_REPO || 'laoma2053/awesome-zhuiju-free';
const UPSTREAM_BRANCH = process.env.UPSTREAM_BRANCH || 'main';

const SOURCES = {
  resources: [
    'https://raw.githubusercontent.com/' + UPSTREAM_REPO + '/' + UPSTREAM_BRANCH + '/resources/resources.json',
    'https://cdn.jsdelivr.net/gh/' + UPSTREAM_REPO + '@' + UPSTREAM_BRANCH + '/resources/resources.json'
  ],
  availability: [
    'https://raw.githubusercontent.com/' + UPSTREAM_REPO + '/' + UPSTREAM_BRANCH + '/reports/availability.json',
    'https://cdn.jsdelivr.net/gh/' + UPSTREAM_REPO + '@' + UPSTREAM_BRANCH + '/reports/availability.json'
  ]
};

async function fetchJson(urls) {
  let lastErr = null;
  for (const url of urls) {
    try {
      const res = await fetch(url, {
        headers: { 'user-agent': 'zhuiju-free-site-sync/1.0' },
        signal: AbortSignal.timeout(20000)
      });
      if (res.ok) return await res.json();
      lastErr = new Error('HTTP ' + res.status + ' from ' + url);
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr || new Error('all sources failed');
}

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

let ok = false;
try {
  const [r, a] = await Promise.all([
    fetchJson(SOURCES.resources),
    fetchJson(SOURCES.availability)
  ]);
  const data = merge(r, a);
  await mkdir(SITE_DIR, { recursive: true });
  await writeFile(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
  console.log('[sync] OK: ' + data.resources.length + ' resources, upstream updated_at=' + (data.meta.updated_at || 'n/a'));
  ok = true;
} catch (err) {
  console.error('[sync] 拉取上游数据失败: ' + err.message);
  try {
    const old = JSON.parse(await readFile(DATA_FILE, 'utf8'));
    console.warn('[sync] 保留上次成功数据（' + old.resources.length + ' 个资源，更新于 ' + old.meta.updated_at + '），网站继续可用。');
    ok = true;
  } catch (e2) {
    console.error('[sync] 且无可用旧数据，构建失败。');
  }
}
process.exit(ok ? 0 : 1);
