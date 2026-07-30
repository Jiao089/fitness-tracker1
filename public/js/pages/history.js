// ============ 历史页 ============
let historyDate = new Date();
let historyRecords = [];
let historyPage = 1;

async function renderHistory() {
  const user = Store.get('user');
  if (!user) return;
  await loadHistoryData();
}

async function loadHistoryData() {
  const user = Store.get('user');
  const res = await API.getUserHistory(user.id, { page: historyPage, pageSize: 50 });
  if (!res.success) return;
  historyRecords = res.records;

  renderCalendar();
  renderHistoryList();
}

// ============ 日历 ============
function renderCalendar() {
  const y = historyDate.getFullYear();
  const m = historyDate.getMonth();
  const firstDay = new Date(y, m, 1).getDay();
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const prevDays = new Date(y, m, 0).getDate();

  // 收集有记录的日期
  const recordDates = new Set();
  historyRecords.forEach(r => {
    const d = r.checkin_date || r.recorded_date;
    if (d) recordDates.add(d);
  });

  const todayStr = today();
  const dayHeaders = ['日', '一', '二', '三', '四', '五', '六'];

  let html = `
    <div class="glass-card">
      <div class="calendar-header">
        <button onclick="changeMonth(-1)">◀</button>
        <span style="font-weight:600;">${y}年${m + 1}月</span>
        <button onclick="changeMonth(1)">▶</button>
      </div>
      <div class="calendar-grid">
  `;

  dayHeaders.forEach(d => { html += `<div class="day-header">${d}</div>`; });

  // 上月填充
  for (let i = firstDay - 1; i >= 0; i--) {
    html += `<div class="day-cell other-month">${prevDays - i}</div>`;
  }

  // 本月
  for (let d = 1; d <= daysInMonth; d++) {
    const ds = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const isToday = ds === todayStr;
    const hasRecord = recordDates.has(ds);
    let cls = 'day-cell';
    if (isToday) cls += ' today';
    if (hasRecord) cls += ' has-record';
    html += `<div class="${cls}" onclick="selectHistoryDate('${ds}', this)">${d}</div>`;
  }

  // 下月填充
  const totalCells = firstDay + daysInMonth;
  const remaining = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);
  for (let i = 1; i <= remaining; i++) {
    html += `<div class="day-cell other-month">${i}</div>`;
  }

  html += `</div></div>`;
  $('#history-content').innerHTML = html + '<div id="history-list"></div>';
}

function changeMonth(delta) {
  historyDate.setMonth(historyDate.getMonth() + delta);
  renderCalendar();
  renderHistoryList();
}

function selectHistoryDate(ds, el) {
  $$('.day-cell').forEach(c => c.classList.remove('selected'));
  el.classList.add('selected');
  renderHistoryList(ds);
}

// ============ 历史列表 ============
function renderHistoryList(filterDate) {
  let records = historyRecords;
  if (filterDate) {
    records = records.filter(r => (r.checkin_date || r.recorded_date) === filterDate);
  }

  if (records.length === 0) {
    $('#history-list').innerHTML = '<div class="empty-state"><p>暂无记录</p></div>';
    return;
  }

  let html = '';
  records.forEach(r => {
    const type = r.record_type;
    let icon, title, subtitle;
    switch (type) {
      case 'food':
        icon = '🍽';
        title = `${r.food_name} ${r.amount_g}g`;
        subtitle = `${r.calories}kcal · ${r.meal_type === 'breakfast' ? '早餐' : r.meal_type === 'lunch' ? '午餐' : r.meal_type === 'dinner' ? '晚餐' : '加餐'}`;
        break;
      case 'exercise':
        icon = '🏃';
        title = `${r.exercise_type} ${r.duration_min}分钟`;
        subtitle = `消耗 ${r.calories_burned} kcal`;
        break;
      case 'weight':
        icon = '⚖️';
        title = `体重记录：${r.weight} kg`;
        subtitle = r.recorded_date;
        break;
      case 'mood':
        icon = '💭';
        title = `${moodSVG(r.mood_level, 18)} ${moodLabel(r.mood_level)}`;
        subtitle = r.note || r.recorded_date;
        break;
    }
    html += `
      <div class="timeline-item">
        <div class="timeline-icon">${icon}</div>
        <div class="timeline-content">
          <div class="title">${title}</div>
          <div class="subtitle">${subtitle} · ${r.checkin_date || r.recorded_date}</div>
        </div>
      </div>`;
  });

  $('#history-list').innerHTML = `<div class="glass-card" style="margin-top:14px;">${html}</div>`;
}
