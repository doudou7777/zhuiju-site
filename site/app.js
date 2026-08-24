(function () {
  'use strict';

  var UPSTREAM_REPO = 'laoma2053/awesome-zhuiju-free';
  var UPSTREAM_BRANCH = 'main';

  var CATEGORIES = [
    { id: 'online_video', label: '在线影视', icon: '🎬' },
    { id: 'video_app', label: '影视APP', icon: '📱' },
    { id: 'cloud_search', label: '网盘搜索', icon: '☁️' },
    { id: 'magnet_search', label: '磁力&BT', icon: '🧲' },
    { id: 'subtitles', label: '字幕资源', icon: '💬' },
    { id: 'player', label: '播放器/空壳', icon: '📺' },
    { id: 'tvbox_config', label: 'TVBox接口', icon: '🔧' },
    { id: 'subscription', label: '会员拼团', icon: '🤝' },
    { id: 'open_source', label: '开源项目', icon: '💻' }
  ];

  var STATUS = {
    reachable: { label: '可访问', cls: 'ok', dot: 'ok' },
    restricted: { label: '受限', cls: 'warn', dot: 'warn' },
    unreachable: { label: '失效', cls: 'bad', dot: 'bad' },
    unchecked: { label: '未检测', cls: 'unk', dot: 'unk' }
  };
  var STATUS_ORDER = ['reachable', 'restricted', 'unreachable', 'unchecked'];

  var RISK_LABELS = { copyright: '版权', safety: '安全', privacy: '隐私', payment: '支付' };
  var RISK_LEVEL = { high: '高', medium: '中', low: '低', unknown: '未知' };

  var state = {
    data: null,
    category: 'all',
    status: 'all',
    query: '',
    sort: 'rating'
  };

  var el = {
    metaLine: document.getElementById('metaLine'),
    stats: document.getElementById('stats'),
    catNav: document.getElementById('catNav'),
    list: document.getElementById('list'),
    search: document.getElementById('searchInput'),
    sort: document.getElementById('sortSelect'),
    refresh: document.getElementById('refreshBtn'),
    theme: document.getElementById('themeBtn'),
    toast: document.getElementById('toast')
  };

  /* ---------- 工具 ---------- */

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function toast(msg, ms) {
    el.toast.textContent = msg;
    el.toast.classList.add('show');
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { el.toast.classList.remove('show'); }, ms || 2400);
  }

  function stars(res) {
    var s = res.scores || {};
    var avg = (Number(s.more || 0) + Number(s.speed || 0) + Number(s.clean || 0) + Number(s.stable || 0)) / 4;
    var n = Math.round(avg);
    var out = '';
    for (var i = 0; i < 5; i++) out += (i < n ? '★' : '☆');
    return { html: out, avg: avg, n: n };
  }

  function statusOf(res) {
    var av = res.availability || {};
    var st = STATUS[av.status] ? av.status : 'unchecked';
    return { key: st, info: STATUS[st], av: av };
  }

  function riskChips(res) {
    var risks = res.risks || {};
    var out = [];
    Object.keys(RISK_LABELS).forEach(function (k) {
      var v = risks[k];
      if (!v) return;
      out.push('<span class="risk ' + esc(v) + '" title="' + RISK_LABELS[k] + '风险：' + RISK_LEVEL[v] + '">' + RISK_LABELS[k] + '·' + RISK_LEVEL[v] + '</span>');
    });
    return out.join('');
  }

  function fmtDate(d) {
    if (!d) return '';
    var s = String(d).slice(0, 10);
    return s;
  }

  function copyText(text, btn, okMsg) {
    function done() {
      if (btn) {
        var old = btn.textContent;
        btn.textContent = '✓ 已复制';
        btn.classList.add('copy-ok');
        setTimeout(function () { btn.textContent = old; btn.classList.remove('copy-ok'); }, 1600);
      }
      toast(okMsg || '已复制到剪贴板');
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, function () { fallback(); });
    } else { fallback(); }
    function fallback() {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); done(); } catch (e) { toast('复制失败，请手动复制'); }
      document.body.removeChild(ta);
    }
  }

  /* ---------- 数据加载 ---------- */

  function mergeClient(resourcesJson, availabilityJson) {
    var map = {};
    (availabilityJson.results || []).forEach(function (x) { map[x.resource_id] = x; });
    var list = (resourcesJson.resources || []).map(function (res) {
      var av = map[res.id];
      return Object.assign({}, res, { availability: av ? Object.assign({}, av) : { status: 'unchecked' } });
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

  function fetchJson(url) {
    return fetch(url, { cache: 'no-store' }).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    });
  }

  function loadLocal() {
    return fetchJson('./data.json?t=' + Date.now());
  }

  function fetchFresh() {
    // 1) 本站 Pages Function（同源代理，绕过 GitHub 直连）
    return fetchJson('/api/data?t=' + Date.now()).then(function (d) {
      if (!d || !d.resources) throw new Error('bad payload');
      return d;
    }).catch(function () {
      // 2) jsDelivr CDN
      return Promise.all([
        fetchJson('https://cdn.jsdelivr.net/gh/' + UPSTREAM_REPO + '@' + UPSTREAM_BRANCH + '/resources/resources.json'),
        fetchJson('https://cdn.jsdelivr.net/gh/' + UPSTREAM_REPO + '@' + UPSTREAM_BRANCH + '/reports/availability.json')
      ]).then(function (pair) { return mergeClient(pair[0], pair[1]); });
    }).catch(function () {
      // 3) GitHub raw（最后兜底）
      return Promise.all([
        fetchJson('https://raw.githubusercontent.com/' + UPSTREAM_REPO + '/' + UPSTREAM_BRANCH + '/resources/resources.json'),
        fetchJson('https://raw.githubusercontent.com/' + UPSTREAM_REPO + '/' + UPSTREAM_BRANCH + '/reports/availability.json')
      ]).then(function (pair) { return mergeClient(pair[0], pair[1]); });
    });
  }

  function applyData(data) {
    state.data = data;
    renderAll();
    var meta = data.meta || {};
    el.metaLine.textContent =
      '更新于 ' + (meta.updated_at || '未知') +
      ' · 已收录 ' + data.resources.length + ' 个资源 · 数据源 ' + (meta.source_repo || UPSTREAM_REPO) +
      ' · 检测时间 ' + (meta.generated_at ? fmtDate(meta.generated_at) : '');
  }

  /* ---------- 渲染 ---------- */

  function filtered() {
    var list = state.data ? state.data.resources : [];
    var q = state.query.trim().toLowerCase();
    var out = list.filter(function (res) {
      if (state.category !== 'all' && res.category !== state.category) return false;
      if (state.status !== 'all' && statusOf(res).key !== state.status) return false;
      if (q) {
        var hay = (res.name + ' ' + (res.tags || []).join(' ') + ' ' + (res.summary_short || '') + ' ' + (res.summary || '')).toLowerCase();
        if (hay.indexOf(q) === -1) return false;
      }
      return true;
    });
    var sort = state.sort;
    out.sort(function (a, b) {
      if (sort === 'name') return (a.name || '').localeCompare(b.name || '', 'zh-Hans-CN');
      if (sort === 'status') {
        var sa = STATUS_ORDER.indexOf(statusOf(a).key);
        var sb = STATUS_ORDER.indexOf(statusOf(b).key);
        if (sa !== sb) return sa - sb;
      }
      if (sort === 'updated') {
        var da = (a.verification && a.verification.last_checked) || (a.source && a.source.added_at) || '';
        var db = (b.verification && b.verification.last_checked) || (b.source && b.source.added_at) || '';
        return db.localeCompare(da);
      }
      // rating（默认）：四维平均降序，featured 优先
      var ra = avgScore(a), rb = avgScore(b);
      if (ra !== rb) return rb - ra;
      return ((b.featured ? 1 : 0) - (a.featured ? 1 : 0)) || (a.name || '').localeCompare(b.name || '', 'zh-Hans-CN');
    });
    return out;
  }

  function avgScore(res) {
    var s = res.scores || {};
    return (Number(s.more || 0) + Number(s.speed || 0) + Number(s.clean || 0) + Number(s.stable || 0)) / 4;
  }

  function renderStats(list) {
    var counts = { reachable: 0, restricted: 0, unreachable: 0, unchecked: 0 };
    list.forEach(function (res) { counts[statusOf(res).key]++; });
    var chips = [];
    chips.push(statChip('all', '全部', counts, list.length));
    STATUS_ORDER.forEach(function (k) {
      chips.push(statChip(k, STATUS[k].label, counts, counts[k]));
    });
    el.stats.innerHTML = chips.join('');
  }

  function statChip(key, label, counts, num) {
    var dotCls = key === 'all' ? 'dot-all' : 'dot-' + STATUS[key].dot;
    return '<button class="stat-chip' + (state.status === key ? ' active' : '') + '" data-status="' + key + '">' +
      '<span class="dot ' + dotCls + '"></span>' + esc(label) + '<span class="num">' + num + '</span></button>';
  }

  function renderCats(list) {
    var per = {};
    list.forEach(function (res) { per[res.category] = (per[res.category] || 0) + 1; });
    var pills = [];
    pills.push(catPill('all', '全部', list.length));
    CATEGORIES.forEach(function (c) {
      if (per[c.id]) pills.push(catPill(c.id, c.icon + ' ' + c.label, per[c.id]));
    });
    // 未在固定分类里的兜底显示
    Object.keys(per).forEach(function (id) {
      if (!CATEGORIES.some(function (c) { return c.id === id; })) {
        pills.push(catPill(id, id, per[id]));
      }
    });
    el.catNav.innerHTML = pills.join('');
  }

  function catPill(id, label, cnt) {
    return '<button class="cat-pill' + (state.category === id ? ' active' : '') + '" data-cat="' + esc(id) + '">' +
      esc(label) + '<span class="cnt">' + cnt + '</span></button>';
  }

  function renderList(list) {
    if (!list.length) {
      el.list.innerHTML = '<div class="empty">没有匹配的资源 😢 换个关键词试试？</div>';
      return;
    }
    var html = list.map(itemHtml).join('');
    el.list.innerHTML = html;
  }

  function itemHtml(res) {
    var st = statusOf(res);
    var star = stars(res);
    var name = esc(res.name || res.id);
    var url = esc(res.url || '#');
    var link = (res.link_url || res.url || '#');
    var isConfig = res.category === 'tvbox_config';
    var copyLabel = isConfig ? '复制接口' : '复制地址';
    var copyVal = isConfig ? res.url : (res.url || '');

    var h = '<div class="item" data-cat="' + esc(res.category) + '" data-status="' + st.key + '">';
    h += '<div class="item-top">';
    h += '<a class="item-name" href="' + url + '" target="_blank" rel="noopener noreferrer" title="' + esc(res.summary || res.summary_short || '') + '">' + name + '</a>';
    h += '<span class="stars" title="推荐指数 ' + star.avg.toFixed(2) + '（多/快/净/稳 平均）">' + star.html + '</span>';
    h += '<span class="badge ' + st.info.cls + '" title="' + (st.av.checked_at ? '检测于 ' + st.av.checked_at : '尚未自动检测') + (st.av.final_url ? ' · 实际地址 ' + esc(st.av.final_url) : '') + '">' + st.info.label + '</span>';
    h += '</div>';
    if (res.summary_short) h += '<div class="item-summary">' + esc(res.summary_short) + '</div>';
    if (isConfig && res.url) {
      h += '<div class="item-config"><b>配置地址</b> ' + esc(res.url) + '</div>';
    }
    if (res.github) {
      h += '<div class="item-gh">⭐ ' + esc(String(res.github.stars || 0)) + ' · 仓库更新 ' + fmtDate(res.github.pushed_at) + '</div>';
    }
    if (res.tags && res.tags.length) {
      h += '<div class="item-tags">' + res.tags.map(function (t) { return '<span class="tag">' + esc(t) + '</span>'; }).join('') + '</div>';
    }
    var risks = riskChips(res);
    if (risks) h += '<div class="item-risks">' + risks + '</div>';
    h += '<div class="item-actions">';
    h += '<a class="btn small" href="' + esc(link) + '" target="_blank" rel="noopener noreferrer">↗ 访问</a>';
    h += '<button class="btn small" data-copy="' + esc(copyVal) + '">📋 ' + copyLabel + '</button>';
    h += '</div></div>';
    return h;
  }

  function renderAll() {
    if (!state.data) return;
    var list = filtered();
    renderStats(state.data.resources);
    renderCats(state.data.resources);
    renderList(list);
    el.metaLine.textContent = el.metaLine.textContent; // keep as-is
  }

  /* ---------- 事件 ---------- */

  el.stats.addEventListener('click', function (e) {
    var btn = e.target.closest('.stat-chip');
    if (!btn) return;
    state.status = btn.dataset.status === state.status ? 'all' : btn.dataset.status;
    renderAll();
  });

  el.catNav.addEventListener('click', function (e) {
    var btn = e.target.closest('.cat-pill');
    if (!btn) return;
    state.category = btn.dataset.cat === state.category ? 'all' : btn.dataset.cat;
    renderAll();
  });

  el.search.addEventListener('input', function () {
    state.query = el.search.value;
    renderAll();
  });

  el.sort.addEventListener('change', function () {
    state.sort = el.sort.value;
    renderAll();
  });

  el.list.addEventListener('click', function (e) {
    var btn = e.target.closest('button[data-copy]');
    if (btn) {
      copyText(btn.dataset.copy, btn, btn.dataset.copy.length > 40 ? '接口地址已复制，去影视仓粘贴即可' : '链接已复制');
    }
  });

  el.refresh.addEventListener('click', function () {
    el.refresh.disabled = true;
    el.refresh.textContent = '⏳ 正在同步…';
    fetchFresh().then(function (data) {
      applyData(data);
      toast('✅ 已同步上游最新数据（' + data.resources.length + ' 个资源）');
    }).catch(function () {
      toast('❌ 同步失败，当前仍显示上次数据');
    }).finally(function () {
      el.refresh.disabled = false;
      el.refresh.textContent = '🔄 刷新数据';
    });
  });

  /* 主题 */
  function applyTheme(t) {
    document.documentElement.setAttribute('data-theme', t);
    el.theme.textContent = t === 'dark' ? '☀️' : '🌙';
    try { localStorage.setItem('theme', t); } catch (e) {}
  }
  el.theme.addEventListener('click', function () {
    var cur = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
    applyTheme(cur === 'dark' ? 'light' : 'dark');
  });
  (function initTheme() {
    var saved = null;
    try { saved = localStorage.getItem('theme'); } catch (e) {}
    if (!saved) {
      saved = (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light';
    }
    applyTheme(saved);
  })();

  /* ---------- 启动 ---------- */
  function boot() {
    el.list.innerHTML = '<div class="loading"><div class="spinner"></div>正在加载资源数据…</div>';
    loadLocal().then(function (data) {
      if (!data || !data.resources) throw new Error('bad local data');
      applyData(data);
    }).catch(function () {
      toast('本地数据不可用，正在尝试在线获取…', 3000);
      return fetchFresh().then(function (data) { applyData(data); });
    }).catch(function () {
      el.list.innerHTML = '<div class="empty">数据加载失败，请稍后刷新重试。</div>';
      el.metaLine.textContent = '数据加载失败';
    });
  }
  boot();
})();
