// ============ API 请求封装 ============
const API = {
  base: '',
  async request(method, url, data) {
    const opts = {
      method,
      headers: { 'Content-Type': 'application/json' },
    };
    if (data) opts.body = JSON.stringify(data);
    const res = await fetch(this.base + url, opts);
    return res.json();
  },
  get(url) { return this.request('GET', url); },
  post(url, data) { return this.request('POST', url, data); },
  put(url, data) { return this.request('PUT', url, data); },

  // 用户
  createUser(nickname) { return this.post('/api/users', { nickname }); },
  getUser(id) { return this.get(`/api/users/${id}`); },
  updateUser(id, data) { return this.put(`/api/users/${id}`, data); },

  // 圈子
  createCircle(name) { return this.post('/api/circles', { name }); },
  joinCircle(userId, inviteCode) { return this.post('/api/circles/join', { userId, inviteCode }); },
  getCircle(id) { return this.get(`/api/circles/${id}`); },
  getCircleMembers(id) { return this.get(`/api/circles/${id}/members`); },
  getCircleToday(id) { return this.get(`/api/circles/${id}/today`); },
  getCircleTrends(id, metric, days) { return this.get(`/api/circles/${id}/trends?metric=${metric}&days=${days}`); },

  // 打卡
  checkinFood(data) { return this.post('/api/checkins/food', data); },
  checkinExercise(data) { return this.post('/api/checkins/exercise', data); },
  getFoodCheckins(userId, date) { return this.get(`/api/checkins/food?user_id=${userId}${date ? '&date=' + date : ''}`); },
  getExerciseCheckins(userId, date) { return this.get(`/api/checkins/exercise?user_id=${userId}${date ? '&date=' + date : ''}`); },

  // 记录
  recordWeight(data) { return this.post('/api/records/weight', data); },
  recordMood(data) { return this.post('/api/records/mood', data); },
  getWeightRecords(userId, start, end) { return this.get(`/api/records/weight?user_id=${userId}${start ? '&start=' + start : ''}${end ? '&end=' + end : ''}`); },
  getMoodRecords(userId, start, end) { return this.get(`/api/records/mood?user_id=${userId}${start ? '&start=' + start : ''}${end ? '&end=' + end : ''}`); },

  // 汇总 & 趋势
  getDailySummary(userId, date) { return this.get(`/api/users/${userId}/daily-summary${date ? '?date=' + date : ''}`); },
  getUserTrends(userId, days) { return this.get(`/api/users/${userId}/trends?days=${days}`); },
  getUserHistory(userId, params) {
    const qs = new URLSearchParams(params).toString();
    return this.get(`/api/users/${userId}/history?${qs}`);
  },

  // 食物
  searchFoods(search, category) { return this.get(`/api/foods?${search ? 'search=' + encodeURIComponent(search) : ''}${category ? '&category=' + category : ''}`); },
  getCategories() { return this.get('/api/foods/categories'); },
  getExercises() { return this.get('/api/exercises'); },

  // 上传
  async uploadPhoto(file) {
    const fd = new FormData();
    fd.append('photo', file);
    const res = await fetch('/api/upload', { method: 'POST', body: fd });
    return res.json();
  },
};

// ============ 状态管理 ============
const Store = {
  _state: {
    user: null,
    circle: null,
    page: 'auth',
    tab: 'home',
  },
  get(key) { return this._state[key]; },
  set(key, val) {
    this._state[key] = val;
    if (key === 'user') {
      if (val) localStorage.setItem('ft_user_id', val.id);
      else localStorage.removeItem('ft_user_id');
    }
    if (key === 'circle') {
      if (val) localStorage.setItem('ft_circle_id', val.id);
      else localStorage.removeItem('ft_circle_id');
    }
  },
  async restore() {
    const uid = localStorage.getItem('ft_user_id');
    if (uid) {
      try {
        const res = await API.getUser(uid);
        if (res.success && res.user) {
          this.set('user', res.user);
          if (res.user.circle_id) {
            const cr = await API.getCircle(res.user.circle_id);
            if (cr.success) this.set('circle', cr.circle);
          }
          return true;
        }
      } catch (e) {}
    }
    return false;
  },
};

// ============ 工具函数 ============
function $(sel) { return document.querySelector(sel); }
function $$(sel) { return document.querySelectorAll(sel); }
function today() { return new Date().toISOString().split('T')[0]; }
function fmtDate(d) { return d; }
function showToast(msg, type = 'info') {
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2000);
}

// ============ 页面路由 ============
function navigate(page) {
  Store.set('page', page);
  $$('.page').forEach(p => p.classList.remove('active'));
  const el = $(`#page-${page}`);
  if (el) el.classList.add('active');
  // 更新底部导航
  const navMap = { home: 'home', checkin: 'checkin', trends: 'trends', circle: 'circle', history: 'history', settings: 'settings' };
  $$('.nav-item').forEach(n => n.classList.remove('active'));
  const navTarget = navMap[page];
  if (navTarget) {
    const navItem = $(`.nav-item[data-page="${navTarget}"]`);
    if (navItem) navItem.classList.add('active');
  }
  // 显示/隐藏底部导航
  const nav = $('#bottom-nav');
  if (nav) nav.style.display = ['auth', 'login'].includes(page) ? 'none' : 'flex';
  // 渲染页面
  renderPage(page);
}

function renderPage(page) {
  switch (page) {
    case 'auth': renderAuth(); break;
    case 'home': renderHome(); break;
    case 'checkin': renderCheckin(); break;
    case 'trends': renderTrends(); break;
    case 'circle': renderCircle(); break;
    case 'history': renderHistory(); break;
    case 'settings': renderSettings(); break;
  }
}

// ============ 心情 SVG 线条图标 ============
function moodSVG(level, size = 36) {
  const colors = ['#FC8181', '#F6AD55', '#F6E05E', '#68D391', '#7FCCB6'];
  const mouths = [
    'M14 24 Q18 18 22 24',  // 很难过
    'M14 23 Q18 20 22 23',  // 难过
    'M14 22 L22 22',         // 一般
    'M14 20 Q18 23 22 20',  // 开心
    'M14 18 Q18 24 22 18',  // 超开心
  ];
  const eyeStyles = level <= 2 ? 'M11 12 L13 14 M11 14 L13 12 M23 12 L25 14 M23 14 L25 12' : 'M10 11 A2 2 0 1 1 14 11 M22 11 A2 2 0 1 1 26 11';
  return `<svg width="${size}" height="${size}" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="18" cy="18" r="16" stroke="${colors[level-1]}" stroke-width="2" fill="none"/>
    <path d="${eyeStyles}" stroke="${colors[level-1]}" stroke-width="2" stroke-linecap="round"/>
    <path d="${mouths[level-1]}" stroke="${colors[level-1]}" stroke-width="2" stroke-linecap="round"/>
  </svg>`;
}

function moodLabel(level) {
  return ['😢 很难过', '😔 有点低落', '😐 一般般', '😊 挺开心', '🥰 超棒'][level - 1];
}

// ============ 初始化 ============
async function init() {
  const restored = await Store.restore();
  if (restored) {
    navigate('home');
  } else {
    navigate('auth');
  }
  // 导航点击事件
  $$('.nav-item').forEach(item => {
    item.addEventListener('click', () => {
      const page = item.dataset.page;
      navigate(page);
    });
  });
}

document.addEventListener('DOMContentLoaded', init);
