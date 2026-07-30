// ============ 趋势页 ============
let trendChart = null;
let trendMetric = 'weight';

async function renderTrends() {
  selectTrendTab(trendMetric);
}

async function selectTrendTab(metric) {
  trendMetric = metric;
  $$('#trends-tabs .tab-item').forEach(t => t.classList.remove('active'));
  const btn = $(`#trends-tabs [data-metric="${metric}"]`);
  if (btn) btn.classList.add('active');
  await loadTrendChart(metric);
}

async function loadTrendChart(metric) {
  const user = Store.get('user');
  const res = await API.getUserTrends(user.id, 30);
  if (!res.success) return;

  const ctx = $('#trend-chart').getContext('2d');
  if (trendChart) trendChart.destroy();

  const colors = {
    weight: { bg: 'rgba(127,204,182,0.2)', line: '#7FCCB6', label: '体重 (kg)' },
    calories: { bg: 'rgba(252,129,129,0.2)', line: '#FC8181', label: '摄入热量 (kcal)' },
    exercise: { bg: 'rgba(110,181,255,0.2)', line: '#6EB5FF', label: '运动消耗 (kcal)' },
    mood: { bg: 'rgba(246,173,85,0.2)', line: '#F6AD55', label: '心情指数' },
  };

  let chartData, chartLabel;
  switch (metric) {
    case 'weight':
      chartData = res.weights;
      chartLabel = '体重';
      break;
    case 'calories':
      chartData = res.foodCalories;
      chartLabel = '摄入热量';
      break;
    case 'exercise':
      chartData = res.exerciseCalories;
      chartLabel = '运动消耗';
      break;
    case 'mood':
      chartData = res.moods;
      chartLabel = '心情';
      break;
  }

  const c = colors[metric];
  const labels = [];
  const values = [];
  const dateMap = {};

  // 生成过去30天的日期轴
  for (let i = 29; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000);
    const ds = d.toISOString().split('T')[0];
    labels.push(`${d.getMonth() + 1}/${d.getDate()}`);
    dateMap[ds] = null;
  }

  chartData.forEach(item => {
    if (dateMap.hasOwnProperty(item.date)) dateMap[item.date] = item.value;
  });

  Object.keys(dateMap).forEach(date => values.push(dateMap[date]));

  // 心情用 1-5 范围
  const yMin = metric === 'mood' ? 0 : undefined;
  const yMax = metric === 'mood' ? 5 : undefined;

  trendChart = new Chart(ctx, {
    type: metric === 'mood' ? 'line' : 'line',
    data: {
      labels,
      datasets: [{
        label: c.label,
        data: values,
        borderColor: c.line,
        backgroundColor: c.bg,
        borderWidth: 2,
        fill: true,
        tension: 0.4,
        pointRadius: 3,
        pointBackgroundColor: c.line,
        spanGaps: false,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: true, labels: { font: { size: 12 }, usePointStyle: true } },
      },
      scales: {
        y: {
          min: yMin,
          max: yMax,
          ticks: { font: { size: 11 } },
          grid: { color: 'rgba(0,0,0,0.05)' },
        },
        x: {
          ticks: { font: { size: 10 }, maxTicksLimit: 10 },
          grid: { display: false },
        },
      },
    },
  });
  // 设置高度
  $('#trend-chart').parentElement.style.height = '280px';
}
