// ============ 圈子页 ============
let circleCompareChart = null;
let circleCompareMetric = 'weight';

async function renderCircle() {
  const user = Store.get('user');
  if (!user) return;

  let circle = Store.get('circle');

  if (!circle) {
    // 没有圈子，显示创建/加入
    $('#circle-content').innerHTML = `
      <div class="glass-card" style="text-align:center;">
        <div style="font-size:60px;margin-bottom:12px;">👥</div>
        <h3 style="margin-bottom:8px;">还没有加入圈子</h3>
        <p style="font-size:var(--font-sm);color:var(--text-secondary);margin-bottom:16px;">创建一个圈子，邀请好友一起减脂打卡！</p>
        <div class="form-group">
          <input id="circle-name-input" class="glass-input" placeholder="圈子名称">
        </div>
        <button class="glass-btn primary" style="width:100%;margin-bottom:8px;" onclick="doCreateCircle()">✨ 创建圈子</button>
        <div style="font-size:var(--font-xs);color:var(--text-muted);margin:8px 0;">— 或 —</div>
        <div class="form-group">
          <input id="invite-code-input" class="glass-input" placeholder="输入6位邀请码" maxlength="6">
        </div>
        <button class="glass-btn" style="width:100%;" onclick="doJoinCircle()">🔗 加入圈子</button>
      </div>
    `;
    return;
  }

  // 有圈子
  const todayRes = await API.getCircleToday(circle.id);
  const membersRes = await API.getCircleMembers(circle.id);

  let membersHtml = '';
  if (membersRes.success) {
    membersRes.members.forEach(m => {
      membersHtml += `
        <div class="member-item">
          <div class="member-avatar">${m.nickname[0]}</div>
          <div class="member-info">
            <div class="member-name">${m.nickname} ${m.id === user.id ? '(我)' : ''}</div>
            <div class="member-status">${m.weight ? m.weight + 'kg' : '未记录体重'}</div>
          </div>
        </div>`;
    });
  }

  let todayHtml = '';
  if (todayRes.success && todayRes.members) {
    todayRes.members.forEach(m => {
      const items = [];
      if (m.food && m.food.length > 0) {
        items.push(`🍽 摄入${m.total_calories_intake}kcal`);
      }
      if (m.exercise && m.exercise.length > 0) {
        items.push(`🏃 消耗${m.total_calories_burned}kcal`);
      }
      if (m.weight) {
        items.push(`⚖️ ${m.weight}kg`);
      }
      if (m.mood) {
        items.push(`${moodSVG(m.mood.mood_level, 18)}`);
      }
      if (items.length > 0) {
        todayHtml += `
          <div class="member-item">
            <div class="member-avatar">${m.user.nickname[0]}</div>
            <div class="member-info">
              <div class="member-name">${m.user.nickname}</div>
              <div class="member-status">${items.join(' · ')}</div>
            </div>
          </div>`;
      }
    });
  }
  if (!todayHtml) todayHtml = '<div class="empty-state"><p>今天还没有人打卡</p></div>';

  $('#circle-content').innerHTML = `
    <div class="glass-card">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
        <div>
          <div style="font-weight:700;font-size:var(--font-lg);">👥 ${circle.name}</div>
          <div style="font-size:var(--font-xs);color:var(--text-muted);">邀请码：<strong style="letter-spacing:3px;">${circle.invite_code}</strong></div>
        </div>
        <button class="glass-btn" style="font-size:var(--font-xs);padding:6px 12px;" onclick="copyInviteCode('${circle.invite_code}')">📋 复制</button>
      </div>
    </div>

    <div class="glass-card">
      <div style="font-weight:600;margin-bottom:12px;">👤 成员 (${membersRes.success ? membersRes.members.length : 0})</div>
      <div class="member-list">${membersHtml}</div>
    </div>

    <div class="glass-card">
      <div style="font-weight:600;margin-bottom:12px;">📋 今日打卡</div>
      ${todayHtml}
    </div>

    <div class="glass-card">
      <div style="font-weight:600;margin-bottom:12px;">📊 圈子趋势对比</div>
      <div class="tab-bar" id="circle-compare-tabs">
        <button class="tab-item active" data-metric="weight" onclick="selectCircleCompareMetric('weight', this)">体重</button>
        <button class="tab-item" data-metric="calories" onclick="selectCircleCompareMetric('calories', this)">热量摄入</button>
        <button class="tab-item" data-metric="exercise" onclick="selectCircleCompareMetric('exercise', this)">运动消耗</button>
        <button class="tab-item" data-metric="mood" onclick="selectCircleCompareMetric('mood', this)">心情</button>
      </div>
      <div class="chart-container"><canvas id="circle-compare-chart"></canvas></div>
    </div>
  `;

  // 加载对比图表
  loadCircleCompareChart('weight');
}

async function doCreateCircle() {
  const name = $('#circle-name-input').value.trim();
  if (!name) { showToast('请输入圈子名称', 'error'); return; }
  const res = await API.createCircle(name);
  if (res.success) {
    // 加入自己创建的圈子
    const user = Store.get('user');
    const joinRes = await API.joinCircle(user.id, res.circle.invite_code);
    if (joinRes.success) {
      Store.set('circle', joinRes.circle);
      Store.set('user', joinRes.user);
      showToast(`圈子「${res.circle.name}」已创建！`, 'success');
      renderCircle();
    }
  } else {
    showToast(res.error, 'error');
  }
}

async function doJoinCircle() {
  const code = $('#invite-code-input').value.trim();
  if (!code) { showToast('请输入邀请码', 'error'); return; }
  const user = Store.get('user');
  const res = await API.joinCircle(user.id, code);
  if (res.success) {
    Store.set('circle', res.circle);
    Store.set('user', res.user);
    showToast(`已加入圈子「${res.circle.name}」`, 'success');
    renderCircle();
  } else {
    showToast(res.error || '加入失败', 'error');
  }
}

function copyInviteCode(code) {
  navigator.clipboard.writeText(code).then(() => {
    showToast('邀请码已复制', 'success');
  }).catch(() => {
    prompt('复制邀请码：', code);
  });
}

async function selectCircleCompareMetric(metric, btn) {
  circleCompareMetric = metric;
  $$('#circle-compare-tabs .tab-item').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
  loadCircleCompareChart(metric);
}

async function loadCircleCompareChart(metric) {
  const circle = Store.get('circle');
  if (!circle) return;
  const res = await API.getCircleTrends(circle.id, metric, 30);
  if (!res.success) return;

  const ctx = $('#circle-compare-chart').getContext('2d');
  if (circleCompareChart) circleCompareChart.destroy();

  const colorPalette = [
    '#7FCCB6', '#6EB5FF', '#FC8181', '#F6AD55', '#B794F4',
    '#68D391', '#4FD1C5', '#F687B3', '#90CDF4', '#FBD38D',
  ];

  // 生成日期轴
  const labels = [];
  const dateMap = {};
  for (let i = 29; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000);
    const ds = d.toISOString().split('T')[0];
    labels.push(`${d.getMonth() + 1}/${d.getDate()}`);
    dateMap[ds] = null;
  }

  const datasets = res.datasets.map((ds, idx) => {
    const values = Object.keys(dateMap).map(() => null);
    ds.data.forEach(item => {
      const di = Object.keys(dateMap).indexOf(item.date);
      if (di >= 0) values[di] = item.value;
    });
    return {
      label: ds.nickname,
      data: values,
      borderColor: colorPalette[idx % colorPalette.length],
      backgroundColor: colorPalette[idx % colorPalette.length] + '20',
      borderWidth: 2,
      tension: 0.4,
      pointRadius: 2,
      spanGaps: false,
    };
  });

  const metricNames = { weight: '体重 (kg)', calories: '摄入热量 (kcal)', exercise: '运动消耗 (kcal)', mood: '心情指数' };
  const yMin = metric === 'mood' ? 0 : undefined;
  const yMax = metric === 'mood' ? 5 : undefined;

  circleCompareChart = new Chart(ctx, {
    type: 'line',
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { labels: { font: { size: 10 }, usePointStyle: true, boxWidth: 8 } },
      },
      scales: {
        y: {
          min: yMin,
          max: yMax,
          title: { display: true, text: metricNames[metric], font: { size: 11 } },
          ticks: { font: { size: 10 } },
          grid: { color: 'rgba(0,0,0,0.05)' },
        },
        x: {
          ticks: { font: { size: 9 }, maxTicksLimit: 8 },
          grid: { display: false },
        },
      },
    },
  });
  $('#circle-compare-chart').parentElement.style.height = '260px';
}
