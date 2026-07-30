// ============ 轻减 - 多人减脂打卡工具 ============
// 所有 JS 合并到一个文件，确保微信浏览器兼容性

(function() {
'use strict';

// ============ 工具函数 ============
function $(sel) { return document.querySelector(sel); }
function $$(sel) { return document.querySelectorAll(sel); }
function today() { return new Date().toISOString().split('T')[0]; }
function showToast(msg, type) {
  type = type || 'info';
  var t = document.createElement('div');
  t.className = 'toast ' + type;
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(function() { t.remove(); }, 2000);
}

// ============ 心情 SVG 线条图标 ============
function moodSVG(level, size) {
  size = size || 36;
  var colors = ['#FC8181', '#F6AD55', '#F6E05E', '#68D391', '#7FCCB6'];
  var mouths = [
    'M14 24 Q18 18 22 24',
    'M14 23 Q18 20 22 23',
    'M14 22 L22 22',
    'M14 20 Q18 23 22 20',
    'M14 18 Q18 24 22 18',
  ];
  var eyeStyles = level <= 2 ? 'M11 12 L13 14 M11 14 L13 12 M23 12 L25 14 M23 14 L25 12' : 'M10 11 A2 2 0 1 1 14 11 M22 11 A2 2 0 1 1 26 11';
  return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">' +
    '<circle cx="18" cy="18" r="16" stroke="' + colors[level-1] + '" stroke-width="2" fill="none"/>' +
    '<path d="' + eyeStyles + '" stroke="' + colors[level-1] + '" stroke-width="2" stroke-linecap="round"/>' +
    '<path d="' + mouths[level-1] + '" stroke="' + colors[level-1] + '" stroke-width="2" stroke-linecap="round"/>' +
    '</svg>';
}

function moodLabel(level) {
  return ['😢 很难过', '😔 有点低落', '😐 一般般', '😊 挺开心', '🥰 超棒'][level - 1];
}

// ============ API 封装 ============
var API = {
  base: '',
  request: function(method, url, data) {
    var opts = { method: method, headers: { 'Content-Type': 'application/json' } };
    if (data) opts.body = JSON.stringify(data);
    return fetch(this.base + url, opts).then(function(res) { return res.json(); });
  },
  get: function(url) { return this.request('GET', url); },
  post: function(url, data) { return this.request('POST', url, data); },
  put: function(url, data) { return this.request('PUT', url, data); },
  createUser: function(nickname) { return this.post('/api/users', { nickname: nickname }); },
  getUser: function(id) { return this.get('/api/users/' + id); },
  updateUser: function(id, data) { return this.put('/api/users/' + id, data); },
  createCircle: function(name) { return this.post('/api/circles', { name: name }); },
  joinCircle: function(userId, inviteCode) { return this.post('/api/circles/join', { userId: userId, inviteCode: inviteCode }); },
  getCircle: function(id) { return this.get('/api/circles/' + id); },
  getCircleMembers: function(id) { return this.get('/api/circles/' + id + '/members'); },
  getCircleToday: function(id) { return this.get('/api/circles/' + id + '/today'); },
  getCircleTrends: function(id, metric, days) { return this.get('/api/circles/' + id + '/trends?metric=' + metric + '&days=' + (days || 30)); },
  checkinFood: function(data) { return this.post('/api/checkins/food', data); },
  checkinExercise: function(data) { return this.post('/api/checkins/exercise', data); },
  getFoodCheckins: function(userId, date) {
    var url = '/api/checkins/food?user_id=' + userId;
    if (date) url += '&date=' + date;
    return this.get(url);
  },
  getExerciseCheckins: function(userId, date) {
    var url = '/api/checkins/exercise?user_id=' + userId;
    if (date) url += '&date=' + date;
    return this.get(url);
  },
  recordWeight: function(data) { return this.post('/api/records/weight', data); },
  recordMood: function(data) { return this.post('/api/records/mood', data); },
  recordWater: function(data) { return this.post('/api/records/water', data); },
  getWaterRecords: function(userId, date) {
    var url = '/api/records/water?user_id=' + userId;
    if (date) url += '&date=' + date;
    return this.get(url);
  },
  getWeightRecords: function(userId, start, end) {
    var url = '/api/records/weight?user_id=' + userId;
    if (start) url += '&start=' + start;
    if (end) url += '&end=' + end;
    return this.get(url);
  },
  getMoodRecords: function(userId, start, end) {
    var url = '/api/records/mood?user_id=' + userId;
    if (start) url += '&start=' + start;
    if (end) url += '&end=' + end;
    return this.get(url);
  },
  getDailySummary: function(userId, date) {
    var url = '/api/users/' + userId + '/daily-summary';
    if (date) url += '?date=' + date;
    return this.get(url);
  },
  getUserTrends: function(userId, days) {
    return this.get('/api/users/' + userId + '/trends?days=' + (days || 30));
  },
  getUserHistory: function(userId, params) {
    var parts = [];
    for (var k in params) {
      if (params[k] !== undefined && params[k] !== null && params[k] !== '') {
        parts.push(encodeURIComponent(k) + '=' + encodeURIComponent(params[k]));
      }
    }
    return this.get('/api/users/' + userId + '/history?' + parts.join('&'));
  },
  searchFoods: function(search, category) {
    var url = '/api/foods?';
    if (search) url += 'search=' + encodeURIComponent(search);
    if (category) url += (search ? '&' : '') + 'category=' + encodeURIComponent(category);
    return this.get(url);
  },
  getCategories: function() { return this.get('/api/foods/categories'); },
  getExercises: function() { return this.get('/api/exercises'); },
  uploadPhoto: function(file) {
    var fd = new FormData();
    fd.append('photo', file);
    return fetch('/api/upload', { method: 'POST', body: fd }).then(function(res) { return res.json(); });
  },
};

// ============ 状态管理 ============
var Store = {
  _state: { user: null, circle: null, page: 'auth' },
  get: function(key) { return this._state[key]; },
  set: function(key, val) {
    this._state[key] = val;
    try {
      if (key === 'user') {
        if (val) localStorage.setItem('ft_user_id', val.id);
        else localStorage.removeItem('ft_user_id');
      }
      if (key === 'circle') {
        if (val) localStorage.setItem('ft_circle_id', val.id);
        else localStorage.removeItem('ft_circle_id');
      }
    } catch(e) {}
  },
  restore: function() {
    var self = this;
    try {
      var uid = localStorage.getItem('ft_user_id');
      if (uid) {
        return API.getUser(uid).then(function(res) {
          if (res.success && res.user) {
            self.set('user', res.user);
            if (res.user.circle_id) {
              return API.getCircle(res.user.circle_id).then(function(cr) {
                if (cr.success) self.set('circle', cr.circle);
                return true;
              });
            }
            return true;
          }
          return false;
        }).catch(function() { return false; });
      }
    } catch(e) {}
    return Promise.resolve(false);
  },
};

// ============ 页面路由 ============
function navigate(page) {
  Store.set('page', page);

  // 切换页面显示
  var pages = $$('.page');
  for (var i = 0; i < pages.length; i++) {
    pages[i].classList.remove('active');
    pages[i].style.display = 'none';
  }
  var el = $('#page-' + page);
  if (el) {
    el.classList.add('active');
    el.style.display = 'block';
  }

  // 底部导航
  var navItems = $$('.nav-item');
  for (var j = 0; j < navItems.length; j++) navItems[j].classList.remove('active');
  var navMap = { home: 'home', checkin: 'checkin', trends: 'trends', circle: 'circle', history: 'history', settings: 'settings' };
  var navTarget = navMap[page];
  if (navTarget) {
    var ni = document.querySelector('.nav-item[data-page="' + navTarget + '"]');
    if (ni) ni.classList.add('active');
  }

  var nav = $('#bottom-nav');
  if (nav) nav.style.display = (page === 'auth') ? 'none' : 'flex';

  renderPage(page);
}

function renderPage(page) {
  switch (page) {
    case 'auth': break; // auth 页是静态的
    case 'home': renderHome(); break;
    case 'checkin': renderCheckin(); break;
    case 'trends': renderTrends(); break;
    case 'circle': renderCircle(); break;
    case 'history': renderHistory(); break;
    case 'settings': renderSettings(); break;
  }
}

// ============ 登录逻辑 ============
function doLogin() {
  var nickname = $('#auth-nickname').value.trim();
  if (!nickname) { showToast('请输入昵称', 'error'); return; }
  var btn = $('#btn-start');
  btn.disabled = true;
  btn.textContent = '创建中…';
  API.createUser(nickname).then(function(res) {
    btn.disabled = false;
    btn.textContent = '开始使用';
    if (res.success) {
      Store.set('user', res.user);
      showToast('欢迎，' + res.user.nickname + '！', 'success');
      if (!res.user.height || !res.user.weight || !res.user.age) {
        navigate('settings');
      } else {
        navigate('home');
      }
    } else {
      showToast(res.error || '创建失败', 'error');
    }
  }).catch(function(e) {
    btn.disabled = false;
    btn.textContent = '开始使用';
    showToast('网络错误，请重试', 'error');
  });
}

function showJoinCircle() {
  var nickname = $('#auth-nickname').value.trim();
  if (!nickname) { showToast('请先输入昵称', 'error'); return; }
  var inviteCode = prompt('请输入6位圈子邀请码：');
  if (!inviteCode) return;
  API.createUser(nickname).then(function(res) {
    if (!res.success) { showToast(res.error, 'error'); return; }
    Store.set('user', res.user);
    return API.joinCircle(res.user.id, inviteCode);
  }).then(function(joinRes) {
    if (joinRes && joinRes.success) {
      Store.set('circle', joinRes.circle);
      Store.set('user', joinRes.user);
      showToast('已加入圈子「' + joinRes.circle.name + '」', 'success');
      if (!Store.get('user').height) { navigate('settings'); }
      else { navigate('home'); }
    } else if (joinRes) {
      showToast(joinRes.error || '加入失败', 'error');
      navigate('home');
    }
  }).catch(function() { showToast('网络错误', 'error'); });
}

// ============ 主页 ============
function renderHome() {
  var user = Store.get('user');
  if (!user) { navigate('auth'); return; }
  var circle = Store.get('circle');
  var cnEl = $('#home-circle-name');
  if (cnEl) cnEl.textContent = circle ? '👥 ' + circle.name : '';
  loadHomeSummary();
}

function loadHomeSummary() {
  var user = Store.get('user');
  API.getDailySummary(user.id).then(function(res) {
    if (!res.success) return;
    var s = res.summary;
    var bmr = s.bmr || 0;
    var intake = s.total_calories_intake || 0;
    var burned = s.total_calories_burned || 0;
    var tdee = s.tdee || bmr;
    var deficit = s.deficit || 0;
    var deficitAbs = Math.abs(deficit);
    var isDeficit = deficit < 0;
    var intakePercent = bmr > 0 ? Math.min(100, Math.round((intake / tdee) * 100)) : 0;
    var waterMl = s.water_ml || 0;
    var waterPercent = Math.min(100, Math.round(waterMl / 20)); // 目标2000ml

    var html = '<div class="glass-card" style="text-align:center;">' +
      '<div style="font-size:var(--font-xs);color:var(--text-secondary);margin-bottom:4px;">今日热量收支</div>' +
      '<div style="font-size:42px;font-weight:800;color:' + (isDeficit ? 'var(--success)' : 'var(--danger)') + ';">' +
      (isDeficit ? '-' : '+') + deficitAbs + ' <span style="font-size:var(--font-md);">kcal</span></div>' +
      '<div style="font-size:var(--font-xs);color:var(--text-muted);">' + (isDeficit ? '消耗 > 摄入，继续加油 🔥' : '摄入 > 消耗，注意控制') + '</div>' +
      '<div class="progress-bar" style="margin-top:12px;"><div class="progress-fill ' + (intakePercent > 100 ? 'orange' : 'green') + '" style="width:' + intakePercent + '%;"></div></div>' +
      '<div style="display:flex;justify-content:space-between;font-size:var(--font-xs);color:var(--text-muted);margin-top:4px;"><span>🍽 摄入 ' + intake + '</span><span>🔥 消耗 ' + tdee + '</span></div></div>';

    html += '<div class="stat-row col4">' +
      '<div class="stat-card primary"><div class="stat-value">' + bmr + '</div><div class="stat-label">基础代谢</div></div>' +
      '<div class="stat-card"><div class="stat-value">' + intake + '</div><div class="stat-label">饮食摄入</div></div>' +
      '<div class="stat-card accent"><div class="stat-value">' + burned + '</div><div class="stat-label">运动消耗</div></div>' +
      '<div class="stat-card" style="color:#4FD1C5;"><div class="stat-value">' + waterMl + '</div><div class="stat-label">喝水 ml</div></div></div>';

    // 喝水进度条
    html += '<div class="glass-card" style="padding:12px 18px;">' +
      '<div style="display:flex;justify-content:space-between;font-size:var(--font-xs);margin-bottom:4px;"><span>💧 喝水进度</span><span style="color:var(--text-muted);">' + waterMl + ' / 2000 ml</span></div>' +
      '<div class="progress-bar"><div class="progress-fill blue" style="width:' + waterPercent + '%;"></div></div></div>';

    if (s.weight) {
      html += '<div class="stat-row col3">' +
        '<div class="stat-card"><div class="stat-value">' + s.weight + '</div><div class="stat-label">体重 kg</div></div>' +
        '<div class="stat-card"><div class="stat-value">' + (s.total_exercise_min || 0) + '</div><div class="stat-label">运动 min</div></div>' +
        '<div class="stat-card warning"><div class="stat-value">' + (s.mood ? moodSVG(s.mood.mood_level, 24) + '<span style="font-size:var(--font-xs);display:block;">' + moodLabel(s.mood.mood_level) + '</span>' : '--') + '</div><div class="stat-label">今日心情</div></div></div>';
    }

    $('#home-summary').innerHTML = html;

    var timelineHtml = '';
    if (s.food_checkins && s.food_checkins.length > 0) {
      s.food_checkins.forEach(function(f) {
        var mealMap = { breakfast: '早餐', lunch: '午餐', dinner: '晚餐', snack: '加餐' };
        timelineHtml += '<div class="timeline-item"><div class="timeline-icon">🍽</div><div class="timeline-content"><div class="title">' + f.food_name + ' ' + f.amount_g + 'g</div><div class="subtitle">' + f.calories + ' kcal · ' + (mealMap[f.meal_type] || f.meal_type) + '</div></div></div>';
      });
    }
    if (s.exercise_checkins && s.exercise_checkins.length > 0) {
      s.exercise_checkins.forEach(function(e) {
        timelineHtml += '<div class="timeline-item"><div class="timeline-icon">🏃</div><div class="timeline-content"><div class="title">' + e.exercise_type + ' ' + e.duration_min + '分钟</div><div class="subtitle">消耗 ' + e.calories_burned + ' kcal</div></div></div>';
      });
    }
    if (waterMl > 0) {
      timelineHtml += '<div class="timeline-item"><div class="timeline-icon">💧</div><div class="timeline-content"><div class="title">喝水 ' + waterMl + 'ml</div><div class="subtitle">今日已喝 ' + (s.water_count || 0) + ' 次</div></div></div>';
    }
    if (!timelineHtml) timelineHtml = '<div class="empty-state"><p>今天还没有打卡记录<br>点击上方按钮开始吧 ✨</p></div>';
    $('#home-timeline').innerHTML = timelineHtml;
  });
}

// ============ 打卡页 ============
var checkinTab = 'food';
var selectedFood = null;
var selectedMealType = 'lunch';
var selectedExercise = null;
var selectedMood = null;
var uploadedPhotoPath = '';
var allFoods = [];
var allCategories = [];
var allExercises = [];

function renderCheckin() {
  Promise.all([loadFoodCategories(), loadExercises()]).then(function() {
    selectCheckinTab(checkinTab);
  });
}

function selectCheckinTab(tab) {
  checkinTab = tab;
  var tabItems = $$('#checkin-tabs .tab-item');
  for (var i = 0; i < tabItems.length; i++) tabItems[i].classList.remove('active');
  var btn = document.querySelector('#checkin-tabs [data-tab="' + tab + '"]');
  if (btn) btn.classList.add('active');
  ['food', 'exercise', 'weight', 'mood', 'water'].forEach(function(t) {
    var panel = $('#checkin-' + t + '-panel');
    if (panel) panel.style.display = t === tab ? 'block' : 'none';
  });
  switch (tab) {
    case 'food': renderFoodCheckin(); break;
    case 'exercise': renderExerciseCheckin(); break;
    case 'weight': renderWeightCheckin(); break;
    case 'mood': renderMoodCheckin(); break;
    case 'water': renderWaterCheckin(); break;
  }
}

function renderFoodCheckin() {
  $('#checkin-food-panel').innerHTML =
    '<div class="glass-card"><div style="text-align:center;padding:20px;">' +
    '<div style="font-size:48px;margin-bottom:8px;">🍽️</div>' +
    '<div style="font-size:var(--font-sm);color:var(--text-secondary);margin-bottom:16px;">记录今日饮食</div>' +
    '<button class="glass-btn primary" style="width:100%;margin-bottom:8px;" id="btn-open-food-selector">🔍 从食物库选择</button>' +
    '<button class="glass-btn" style="width:100%;" id="btn-quick-calorie">⚡ 快速录��热量</button></div></div>' +
    // 快速录入面板（默认隐藏）
    '<div class="glass-card" id="quick-calorie-panel" style="display:none;margin-top:12px;">' +
    '<div style="font-weight:600;margin-bottom:12px;">⚡ 快速录入</div>' +
    '<div class="form-group"><label>食物名称（可选）</label><input id="quick-food-name" class="glass-input" placeholder="例如：自制沙拉、外卖套餐…"></div>' +
    '<div class="form-group"><label>热量（kcal）</label><input id="quick-calories" class="glass-input" type="number" placeholder="例如：450" min="1"></div>' +
    '<div class="form-group"><label>餐别</label><div class="chip-group" id="quick-meal-group"><button class="chip active" data-meal="breakfast">早餐</button><button class="chip" data-meal="lunch">午餐</button><button class="chip" data-meal="dinner">晚餐</button><button class="chip" data-meal="snack">加餐</button></div></div>' +
    '<button class="glass-btn primary" style="width:100%;" id="btn-quick-submit">✅ 记录</button></div>';
}

function loadFoodCategories() {
  return API.getCategories().then(function(res) {
    if (res.success) allCategories = res.categories;
  });
}

function openFoodSelector(aiFoods) {
  $('#food-modal').classList.add('active');
  selectedFood = null;
  $('#food-amount').style.display = 'none';
  $('#food-amount-input').value = '100';
  var catHtml = '<button class="chip active" data-cat="">全部</button>';
  allCategories.forEach(function(c) {
    catHtml += '<button class="chip" data-cat="' + c + '">' + c + '</button>';
  });
  $('#food-categories').innerHTML = catHtml;
  filterFoods(null, null, aiFoods);
}

function closeFoodModal() {
  $('#food-modal').classList.remove('active');
  selectedFood = null;
}

function filterFoods(category, btn, aiFoods) {
  if (btn) {
    var chips = $$('#food-categories .chip');
    for (var i = 0; i < chips.length; i++) chips[i].classList.remove('active');
    btn.classList.add('active');
  }
  var search = $('#food-search') ? $('#food-search').value.trim() : '';
  API.searchFoods(search, category).then(function(res) {
    if (!res.success) return;
    allFoods = res.foods;

    // AI 推荐食物置顶
    var aiNames = [];
    if (aiFoods && aiFoods.length > 0) {
      aiNames = aiFoods.map(function(f) { return f.name; });
    }

    var html = '';
    // AI 推荐区域
    if (aiFoods && aiFoods.length > 0) {
      html += '<div style="padding:8px 16px;font-size:var(--font-xs);color:var(--accent);font-weight:600;">🤖 AI 识别推荐</div>';
      aiFoods.forEach(function(af) {
        var matched = allFoods.find(function(f) { return f.name === af.name; });
        if (matched) {
          html += '<div class="food-item" style="background:rgba(110,181,255,0.08);" data-name="' + matched.name + '" data-cal="' + matched.calories + '" data-protein="' + matched.protein + '" data-fat="' + matched.fat + '" data-carbs="' + matched.carbs + '" data-cat="' + matched.category + '"><div class="food-info"><div class="food-name">' + matched.name + (af.confidence ? ' <span style="font-size:10px;color:var(--accent);">' + af.confidence + '%</span>' : '') + '</div><div class="food-meta">' + matched.category + ' · 蛋白质' + matched.protein + 'g 脂肪' + matched.fat + 'g 碳水' + matched.carbs + 'g</div></div><div class="food-cal">' + matched.calories + ' kcal/100g</div></div>';
        }
      });
      html += '<div style="padding:8px 16px;font-size:var(--font-xs);color:var(--text-muted);border-bottom:1px solid rgba(0,0,0,0.05);margin-bottom:4px;">— 全部食物 —</div>';
    }

    // 普通食物列表（排除已推荐的）
    allFoods.forEach(function(f) {
      if (aiNames.indexOf(f.name) >= 0) return; // 已在上方推荐
      html += '<div class="food-item" data-name="' + f.name + '" data-cal="' + f.calories + '" data-protein="' + f.protein + '" data-fat="' + f.fat + '" data-carbs="' + f.carbs + '" data-cat="' + f.category + '"><div class="food-info"><div class="food-name">' + f.name + '</div><div class="food-meta">' + f.category + ' · 蛋白质' + f.protein + 'g 脂肪' + f.fat + 'g 碳水' + f.carbs + 'g</div></div><div class="food-cal">' + f.calories + ' kcal/100g</div></div>';
    });
    if (!html) html = '<div class="empty-state"><p>没有找到匹配的食物</p></div>';
    $('#food-list').innerHTML = html;
  });
}

function selectFood(name, cal, protein, fat, carbs, category) {
  selectedFood = { name: name, cal: cal, protein: protein, fat: fat, carbs: carbs, category: category };
  $('#food-amount').style.display = 'block';
}

function selectMealType(type, btn) {
  selectedMealType = type;
  var chips = $$('#meal-type-group .chip');
  for (var i = 0; i < chips.length; i++) chips[i].classList.remove('active');
  btn.classList.add('active');
}

function submitFoodCheckin() {
  if (!selectedFood) { showToast('请先选择食物', 'error'); return; }
  var amount = parseFloat($('#food-amount-input').value);
  if (!amount || amount <= 0) { showToast('请输入有效分量', 'error'); return; }
  var user = Store.get('user');
  API.checkinFood({
    user_id: user.id,
    food_name: selectedFood.name,
    category: selectedFood.category,
    amount_g: amount,
    meal_type: selectedMealType,
    photo_path: uploadedPhotoPath,
  }).then(function(res) {
    if (res.success) {
      showToast('已记录：' + selectedFood.name + ' ' + res.nutrition.calories + 'kcal', 'success');
      closeFoodModal();
      uploadedPhotoPath = '';
      navigate('home');
    } else {
      showToast(res.error || '打卡失败', 'error');
    }
  });
}

// 快速录入热量
function submitQuickCalorie() {
  var calories = parseFloat(($('#quick-calories') || {}).value);
  if (!calories || calories <= 0) { showToast('请输入热量', 'error'); return; }
  var foodName = ($('#quick-food-name') || {}).value;
  if (!foodName || !foodName.trim()) foodName = '快速记录';

  // 获取餐别
  var mealType = 'lunch';
  var activeMeal = document.querySelector('#quick-meal-group .chip.active');
  if (activeMeal) mealType = activeMeal.dataset.meal;

  var user = Store.get('user');
  API.checkinFood({
    user_id: user.id,
    food_name: foodName.trim(),
    category: '自定义',
    amount_g: 100,
    calories: Math.round(calories),
    protein: 0,
    fat: 0,
    carbs: 0,
    meal_type: mealType,
    photo_path: '',
  }).then(function(res) {
    if (res.success) {
      showToast('已记录：' + foodName.trim() + ' ' + calories + 'kcal', 'success');
      // 隐藏快速面板
      var panel = $('#quick-calorie-panel');
      if (panel) panel.style.display = 'none';
      // 清空输入
      var qc = $('#quick-calories');
      if (qc) qc.value = '';
      var qn = $('#quick-food-name');
      if (qn) qn.value = '';
      navigate('home');
    } else {
      showToast(res.error || '记录失败', 'error');
    }
  });
}

// ============ 运动打卡 ============
function loadExercises() {
  return API.getExercises().then(function(res) {
    if (res.success) allExercises = res.exercises;
  });
}

function renderExerciseCheckin() {
  var gridHtml = '';
  allExercises.forEach(function(e) {
    gridHtml += '<div class="exercise-item" data-name="' + e.name + '" data-met="' + e.met + '"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="28" height="28">' + getExerciseIcon(e.name) + '</svg><span>' + e.name + '</span><span style="font-size:10px;color:var(--text-muted);">MET ' + e.met + '</span></div>';
  });
  // 添加自定义入口
  gridHtml += '<div class="exercise-item" data-name="__custom__" data-met="0" style="border:2px dashed var(--text-muted);"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="28" height="28"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg><span>自定义</span><span style="font-size:10px;color:var(--text-muted);">手动录入</span></div>';

  $('#checkin-exercise-panel').innerHTML =
    '<div class="glass-card"><div style="font-weight:600;margin-bottom:12px;">选择运动类型</div><div class="exercise-grid">' + gridHtml + '</div>' +
    '<div id="exercise-detail" style="display:none;"><div class="form-group"><label>运动时长（分钟）</label><input id="exercise-duration" class="glass-input" type="number" placeholder="例如：30" min="1" value="30"></div>' +
    '<div id="exercise-preview" style="text-align:center;padding:8px;font-size:var(--font-sm);color:var(--text-secondary);margin-bottom:12px;"></div>' +
    '<button class="glass-btn primary" style="width:100%;" id="btn-exercise-submit">✅ 确认打卡</button></div>' +
    // 自定义运动消耗录入
    '<div id="custom-exercise-detail" style="display:none;margin-top:12px;">' +
    '<div style="font-weight:600;margin-bottom:8px;font-size:var(--font-sm);color:var(--text-secondary);">📝 自定义运动记录</div>' +
    '<div class="form-group"><label>运动名称</label><input id="custom-exercise-name" class="glass-input" placeholder="例如：爬楼梯、遛狗…"></div>' +
    '<div class="form-group"><label>时长（分钟）</label><input id="custom-exercise-duration" class="glass-input" type="number" placeholder="例如：45" min="1" value="30"></div>' +
    '<div class="form-group"><label>消耗热量（kcal���</label><input id="custom-exercise-calories" class="glass-input" type="number" placeholder="例如：200" min="1"></div>' +
    '<button class="glass-btn primary" style="width:100%;" id="btn-custom-exercise-submit">✅ 记录自定义运动</button></div>' +
    '</div>';

  var durInput = $('#exercise-duration');
  if (durInput) durInput.addEventListener('input', updateExercisePreview);
}

function selectExercise(name, met, el) {
  if (name === '__custom__') {
    // 自定义模式
    selectedExercise = null;
    var items = $$('.exercise-item');
    for (var i = 0; i < items.length; i++) items[i].classList.remove('selected');
    el.classList.add('selected');
    $('#exercise-detail').style.display = 'none';
    $('#custom-exercise-detail').style.display = 'block';
    return;
  }
  selectedExercise = { name: name, met: met };
  var items = $$('.exercise-item');
  for (var i = 0; i < items.length; i++) items[i].classList.remove('selected');
  el.classList.add('selected');
  $('#exercise-detail').style.display = 'block';
  $('#custom-exercise-detail').style.display = 'none';
  updateExercisePreview();
}

function submitCustomExercise() {
  var name = ($('#custom-exercise-name') || {}).value;
  if (!name || !name.trim()) { showToast('请输入运动名称', 'error'); return; }
  var duration = parseFloat(($('#custom-exercise-duration') || {}).value);
  if (!duration || duration <= 0) { showToast('请输入有效时长', 'error'); return; }
  var calories = parseFloat(($('#custom-exercise-calories') || {}).value);
  if (!calories || calories <= 0) { showToast('请输入消耗热量', 'error'); return; }

  var user = Store.get('user');
  // 对于自定义运动，我们直接用用户输入的热量，MET 反推（用于数据库记录）
  var metValue = user.weight ? Math.round((calories / user.weight / (duration / 60)) * 10) / 10 : 0;

  API.checkinExercise({
    user_id: user.id,
    exercise_type: name.trim(),
    duration_min: duration,
    met_value: metValue,
  }).then(function(res) {
    if (res.success) {
      showToast('已记录：' + name.trim() + ' 消耗' + calories + 'kcal', 'success');
      navigate('home');
    } else {
      showToast(res.error || '记录失败', 'error');
    }
  });
}

// ============ 体重记录 ============
function renderWeightCheckin() {
  var user = Store.get('user');
  $('#checkin-weight-panel').innerHTML =
    '<div class="glass-card"><div style="text-align:center;padding:10px;"><div style="font-size:var(--font-2xl);font-weight:800;color:var(--primary-dark);">⚖️</div><div style="font-size:var(--font-sm);color:var(--text-secondary);margin:8px 0;">当前体重：<strong>' + (user.weight || '未设置') + '</strong> kg</div></div>' +
    '<div class="form-group"><label>今日体重（kg）</label><input id="weight-input" class="glass-input" type="number" step="0.1" placeholder="例如：65.0" value="' + (user.weight || '') + '"></div>' +
    '<button class="glass-btn primary" style="width:100%;" id="btn-weight-submit">💾 记录体重</button></div>';
}

function submitWeightRecord() {
  var weight = parseFloat($('#weight-input').value);
  if (!weight || weight <= 0) { showToast('请输入有效体重', 'error'); return; }
  var user = Store.get('user');
  API.recordWeight({ user_id: user.id, weight: weight }).then(function(res) {
    if (res.success) {
      user.weight = weight;
      Store.set('user', user);
      showToast('体重已记录：' + weight + ' kg', 'success');
      navigate('home');
    } else {
      showToast(res.error || '记录失败', 'error');
    }
  });
}

// ============ 心情记录 ============
function renderMoodCheckin() {
  var moodHtml = '';
  var labels = ['很难过', '有点低落', '一般般', '挺开心', '超棒'];
  for (var i = 1; i <= 5; i++) {
    moodHtml += '<button class="mood-icon" data-level="' + i + '">' + moodSVG(i, 40) + '<span>' + labels[i-1] + '</span></button>';
  }
  $('#checkin-mood-panel').innerHTML =
    '<div class="glass-card"><div style="text-align:center;font-weight:600;margin-bottom:12px;">今天心情如何？</div><div class="mood-icons">' + moodHtml + '</div>' +
    '<div class="form-group"><label>心情笔记（可选）</label><input id="mood-note" class="glass-input" placeholder="记录一下今天的心情…"></div>' +
    '<button class="glass-btn primary" style="width:100%;" id="btn-mood-submit">💾 记录心情</button></div>';
}

function selectMood(level, btn) {
  selectedMood = level;
  var icons = $$('.mood-icon');
  for (var i = 0; i < icons.length; i++) icons[i].classList.remove('selected');
  btn.classList.add('selected');
}

function submitMoodRecord() {
  if (!selectedMood) { showToast('请选择心情', 'error'); return; }
  var note = $('#mood-note').value.trim();
  var user = Store.get('user');
  API.recordMood({ user_id: user.id, mood_level: selectedMood, note: note }).then(function(res) {
    if (res.success) {
      showToast('心情已记录 ✨', 'success');
      selectedMood = null;
      navigate('home');
    } else {
      showToast(res.error || '记录失败', 'error');
    }
  });
}

// ============ 喝水记录 ============
function renderWaterCheckin() {
  var user = Store.get('user');
  // 获取今日已喝水量
  API.getWaterRecords(user.id, today()).then(function(res) {
    var totalMl = 0;
    if (res.success && res.records) {
      totalMl = res.records.reduce(function(s, r) { return s + r.amount_ml; }, 0);
    }

    $('#checkin-water-panel').innerHTML =
      '<div class="glass-card" style="text-align:center;">' +
      '<div style="font-size:48px;margin-bottom:8px;">💧</div>' +
      '<div style="font-size:var(--font-2xl);font-weight:800;color:#4FD1C5;">' + totalMl + ' <span style="font-size:var(--font-md);">ml</span></div>' +
      '<div style="font-size:var(--font-xs);color:var(--text-muted);">今日已喝 / 目标 2000ml</div>' +
      '<div class="progress-bar" style="margin:12px 0;"><div class="progress-fill blue" style="width:' + Math.min(100, Math.round(totalMl / 20)) + '%;"></div></div>' +
      '<div class="chip-group" style="justify-content:center;margin-bottom:12px;">' +
      '<button class="chip" data-ml="100" data-type="水" style="font-size:var(--font-md);">💧 100ml</button>' +
      '<button class="chip" data-ml="200" data-type="水" style="font-size:var(--font-md);">💧 200ml</button>' +
      '<button class="chip" data-ml="300" data-type="水" style="font-size:var(--font-md);">💧 300ml</button>' +
      '<button class="chip" data-ml="500" data-type="水" style="font-size:var(--font-md);">💧 500ml</button>' +
      '</div>' +
      '<div class="chip-group" style="justify-content:center;margin-bottom:12px;">' +
      '<button class="chip" data-ml="250" data-type="茶">🍵 茶 250ml</button>' +
      '<button class="chip" data-ml="250" data-type="咖啡">☕ 咖啡 250ml</button>' +
      '<button class="chip" data-ml="300" data-type="牛奶">🥛 牛奶 300ml</button>' +
      '</div>' +
      '<div style="display:flex;gap:8px;margin-top:8px;">' +
      '<input id="water-custom-ml" class="glass-input" type="number" placeholder="自定义 ml" style="flex:1;">' +
      '<button class="glass-btn primary" id="btn-water-custom" style="white-space:nowrap;">+ 记录</button></div></div>';
  });
}

function submitWaterRecord(ml, type) {
  var user = Store.get('user');
  API.recordWater({ user_id: user.id, amount_ml: ml, drink_type: type || '水' }).then(function(res) {
    if (res.success) {
      showToast('已记录喝水 ' + ml + 'ml (今日共 ' + res.total_ml + 'ml)', 'success');
      renderWaterCheckin(); // 刷新面板
    } else {
      showToast(res.error || '记录失败', 'error');
    }
  });
}

function submitCustomWater() {
  var ml = parseFloat(($('#water-custom-ml') || {}).value);
  if (!ml || ml <= 0) { showToast('请输入水量', 'error'); return; }
  submitWaterRecord(Math.round(ml), '水');
  var input = $('#water-custom-ml');
  if (input) input.value = '';
}

// ============ 运动图标 ============
function getExerciseIcon(name) {
  var map = {
    '快走': '<path d="M13 12h4l3 7M8 12h4M8 5l3 7-3 4"/><circle cx="12" cy="4" r="2"/>',
    '慢跑': '<circle cx="12" cy="4" r="2"/><path d="M8 20l3-8 3 2 2-4 2 4"/>',
    '跑步(8km/h)': '<circle cx="12" cy="4" r="2"/><path d="M8 20l3-8 3 2 2-4 2 4"/>',
    '跑步(10km/h)': '<circle cx="12" cy="4" r="2"/><path d="M8 20l3-8 3 2 2-4 2 4"/>',
    '跳绳': '<path d="M6 2l12 20M6 22L18 2"/><circle cx="12" cy="12" r="1"/>',
    '游泳(慢)': '<path d="M5 9c2 2 4 2 6 0s4-2 6 0M5 15c2 2 4 2 6 0s4-2 6 0"/>',
    '游泳(快)': '<path d="M5 9c2 2 4 2 6 0s4-2 6 0M5 15c2 2 4 2 6 0s4-2 6 0"/>',
    '骑行(12km/h)': '<circle cx="12" cy="14" r="7"/><circle cx="12" cy="14" r="2"/><path d="M5 6l4 8M19 6l-4 8"/>',
    '骑行(20km/h)': '<circle cx="12" cy="14" r="7"/><circle cx="12" cy="14" r="2"/><path d="M5 6l4 8M19 6l-4 8"/>',
    '瑜伽': '<path d="M12 2v4M10 8l2 4-2 6M14 8l-2 4 2 6"/><circle cx="12" cy="6" r="2"/>',
    'HIIT': '<polygon points="12 2 15 8 22 9 17 14 18 21 12 17 6 21 7 14 2 9 9 8"/>',
    '力量训练': '<path d="M8 2v20M16 2v20M6 6h12M6 18h12"/>',
    '爬楼梯': '<path d="M6 22V10l6-6 6 6v12M6 14h12"/>',
    '羽毛球': '<circle cx="12" cy="15" r="1"/><path d="M4 4c4 4 6 8 6 11"/><path d="M20 4c-4 4-6 8-6 11"/>',
    '篮球': '<circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2c3 3 3 17 0 20M12 2c-3 3-3 17 0 20"/>',
    '足球': '<circle cx="12" cy="12" r="10"/><polygon points="12 4 16 9 21 10 17 14 18 19 12 17 6 19 7 14 3 10 8 9"/>',
    '乒乓球': '<rect x="2" y="10" width="8" height="4" rx="1"/><circle cx="16" cy="12" r="5"/><circle cx="16" cy="12" r="1"/>',
    '舞蹈': '<path d="M12 2v6M10 10l4 2-2 6M14 10l-4 2 2 6"/><circle cx="12" cy="4" r="1"/>',
    '普拉提': '<path d="M6 20V4l6 4 6-4v16M12 8v12"/>',
    '拉伸': '<path d="M8 20V4M16 20V4M12 4v16"/>',
  };
  return map[name] || '<circle cx="12" cy="12" r="10"/>';
}

// ============ 趋势页 ============
var trendChart = null;
var trendMetric = 'weight';

function renderTrends() {
  selectTrendTab(trendMetric);
}

function selectTrendTab(metric) {
  trendMetric = metric;
  var tabs = $$('#trends-tabs .tab-item');
  for (var i = 0; i < tabs.length; i++) tabs[i].classList.remove('active');
  var btn = document.querySelector('#trends-tabs [data-metric="' + metric + '"]');
  if (btn) btn.classList.add('active');
  loadTrendChart(metric);
}

function loadTrendChart(metric) {
  var user = Store.get('user');
  API.getUserTrends(user.id, 30).then(function(res) {
    if (!res.success) return;
    var ctx = $('#trend-chart').getContext('2d');
    if (trendChart) trendChart.destroy();

    var colors = {
      weight: { bg: 'rgba(127,204,182,0.2)', line: '#7FCCB6', label: '体重 (kg)' },
      calories: { bg: 'rgba(252,129,129,0.2)', line: '#FC8181', label: '饮食摄入 (kcal)' },
      exercise: { bg: 'rgba(110,181,255,0.2)', line: '#6EB5FF', label: '运动消耗 (kcal)' },
      mood: { bg: 'rgba(246,173,85,0.2)', line: '#F6AD55', label: '心情指数' },
      water: { bg: 'rgba(79,209,197,0.2)', line: '#4FD1C5', label: '喝水 (ml)' },
      deficit: { bg: 'rgba(104,211,145,0.2)', line: '#68D391', label: '热量缺口 (kcal, 负=消耗>摄入)' },
    };
    var c = colors[metric];

    var chartData;
    switch (metric) {
      case 'weight': chartData = res.weights; break;
      case 'calories': chartData = res.foodCalories; break;
      case 'exercise': chartData = res.exerciseCalories; break;
      case 'mood': chartData = res.moods; break;
      case 'water': chartData = res.waterData; break;
      case 'deficit': chartData = res.deficits; break;
    }

    var labels = [];
    var values = [];
    var dateMap = {};
    for (var i = 29; i >= 0; i--) {
      var d = new Date(Date.now() - i * 86400000);
      var ds = d.toISOString().split('T')[0];
      labels.push((d.getMonth() + 1) + '/' + d.getDate());
      dateMap[ds] = null;
    }
    if (chartData) {
      chartData.forEach(function(item) {
        if (dateMap.hasOwnProperty(item.date)) dateMap[item.date] = item.value;
      });
    }
    var keys = Object.keys(dateMap);
    for (var j = 0; j < keys.length; j++) values.push(dateMap[keys[j]]);

    var yMin = (metric === 'mood') ? 0 : undefined;
    var yMax = (metric === 'mood') ? 5 : undefined;

    // 缺口曲线用柱状图区分正负
    var chartType = metric === 'deficit' ? 'bar' : 'line';
    var barColors = [];
    if (metric === 'deficit') {
      barColors = values.map(function(v) {
        return v === null ? 'transparent' : (v < 0 ? 'rgba(104,211,145,0.6)' : 'rgba(252,129,129,0.6)');
      });
    }

    var datasetConfig = {
      label: c.label, data: values, borderColor: c.line, backgroundColor: metric === 'deficit' ? barColors : c.bg,
      borderWidth: 2, fill: metric !== 'deficit', tension: 0.4, pointRadius: 3, pointBackgroundColor: c.line, spanGaps: false,
    };

    trendChart = new Chart(ctx, {
      type: chartType,
      data: { labels: labels, datasets: [datasetConfig] },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: true, labels: { font: { size: 12 }, usePointStyle: true } } },
        scales: {
          y: { min: yMin, max: yMax, ticks: { font: { size: 11 } }, grid: { color: 'rgba(0,0,0,0.05)' } },
          x: { ticks: { font: { size: 10 }, maxTicksLimit: 10 }, grid: { display: false } },
        },
      },
    });
    $('#trend-chart').parentElement.style.height = '280px';
  });
}

// ============ 圈子页 ============
var circleCompareChart = null;
var circleCompareMetric = 'weight';

function renderCircle() {
  var user = Store.get('user');
  if (!user) return;
  var circle = Store.get('circle');

  if (!circle) {
    $('#circle-content').innerHTML =
      '<div class="glass-card" style="text-align:center;"><div style="font-size:60px;margin-bottom:12px;">👥</div><h3 style="margin-bottom:8px;">还没有加入圈子</h3><p style="font-size:var(--font-sm);color:var(--text-secondary);margin-bottom:16px;">创建一个圈子，邀请好友一起减脂打卡！</p>' +
      '<div class="form-group"><input id="circle-name-input" class="glass-input" placeholder="圈子名称"></div>' +
      '<button class="glass-btn primary" style="width:100%;margin-bottom:8px;" id="btn-create-circle">✨ 创建圈子</button>' +
      '<div style="font-size:var(--font-xs);color:var(--text-muted);margin:8px 0;">— 或 —</div>' +
      '<div class="form-group"><input id="invite-code-input" class="glass-input" placeholder="输入6位邀请码" maxlength="6"></div>' +
      '<button class="glass-btn" style="width:100%;" id="btn-join-circle">🔗 加入圈子</button></div>';
    return;
  }

  // 有圈子，加载数据
  API.getCircleToday(circle.id).then(function(todayRes) {
    API.getCircleMembers(circle.id).then(function(membersRes) {
      var membersHtml = '';
      if (membersRes.success) {
        membersRes.members.forEach(function(m) {
          membersHtml += '<div class="member-item"><div class="member-avatar">' + m.nickname[0] + '</div><div class="member-info"><div class="member-name">' + m.nickname + (m.id === user.id ? ' (我)' : '') + '</div><div class="member-status">' + (m.weight ? m.weight + 'kg' : '未记录体重') + '</div></div></div>';
        });
      }

      var todayHtml = '';
      if (todayRes.success && todayRes.members) {
        todayRes.members.forEach(function(m) {
          var items = [];
          if (m.food && m.food.length > 0) items.push('🍽 摄入' + m.total_calories_intake + 'kcal');
          if (m.exercise && m.exercise.length > 0) items.push('🏃 消耗' + m.total_calories_burned + 'kcal');
          if (m.weight) items.push('⚖️ ' + m.weight + 'kg');
          if (m.mood) items.push(moodSVG(m.mood.mood_level, 18));
          if (items.length > 0) {
            todayHtml += '<div class="member-item"><div class="member-avatar">' + m.user.nickname[0] + '</div><div class="member-info"><div class="member-name">' + m.user.nickname + '</div><div class="member-status">' + items.join(' · ') + '</div></div></div>';
          }
        });
      }
      if (!todayHtml) todayHtml = '<div class="empty-state"><p>今天还没有人打卡</p></div>';

      $('#circle-content').innerHTML =
        '<div class="glass-card"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;"><div><div style="font-weight:700;font-size:var(--font-lg);">👥 ' + circle.name + '</div><div style="font-size:var(--font-xs);color:var(--text-muted);">邀请码：<strong style="letter-spacing:3px;">' + circle.invite_code + '</strong></div></div><button class="glass-btn" style="font-size:var(--font-xs);padding:6px 12px;" id="btn-copy-invite">📋 复制</button></div></div>' +
        '<div class="glass-card"><div style="font-weight:600;margin-bottom:12px;">👤 成员 (' + (membersRes.success ? membersRes.members.length : 0) + ')</div><div class="member-list">' + membersHtml + '</div></div>' +
        '<div class="glass-card"><div style="font-weight:600;margin-bottom:12px;">📋 今日打卡</div>' + todayHtml + '</div>' +
        '<div class="glass-card"><div style="font-weight:600;margin-bottom:12px;">📊 圈子趋势对比</div>' +
        '<div class="tab-bar" id="circle-compare-tabs">' +
        '<button class="tab-item active" data-metric="weight">体重</button>' +
        '<button class="tab-item" data-metric="calories">热量摄入</button>' +
        '<button class="tab-item" data-metric="exercise">运动消耗</button>' +
        '<button class="tab-item" data-metric="mood">心情</button></div>' +
        '<div class="chart-container"><canvas id="circle-compare-chart"></canvas></div></div>';

      loadCircleCompareChart('weight');
    });
  });
}

function doCreateCircle() {
  var name = $('#circle-name-input').value.trim();
  if (!name) { showToast('请输入圈子名称', 'error'); return; }
  API.createCircle(name).then(function(res) {
    if (res.success) {
      var user = Store.get('user');
      API.joinCircle(user.id, res.circle.invite_code).then(function(joinRes) {
        if (joinRes.success) {
          Store.set('circle', joinRes.circle);
          Store.set('user', joinRes.user);
          showToast('圈子「' + res.circle.name + '」已创建！', 'success');
          renderCircle();
        }
      });
    } else { showToast(res.error, 'error'); }
  });
}

function doJoinCircle() {
  var code = $('#invite-code-input').value.trim();
  if (!code) { showToast('请输入邀请码', 'error'); return; }
  var user = Store.get('user');
  API.joinCircle(user.id, code).then(function(res) {
    if (res.success) {
      Store.set('circle', res.circle);
      Store.set('user', res.user);
      showToast('已加入圈子「' + res.circle.name + '」', 'success');
      renderCircle();
    } else { showToast(res.error || '加入失败', 'error'); }
  });
}

function copyInviteCode(code) {
  try {
    navigator.clipboard.writeText(code).then(function() {
      showToast('邀请码已复制', 'success');
    }).catch(function() {
      prompt('复制邀请码：', code);
    });
  } catch(e) {
    prompt('复制邀请码：', code);
  }
}

function selectCircleCompareMetric(metric, btn) {
  circleCompareMetric = metric;
  var tabs = $$('#circle-compare-tabs .tab-item');
  for (var i = 0; i < tabs.length; i++) tabs[i].classList.remove('active');
  btn.classList.add('active');
  loadCircleCompareChart(metric);
}

function loadCircleCompareChart(metric) {
  var circle = Store.get('circle');
  if (!circle) return;
  API.getCircleTrends(circle.id, metric, 30).then(function(res) {
    if (!res.success) return;
    var ctx = $('#circle-compare-chart').getContext('2d');
    if (circleCompareChart) circleCompareChart.destroy();

    var colorPalette = ['#7FCCB6', '#6EB5FF', '#FC8181', '#F6AD55', '#B794F4', '#68D391', '#4FD1C5', '#F687B3', '#90CDF4', '#FBD38D'];

    var labels = [];
    var dateMap = {};
    for (var i = 29; i >= 0; i--) {
      var d = new Date(Date.now() - i * 86400000);
      var ds = d.toISOString().split('T')[0];
      labels.push((d.getMonth() + 1) + '/' + d.getDate());
      dateMap[ds] = null;
    }
    var dateKeys = Object.keys(dateMap);

    var datasets = res.datasets.map(function(ds, idx) {
      var values = dateKeys.map(function() { return null; });
      ds.data.forEach(function(item) {
        var di = dateKeys.indexOf(item.date);
        if (di >= 0) values[di] = item.value;
      });
      return {
        label: ds.nickname, data: values, borderColor: colorPalette[idx % colorPalette.length],
        backgroundColor: colorPalette[idx % colorPalette.length] + '20',
        borderWidth: 2, tension: 0.4, pointRadius: 2, spanGaps: false,
      };
    });

    var metricNames = { weight: '体重 (kg)', calories: '摄入热量 (kcal)', exercise: '运动消耗 (kcal)', mood: '心情指数' };
    var yMin = metric === 'mood' ? 0 : undefined;
    var yMax = metric === 'mood' ? 5 : undefined;

    circleCompareChart = new Chart(ctx, {
      type: 'line', data: { labels: labels, datasets: datasets },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { labels: { font: { size: 10 }, usePointStyle: true, boxWidth: 8 } } },
        scales: {
          y: { min: yMin, max: yMax, title: { display: true, text: metricNames[metric], font: { size: 11 } }, ticks: { font: { size: 10 } }, grid: { color: 'rgba(0,0,0,0.05)' } },
          x: { ticks: { font: { size: 9 }, maxTicksLimit: 8 }, grid: { display: false } },
        },
      },
    });
    $('#circle-compare-chart').parentElement.style.height = '260px';
  });
}

// ============ 历史页 ============
var historyDate = new Date();
var historyRecords = [];

function renderHistory() {
  var user = Store.get('user');
  if (!user) return;
  loadHistoryData();
}

function loadHistoryData() {
  var user = Store.get('user');
  API.getUserHistory(user.id, { page: 1, pageSize: 50 }).then(function(res) {
    if (!res.success) return;
    historyRecords = res.records;
    renderCalendar();
    renderHistoryList();
  });
}

function renderCalendar() {
  var y = historyDate.getFullYear();
  var m = historyDate.getMonth();
  var firstDay = new Date(y, m, 1).getDay();
  var daysInMonth = new Date(y, m + 1, 0).getDate();
  var prevDays = new Date(y, m, 0).getDate();

  var recordDates = {};
  historyRecords.forEach(function(r) {
    var d = r.checkin_date || r.recorded_date;
    if (d) recordDates[d] = true;
  });

  var todayStr = today();
  var dayHeaders = ['日', '一', '二', '三', '四', '五', '六'];

  var html = '<div class="glass-card"><div class="calendar-header"><button id="btn-cal-prev">◀</button><span style="font-weight:600;">' + y + '年' + (m + 1) + '月</span><button id="btn-cal-next">▶</button></div><div class="calendar-grid">';

  for (var di = 0; di < dayHeaders.length; di++) html += '<div class="day-header">' + dayHeaders[di] + '</div>';

  for (var i = firstDay - 1; i >= 0; i--) html += '<div class="day-cell other-month">' + (prevDays - i) + '</div>';

  for (var d = 1; d <= daysInMonth; d++) {
    var ds = y + '-' + String(m + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0');
    var isToday = ds === todayStr;
    var hasRecord = recordDates[ds];
    var cls = 'day-cell';
    if (isToday) cls += ' today';
    if (hasRecord) cls += ' has-record';
    html += '<div class="' + cls + '" data-date="' + ds + '">' + d + '</div>';
  }

  var totalCells = firstDay + daysInMonth;
  var remaining = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);
  for (var j = 1; j <= remaining; j++) html += '<div class="day-cell other-month">' + j + '</div>';

  html += '</div></div>';
  $('#history-content').innerHTML = html + '<div id="history-list"></div>';
}

function changeMonth(delta) {
  historyDate.setMonth(historyDate.getMonth() + delta);
  renderCalendar();
  renderHistoryList();
}

function selectHistoryDate(ds, el) {
  var cells = $$('.day-cell');
  for (var i = 0; i < cells.length; i++) cells[i].classList.remove('selected');
  el.classList.add('selected');
  renderHistoryList(ds);
}

function renderHistoryList(filterDate) {
  var records = historyRecords;
  if (filterDate) {
    records = records.filter(function(r) { return (r.checkin_date || r.recorded_date) === filterDate; });
  }
  if (records.length === 0) {
    $('#history-list').innerHTML = '<div class="empty-state"><p>暂无记录</p></div>';
    return;
  }
  var html = '';
  records.forEach(function(r) {
    var type = r.record_type;
    var icon, title, subtitle;
    var mealMap = { breakfast: '早餐', lunch: '午餐', dinner: '晚餐', snack: '加餐' };
    switch (type) {
      case 'food':
        icon = '🍽'; title = r.food_name + ' ' + r.amount_g + 'g';
        subtitle = r.calories + 'kcal · ' + (mealMap[r.meal_type] || r.meal_type);
        break;
      case 'exercise':
        icon = '🏃'; title = r.exercise_type + ' ' + r.duration_min + '分钟';
        subtitle = '消耗 ' + r.calories_burned + ' kcal';
        break;
      case 'weight':
        icon = '⚖️'; title = '体重记录：' + r.weight + ' kg';
        subtitle = r.recorded_date;
        break;
      case 'mood':
        icon = '💭'; title = moodSVG(r.mood_level, 18) + ' ' + moodLabel(r.mood_level);
        subtitle = r.note || r.recorded_date;
        break;
      case 'water':
        icon = '💧'; title = '喝水 ' + r.amount_ml + 'ml';
        subtitle = r.drink_type || '水';
        break;
    }
    html += '<div class="timeline-item"><div class="timeline-icon">' + icon + '</div><div class="timeline-content"><div class="title">' + title + '</div><div class="subtitle">' + subtitle + ' · ' + (r.checkin_date || r.recorded_date) + '</div></div></div>';
  });
  $('#history-list').innerHTML = '<div class="glass-card" style="margin-top:14px;">' + html + '</div>';
}

// ============ 设置页 ============
var settingsGender = 'female';

function renderSettings() {
  var user = Store.get('user');
  if (!user) return;
  settingsGender = user.gender || 'female';
  var circle = Store.get('circle');

  $('#settings-content').innerHTML =
    '<div class="glass-card"><div style="text-align:center;margin-bottom:16px;"><div class="member-avatar" style="width:60px;height:60px;font-size:24px;margin:0 auto;">' + user.nickname[0] + '</div><div style="font-weight:700;font-size:var(--font-lg);margin-top:8px;">' + user.nickname + '</div>' + (circle ? '<div style="font-size:var(--font-xs);color:var(--text-secondary);">👥 ' + circle.name + '</div>' : '') + '</div>' +
    '<div class="form-group"><label>昵称</label><input id="set-nickname" class="glass-input" value="' + user.nickname + '"></div>' +
    '<div class="form-group"><label>性别</label><div class="chip-group"><button class="chip' + (user.gender === 'male' ? ' active' : '') + '" data-gender="male">♂ 男</button><button class="chip' + (user.gender === 'female' ? ' active' : '') + '" data-gender="female">♀ 女</button></div></div>' +
    '<div class="form-group"><label>身高（cm）</label><input id="set-height" class="glass-input" type="number" value="' + (user.height || '') + '" placeholder="例如：165"></div>' +
    '<div class="form-group"><label>体重（kg）</label><input id="set-weight" class="glass-input" type="number" step="0.1" value="' + (user.weight || '') + '" placeholder="例如：65.0"></div>' +
    '<div class="form-group"><label>年龄</label><input id="set-age" class="glass-input" type="number" value="' + (user.age || '') + '" placeholder="例如：25"></div>' +
    '<button class="glass-btn primary" style="width:100%;" id="btn-save-settings">💾 保存设置</button></div>' +
    '<div class="glass-card"><div style="font-weight:600;margin-bottom:12px;">📊 BMR 计算预览</div><div id="bmr-preview" style="text-align:center;font-size:var(--font-sm);color:var(--text-secondary);"></div></div>' +
    '<div class="glass-card"><div style="font-weight:600;margin-bottom:12px;">👥 圈子</div>' + (circle ?
      '<p style="font-size:var(--font-sm);margin-bottom:8px;">当前圈子：<strong>' + circle.name + '</strong></p><p style="font-size:var(--font-xs);color:var(--text-muted);margin-bottom:12px;">邀请码：' + circle.invite_code + '</p><button class="glass-btn danger" style="width:100%;font-size:var(--font-sm);" id="btn-leave-circle">退出圈子</button>' :
      '<p style="font-size:var(--font-sm);color:var(--text-muted);">尚未加入圈子</p>') + '</div>';

  updateBMRPreview();
  ['set-height', 'set-weight', 'set-age'].forEach(function(id) {
    var el = $('#' + id);
    if (el) el.addEventListener('input', updateBMRPreview);
  });
}

function selectGender(gender, btn) {
  settingsGender = gender;
  var chips = $$('#settings-content .chip');
  for (var i = 0; i < chips.length; i++) chips[i].classList.remove('active');
  btn.classList.add('active');
  updateBMRPreview();
}

function updateBMRPreview() {
  var height = parseFloat(($('#set-height') || {}).value) || 0;
  var weight = parseFloat(($('#set-weight') || {}).value) || 0;
  var age = parseInt(($('#set-age') || {}).value) || 0;

  if (height && weight && age) {
    var bmr;
    if (settingsGender === 'male') {
      bmr = Math.round(10 * weight + 6.25 * height - 5 * age + 5);
    } else {
      bmr = Math.round(10 * weight + 6.25 * height - 5 * age - 161);
    }
    var formula = settingsGender === 'male' ? '10×体重 + 6.25×身高 - 5×年龄 + 5' : '10×体重 + 6.25×身高 - 5×年龄 - 161';
    $('#bmr-preview').innerHTML = '<div style="font-size:var(--font-2xl);font-weight:800;color:var(--primary-dark);">' + bmr + ' <span style="font-size:var(--font-md);">kcal/天</span></div><div style="margin-top:4px;">Mifflin-St Jeor 公式</div><div style="font-size:var(--font-xs);color:var(--text-muted);margin-top:2px;">' + formula + '</div>';
  } else {
    $('#bmr-preview').innerHTML = '<p>请填写完整的身高、体重和年龄以计算 BMR</p>';
  }
}

function saveSettings() {
  var nickname = $('#set-nickname').value.trim();
  var height = parseFloat($('#set-height').value) || null;
  var weight = parseFloat($('#set-weight').value) || null;
  var age = parseInt($('#set-age').value) || null;

  if (!nickname) { showToast('昵称不能为空', 'error'); return; }

  var user = Store.get('user');
  API.updateUser(user.id, {
    nickname: nickname, height: height, weight: weight, age: age, gender: settingsGender,
  }).then(function(res) {
    if (res.success) {
      Store.set('user', res.user);
      showToast('设置已保存', 'success');
    } else {
      showToast(res.error || '保存失败', 'error');
    }
  });
}

function leaveCircle() {
  if (!confirm('确定要退出当前圈子吗？')) return;
  var user = Store.get('user');
  API.updateUser(user.id, { circle_id: null }).then(function() {
    Store.set('circle', null);
    user.circle_id = null;
    Store.set('user', user);
    showToast('已退出圈子', 'info');
    renderSettings();
  });
}

// ============ 全局事件委托 ============
function setupGlobalEvents() {
  // 开始按钮
  var btnStart = $('#btn-start');
  if (btnStart) btnStart.addEventListener('click', doLogin);

  // 加入圈子链接
  var linkJoin = $('#link-join-circle');
  if (linkJoin) linkJoin.addEventListener('click', showJoinCircle);

  // 设置按钮
  var btnSettings = $('#btn-settings');
  if (btnSettings) btnSettings.addEventListener('click', function() { navigate('settings'); });

  // 快速操作按钮
  var qaFood = $('#qa-food');
  if (qaFood) qaFood.addEventListener('click', function() { navigate('checkin'); selectCheckinTab('food'); });
  var qaWater = $('#qa-water');
  if (qaWater) qaWater.addEventListener('click', function() { navigate('checkin'); selectCheckinTab('water'); });
  var qaExercise = $('#qa-exercise');
  if (qaExercise) qaExercise.addEventListener('click', function() { navigate('checkin'); selectCheckinTab('exercise'); });
  var qaWeight = $('#qa-weight');
  if (qaWeight) qaWeight.addEventListener('click', function() { navigate('checkin'); selectCheckinTab('weight'); });

  // 食物模态框
  var bfs = $('#food-search');
  if (bfs) bfs.addEventListener('input', function() { filterFoods(); });
  var bfc = $('#btn-food-cancel');
  if (bfc) bfc.addEventListener('click', closeFoodModal);
  var bfsub = $('#btn-food-submit');
  if (bfsub) bfsub.addEventListener('click', submitFoodCheckin);

  // 底部导航
  var navItems = $$('.nav-item');
  for (var i = 0; i < navItems.length; i++) {
    navItems[i].addEventListener('click', function() {
      navigate(this.dataset.page);
    });
  }
}

// ============ 事件委托（处理动态创建的元素）============
document.addEventListener('click', function(e) {
  var target = e.target;

  // 搜索食物按钮
  if (target.closest('#btn-open-food-selector')) {
    openFoodSelector();
  }

  // 快速录入热量 - 展开面板
  if (target.closest('#btn-quick-calorie')) {
    var panel = $('#quick-calorie-panel');
    if (panel) panel.style.display = 'block';
  }

  // 快速录入 - 餐别选择
  if (target.closest('#quick-meal-group .chip')) {
    var btn = target.closest('#quick-meal-group .chip');
    var chips = $$('#quick-meal-group .chip');
    for (var i = 0; i < chips.length; i++) chips[i].classList.remove('active');
    btn.classList.add('active');
  }

  // 快速录入提交
  if (target.closest('#btn-quick-submit')) {
    submitQuickCalorie();
  }

  // 打卡 Tab
  if (target.closest('#checkin-tabs .tab-item')) {
    selectCheckinTab(target.closest('#checkin-tabs .tab-item').dataset.tab);
  }

  // 趋势 Tab
  if (target.closest('#trends-tabs .tab-item')) {
    selectTrendTab(target.closest('#trends-tabs .tab-item').dataset.metric);
  }

  // 食物分类筛选
  if (target.closest('#food-categories .chip')) {
    var btn = target.closest('#food-categories .chip');
    filterFoods(btn.dataset.cat || null, btn);
  }

  // 食物选择
  if (target.closest('#food-list .food-item')) {
    var item = target.closest('#food-list .food-item');
    selectFood(item.dataset.name, parseFloat(item.dataset.cal), parseFloat(item.dataset.protein), parseFloat(item.dataset.fat), parseFloat(item.dataset.carbs), item.dataset.cat);
  }

  // 餐别选择
  if (target.closest('#meal-type-group .chip')) {
    selectMealType(target.closest('#meal-type-group .chip').dataset.meal, target.closest('#meal-type-group .chip'));
  }

  // 运动选择
  if (target.closest('.exercise-item')) {
    var ei = target.closest('.exercise-item');
    selectExercise(ei.dataset.name, parseFloat(ei.dataset.met), ei);
  }

  // 心情选择
  if (target.closest('.mood-icon')) {
    var mi = target.closest('.mood-icon');
    selectMood(parseInt(mi.dataset.level), mi);
  }

  // 运动打卡提交
  if (target.closest('#btn-exercise-submit')) {
    submitExerciseCheckin();
  }

  // 自定义运动提交
  if (target.closest('#btn-custom-exercise-submit')) {
    submitCustomExercise();
  }

  // 体重提交
  if (target.closest('#btn-weight-submit')) {
    submitWeightRecord();
  }

  // 心情提交
  if (target.closest('#btn-mood-submit')) {
    submitMoodRecord();
  }

  // 喝水快捷按钮
  if (target.closest('#checkin-water-panel .chip') && target.closest('#checkin-water-panel .chip').dataset.ml) {
    var chip = target.closest('#checkin-water-panel .chip');
    submitWaterRecord(parseInt(chip.dataset.ml), chip.dataset.type || '水');
  }

  // 自定义喝水
  if (target.closest('#btn-water-custom')) {
    submitCustomWater();
  }

  // 创建圈子
  if (target.closest('#btn-create-circle')) {
    doCreateCircle();
  }

  // 加入圈子
  if (target.closest('#btn-join-circle')) {
    doJoinCircle();
  }

  // 复制邀请码
  if (target.closest('#btn-copy-invite')) {
    var circle = Store.get('circle');
    if (circle) copyInviteCode(circle.invite_code);
  }

  // 圈子对比 Tab
  if (target.closest('#circle-compare-tabs .tab-item')) {
    selectCircleCompareMetric(target.closest('#circle-compare-tabs .tab-item').dataset.metric, target.closest('#circle-compare-tabs .tab-item'));
  }

  // 日历翻页
  if (target.closest('#btn-cal-prev')) changeMonth(-1);
  if (target.closest('#btn-cal-next')) changeMonth(1);

  // 日历选日期
  if (target.closest('.day-cell') && !target.closest('.other-month')) {
    var dc = target.closest('.day-cell');
    if (dc.dataset.date) selectHistoryDate(dc.dataset.date, dc);
  }

  // 性别选择
  if (target.closest('#settings-content .chip') && target.closest('#settings-content .chip').dataset.gender) {
    selectGender(target.closest('#settings-content .chip').dataset.gender, target.closest('#settings-content .chip'));
  }

  // 保存设置
  if (target.closest('#btn-save-settings')) {
    saveSettings();
  }

  // 退出圈子
  if (target.closest('#btn-leave-circle')) {
    leaveCircle();
  }
});

// ============ 键盘事件（回车提交）============
document.addEventListener('keydown', function(e) {
  if (e.key === 'Enter') {
    if (document.activeElement === $('#auth-nickname')) {
      doLogin();
    }
  }
});

// ============ 初始化 ============
function init() {
  // 确保关键元素存在
  var authPage = $('#page-auth');
  var homePage = $('#page-home');
  if (!authPage || !homePage) {
    // DOM 还没就绪，延迟重试
    setTimeout(init, 50);
    return;
  }

  setupGlobalEvents();

  // 默认先确保 auth 页显示（防止全部隐藏）
  var allPages = $$('.page');
  for (var i = 0; i < allPages.length; i++) allPages[i].classList.remove('active');
  authPage.classList.add('active');

  Store.restore().then(function(restored) {
    if (restored) {
      navigate('home');
    }
    // auth 页已经显示了，不需要再 navigate('auth')
  }).catch(function(err) {
    // restore 失败，保持在 auth 页
    console.log('restore error:', err);
  });
}

// 多种方式确保初始化
function tryInit() {
  if (document.body && $('#page-auth')) {
    init();
  } else {
    setTimeout(tryInit, 50);
  }
}

if (document.readyState === 'complete' || document.readyState === 'interactive') {
  tryInit();
} else {
  document.addEventListener('DOMContentLoaded', tryInit);
  // 兜底：1 秒后强制初始化
  setTimeout(function() {
    if (!$('#page-auth') || !$('#page-auth').classList.contains('active')) {
      tryInit();
    }
  }, 1000);
}

})(); // END IIFE
