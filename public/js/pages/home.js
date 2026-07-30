// ============ 主页 - 仪表盘 ============
let homeData = null;

async function renderHome() {
  const user = Store.get('user');
  if (!user) { navigate('auth'); return; }

  // 圈子名称
  const circle = Store.get('circle');
  $('#home-circle-name').textContent = circle ? `👥 ${circle.name}` : '';

  await loadHomeSummary();
}

async function loadHomeSummary() {
  const user = Store.get('user');
  const res = await API.getDailySummary(user.id);
  if (!res.success) return;
  homeData = res.summary;

  const s = res.summary;
  const bmr = s.bmr || 0;
  const intake = s.total_calories_intake || 0;
  const burned = s.total_calories_burned || 0;
  const tdee = s.tdee || bmr;
  const deficit = s.deficit || 0;
  const deficitAbs = Math.abs(deficit);
  const isDeficit = deficit < 0;

  const intakePercent = bmr > 0 ? Math.min(100, Math.round((intake / tdee) * 100)) : 0;

  let html = `
    <div class="glass-card" style="text-align:center;">
      <div style="font-size:var(--font-xs);color:var(--text-secondary);margin-bottom:4px;">今日热量缺口</div>
      <div style="font-size:42px;font-weight:800;color:${isDeficit ? 'var(--success)' : 'var(--danger)'};">
        ${isDeficit ? '-' : '+'}${deficitAbs} <span style="font-size:var(--font-md);">kcal</span>
      </div>
      <div style="font-size:var(--font-xs);color:var(--text-muted);">${isDeficit ? '继续保持！消耗大于摄入 🔥' : '摄入大于消耗，注意控制饮食哦'}</div>
      <div class="progress-bar" style="margin-top:12px;">
        <div class="progress-fill ${intakePercent > 100 ? 'orange' : 'green'}" style="width:${intakePercent}%;"></div>
      </div>
      <div style="display:flex;justify-content:space-between;font-size:var(--font-xs);color:var(--text-muted);margin-top:4px;">
        <span>摄入 ${intake} kcal</span><span>消耗 ${tdee} kcal</span>
      </div>
    </div>

    <div class="stat-row col3">
      <div class="stat-card primary">
        <div class="stat-value">${bmr}</div>
        <div class="stat-label">基础代谢 kcal</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${intake}</div>
        <div class="stat-label">摄入 kcal</div>
      </div>
      <div class="stat-card accent">
        <div class="stat-value">${burned}</div>
        <div class="stat-label">运动消耗 kcal</div>
      </div>
    </div>

    ${s.weight ? `<div class="stat-row col3">
      <div class="stat-card">
        <div class="stat-value">${s.weight}</div>
        <div class="stat-label">体重 kg</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${s.total_exercise_min || 0}</div>
        <div class="stat-label">运动 min</div>
      </div>
      <div class="stat-card warning">
        <div class="stat-value">${s.mood ? moodSVG(s.mood.mood_level, 24) + '<span style="font-size:var(--font-xs);display:block;">' + moodLabel(s.mood.mood_level) + '</span>' : '--'}</div>
        <div class="stat-label">今日心情</div>
      </div>
    </div>` : ''}
  `;

  $('#home-summary').innerHTML = html;

  // 时间线
  let timelineHtml = '';
  if (s.food_checkins && s.food_checkins.length > 0) {
    s.food_checkins.forEach(f => {
      timelineHtml += `
        <div class="timeline-item">
          <div class="timeline-icon">🍽</div>
          <div class="timeline-content">
            <div class="title">${f.food_name} ${f.amount_g}g</div>
            <div class="subtitle">${f.calories} kcal · ${f.meal_type === 'breakfast' ? '早餐' : f.meal_type === 'lunch' ? '午餐' : f.meal_type === 'dinner' ? '晚餐' : '加餐'}</div>
          </div>
        </div>`;
    });
  }
  if (s.exercise_checkins && s.exercise_checkins.length > 0) {
    s.exercise_checkins.forEach(e => {
      timelineHtml += `
        <div class="timeline-item">
          <div class="timeline-icon">🏃</div>
          <div class="timeline-content">
            <div class="title">${e.exercise_type} ${e.duration_min}分钟</div>
            <div class="subtitle">消耗 ${e.calories_burned} kcal</div>
          </div>
        </div>`;
    });
  }
  if (!timelineHtml) {
    timelineHtml = '<div class="empty-state"><p>今天还没有打卡记录<br>点击上方按钮开始吧 ✨</p></div>';
  }
  $('#home-timeline').innerHTML = timelineHtml;
}
