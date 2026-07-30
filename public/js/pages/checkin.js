// ============ 打卡页 ============
let checkinTab = 'food';
let selectedFood = null;
let selectedMealType = 'lunch';
let selectedExercise = null;
let selectedMood = null;
let uploadedPhotoPath = '';
let allFoods = [];
let allCategories = [];
let allExercises = [];

async function renderCheckin() {
  await Promise.all([loadFoodCategories(), loadExercises()]);
  selectCheckinTab(checkinTab);
}

function selectCheckinTab(tab) {
  checkinTab = tab;
  $$('#checkin-tabs .tab-item').forEach(t => t.classList.remove('active'));
  const btn = $(`#checkin-tabs [data-tab="${tab}"]`);
  if (btn) btn.classList.add('active');

  ['food', 'exercise', 'weight', 'mood'].forEach(t => {
    const panel = $(`#checkin-${t}-panel`);
    if (panel) panel.style.display = t === tab ? 'block' : 'none';
  });

  switch (tab) {
    case 'food': renderFoodCheckin(); break;
    case 'exercise': renderExerciseCheckin(); break;
    case 'weight': renderWeightCheckin(); break;
    case 'mood': renderMoodCheckin(); break;
  }
}

// ============ 饮食打卡 ============
function renderFoodCheckin() {
  $('#checkin-food-panel').innerHTML = `
    <div class="glass-card">
      <div style="text-align:center;padding:20px;">
        <div class="photo-preview" onclick="openPhotoModal()" id="food-photo-preview">
          <div class="placeholder">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>
            <span>拍照记录（可选）</span>
          </div>
        </div>
        <div style="margin-top:12px;font-size:var(--font-xs);color:var(--text-muted);">或直接搜索选择食物</div>
        <button class="glass-btn primary" style="width:100%;margin-top:12px;" onclick="openFoodSelector()">🔍 搜索食物</button>
      </div>
    </div>
  `;
}

// 照片相关
function openPhotoModal() { $('#photo-modal').classList.add('active'); }
function closePhotoModal() {
  $('#photo-modal').classList.remove('active');
  uploadedPhotoPath = '';
  $('#photo-preview').innerHTML = '<div class="placeholder"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg><span>点击拍照或选择图片</span></div>';
  $('#food-photo-preview').innerHTML = '<div class="placeholder"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg><span>拍照记录（可选）</span></div>';
}

async function handlePhotoSelect(e) {
  const file = e.target.files[0];
  if (!file) return;
  // 预览
  const reader = new FileReader();
  reader.onload = (ev) => {
    $('#photo-preview').innerHTML = `<img src="${ev.target.result}" alt="preview">`;
  };
  reader.readAsDataURL(file);
  // 上传
  const res = await API.uploadPhoto(file);
  if (res.success) {
    uploadedPhotoPath = res.path;
    // 同时更新食物打卡页的预览
    $('#food-photo-preview').innerHTML = `<img src="${ev.target.result}" alt="preview" style="width:100%;height:100%;object-fit:cover;">`;
  }
}

function confirmPhoto() {
  closePhotoModal();
  openFoodSelector();
}

// 食物选择器
async function loadFoodCategories() {
  const res = await API.getCategories();
  if (res.success) allCategories = res.categories;
}

async function openFoodSelector() {
  $('#food-modal').classList.add('active');
  selectedFood = null;
  $('#food-amount').style.display = 'none';
  $('#food-amount-input').value = '100';
  // 渲染分类
  let catHtml = '<button class="chip active" onclick="filterFoods(null, this)">全部</button>';
  allCategories.forEach(c => {
    catHtml += `<button class="chip" onclick="filterFoods('${c}', this)">${c}</button>`;
  });
  $('#food-categories').innerHTML = catHtml;
  await filterFoods();
}

function closeFoodModal() {
  $('#food-modal').classList.remove('active');
  selectedFood = null;
}

async function filterFoods(category, btn) {
  if (btn) {
    $$('#food-categories .chip').forEach(c => c.classList.remove('active'));
    btn.classList.add('active');
  }
  const search = $('#food-search').value.trim();
  const res = await API.searchFoods(search, category);
  if (!res.success) return;
  allFoods = res.foods;

  let html = '';
  allFoods.forEach(f => {
    html += `
      <div class="food-item" onclick="selectFood('${f.name}', ${f.calories}, ${f.protein}, ${f.fat}, ${f.carbs}, '${f.category}')">
        <div class="food-info">
          <div class="food-name">${f.name}</div>
          <div class="food-meta">${f.category} · 蛋白质${f.protein}g 脂肪${f.fat}g 碳水${f.carbs}g</div>
        </div>
        <div class="food-cal">${f.calories} kcal/100g</div>
      </div>`;
  });
  if (!html) html = '<div class="empty-state"><p>没有找到匹配的食物</p></div>';
  $('#food-list').innerHTML = html;
}

function selectFood(name, cal, protein, fat, carbs, category) {
  selectedFood = { name, cal, protein, fat, carbs, category };
  $('#food-amount').style.display = 'block';
  // 滚动到分量输入区
  $('#food-amount').scrollIntoView({ behavior: 'smooth' });
}

function selectMealType(type, btn) {
  selectedMealType = type;
  $$('#food-amount .chip').forEach(c => c.classList.remove('active'));
  btn.classList.add('active');
}

async function submitFoodCheckin() {
  if (!selectedFood) { showToast('请先选择食物', 'error'); return; }
  const amount = parseFloat($('#food-amount-input').value);
  if (!amount || amount <= 0) { showToast('请输入有效分量', 'error'); return; }

  const user = Store.get('user');
  const res = await API.checkinFood({
    user_id: user.id,
    food_name: selectedFood.name,
    category: selectedFood.category,
    amount_g: amount,
    meal_type: selectedMealType,
    photo_path: uploadedPhotoPath,
  });
  if (res.success) {
    showToast(`已记录：${selectedFood.name} ${res.nutrition.calories}kcal`, 'success');
    closeFoodModal();
    uploadedPhotoPath = '';
    navigate('home');
  } else {
    showToast(res.error || '打卡失败', 'error');
  }
}

// ============ 运动打卡 ============
async function loadExercises() {
  const res = await API.getExercises();
  if (res.success) allExercises = res.exercises;
}

function renderExerciseCheckin() {
  let gridHtml = '';
  allExercises.forEach(e => {
    gridHtml += `
      <div class="exercise-item" data-name="${e.name}" data-met="${e.met}" onclick="selectExercise('${e.name}', ${e.met}, this)">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="28" height="28">
          ${getExerciseIcon(e.name)}
        </svg>
        <span>${e.name}</span>
        <span style="font-size:10px;color:var(--text-muted);">MET ${e.met}</span>
      </div>`;
  });

  $('#checkin-exercise-panel').innerHTML = `
    <div class="glass-card">
      <div style="font-weight:600;margin-bottom:12px;">选择运动类型</div>
      <div class="exercise-grid">${gridHtml}</div>
      <div id="exercise-detail" style="display:none;">
        <div class="form-group">
          <label>运动时长（分钟）</label>
          <input id="exercise-duration" class="glass-input" type="number" placeholder="例如：30" min="1" value="30">
        </div>
        <div id="exercise-preview" style="text-align:center;padding:8px;font-size:var(--font-sm);color:var(--text-secondary);margin-bottom:12px;"></div>
        <button class="glass-btn primary" style="width:100%;" onclick="submitExerciseCheckin()">✅ 确认打卡</button>
      </div>
    </div>
  `;

  // 监听时长变化实时计算
  const durInput = $('#exercise-duration');
  if (durInput) durInput.addEventListener('input', updateExercisePreview);
}

function selectExercise(name, met, el) {
  selectedExercise = { name, met };
  $$('.exercise-item').forEach(i => i.classList.remove('selected'));
  el.classList.add('selected');
  $('#exercise-detail').style.display = 'block';
  updateExercisePreview();
}

function updateExercisePreview() {
  const duration = parseFloat($('#exercise-duration').value) || 0;
  const user = Store.get('user');
  if (selectedExercise && user.weight && duration > 0) {
    const calories = Math.round(selectedExercise.met * user.weight * (duration / 60));
    $('#exercise-preview').innerHTML = `预计消耗 <strong style="color:var(--accent);font-size:var(--font-lg);">${calories}</strong> kcal`;
  } else if (!user.weight) {
    $('#exercise-preview').innerHTML = '<span style="color:var(--danger);">请先在设置中填写体重</span>';
  }
}

async function submitExerciseCheckin() {
  if (!selectedExercise) { showToast('请选择运动类型', 'error'); return; }
  const duration = parseFloat($('#exercise-duration').value);
  if (!duration || duration <= 0) { showToast('请输入有效时长', 'error'); return; }

  const user = Store.get('user');
  if (!user.weight) { showToast('请先在设置中填写体重', 'error'); return; }

  const res = await API.checkinExercise({
    user_id: user.id,
    exercise_type: selectedExercise.name,
    duration_min: duration,
    met_value: selectedExercise.met,
  });
  if (res.success) {
    showToast(`已记录：${selectedExercise.name} 消耗${res.calories_burned}kcal`, 'success');
    selectedExercise = null;
    navigate('home');
  } else {
    showToast(res.error || '打卡失败', 'error');
  }
}

// ============ 体重记录 ============
function renderWeightCheckin() {
  const user = Store.get('user');
  $('#checkin-weight-panel').innerHTML = `
    <div class="glass-card">
      <div style="text-align:center;padding:10px;">
        <div style="font-size:var(--font-2xl);font-weight:800;color:var(--primary-dark);">⚖️</div>
        <div style="font-size:var(--font-sm);color:var(--text-secondary);margin:8px 0;">当前体重：<strong>${user.weight || '未设置'}</strong> kg</div>
      </div>
      <div class="form-group">
        <label>今日体重（kg）</label>
        <input id="weight-input" class="glass-input" type="number" step="0.1" placeholder="例如：65.0" value="${user.weight || ''}">
      </div>
      <button class="glass-btn primary" style="width:100%;" onclick="submitWeightRecord()">💾 记录体重</button>
    </div>
  `;
}

async function submitWeightRecord() {
  const weight = parseFloat($('#weight-input').value);
  if (!weight || weight <= 0) { showToast('请输入有效体重', 'error'); return; }
  const user = Store.get('user');
  const res = await API.recordWeight({ user_id: user.id, weight });
  if (res.success) {
    user.weight = weight;
    Store.set('user', user);
    showToast(`体重已记录：${weight} kg`, 'success');
    navigate('home');
  } else {
    showToast(res.error || '记录失败', 'error');
  }
}

// ============ 心情记录 ============
function renderMoodCheckin() {
  let moodHtml = '';
  for (let i = 1; i <= 5; i++) {
    moodHtml += `
      <button class="mood-icon" data-level="${i}" onclick="selectMood(${i}, this)">
        ${moodSVG(i, 40)}
        <span>${['很难过','有点低落','一般般','挺开心','超棒'][i-1]}</span>
      </button>`;
  }

  $('#checkin-mood-panel').innerHTML = `
    <div class="glass-card">
      <div style="text-align:center;font-weight:600;margin-bottom:12px;">今天心情如何？</div>
      <div class="mood-icons">${moodHtml}</div>
      <div class="form-group">
        <label>心情笔记（可选）</label>
        <input id="mood-note" class="glass-input" placeholder="记录一下今天的心情…">
      </div>
      <button class="glass-btn primary" style="width:100%;" onclick="submitMoodRecord()">💾 记录心情</button>
    </div>
  `;
}

function selectMood(level, btn) {
  selectedMood = level;
  $$('.mood-icon').forEach(m => m.classList.remove('selected'));
  btn.classList.add('selected');
}

async function submitMoodRecord() {
  if (!selectedMood) { showToast('请选择心情', 'error'); return; }
  const note = $('#mood-note').value.trim();
  const user = Store.get('user');
  const res = await API.recordMood({ user_id: user.id, mood_level: selectedMood, note });
  if (res.success) {
    showToast('心情已记录 ✨', 'success');
    selectedMood = null;
    navigate('home');
  } else {
    showToast(res.error || '记录失败', 'error');
  }
}

// ============ 运动图标 ============
function getExerciseIcon(name) {
  const map = {
    '快走': '<path d="M13 12h4l3 7M8 12h4M8 5l3 7-3 4"/><circle cx="12" cy="4" r="2"/>',
    '慢跑': '<circle cx="12" cy="4" r="2"/><path d="M8 20l3-8 3 2 2-4 2 4"/>',
    '跑步': '<circle cx="12" cy="4" r="2"/><path d="M8 20l3-8 3 2 2-4 2 4"/>',
    '跳绳': '<path d="M6 2l12 20M6 22L18 2"/><circle cx="12" cy="12" r="1"/>',
    '游泳': '<path d="M5 9c2 2 4 2 6 0s4-2 6 0M5 15c2 2 4 2 6 0s4-2 6 0"/>',
    '骑行': '<circle cx="12" cy="14" r="7"/><circle cx="12" cy="14" r="2"/><path d="M5 6l4 8M19 6l-4 8"/>',
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
