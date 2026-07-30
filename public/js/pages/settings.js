// ============ 设置页 ============
function renderSettings() {
  const user = Store.get('user');
  if (!user) return;

  const circle = Store.get('circle');

  $('#settings-content').innerHTML = `
    <div class="glass-card">
      <div style="text-align:center;margin-bottom:16px;">
        <div class="member-avatar" style="width:60px;height:60px;font-size:24px;margin:0 auto;">${user.nickname[0]}</div>
        <div style="font-weight:700;font-size:var(--font-lg);margin-top:8px;">${user.nickname}</div>
        ${circle ? `<div style="font-size:var(--font-xs);color:var(--text-secondary);">👥 ${circle.name}</div>` : ''}
      </div>

      <div class="form-group">
        <label>昵称</label>
        <input id="set-nickname" class="glass-input" value="${user.nickname}">
      </div>
      <div class="form-group">
        <label>性别</label>
        <div class="chip-group">
          <button class="chip ${user.gender === 'male' ? 'active' : ''}" onclick="selectGender('male', this)">♂ 男</button>
          <button class="chip ${user.gender === 'female' ? 'active' : ''}" onclick="selectGender('female', this)">♀ 女</button>
        </div>
      </div>
      <div class="form-group">
        <label>身高（cm）</label>
        <input id="set-height" class="glass-input" type="number" value="${user.height || ''}" placeholder="例如：165">
      </div>
      <div class="form-group">
        <label>体重（kg）</label>
        <input id="set-weight" class="glass-input" type="number" step="0.1" value="${user.weight || ''}" placeholder="例如：65.0">
      </div>
      <div class="form-group">
        <label>年龄</label>
        <input id="set-age" class="glass-input" type="number" value="${user.age || ''}" placeholder="例如：25">
      </div>
      <button class="glass-btn primary" style="width:100%;" onclick="saveSettings()">💾 保存设置</button>
    </div>

    <div class="glass-card">
      <div style="font-weight:600;margin-bottom:12px;">📊 BMR 计算预览</div>
      <div id="bmr-preview" style="text-align:center;font-size:var(--font-sm);color:var(--text-secondary);"></div>
    </div>

    <div class="glass-card">
      <div style="font-weight:600;margin-bottom:12px;">👥 圈子</div>
      ${circle ? `
        <p style="font-size:var(--font-sm);margin-bottom:8px;">当前圈子：<strong>${circle.name}</strong></p>
        <p style="font-size:var(--font-xs);color:var(--text-muted);margin-bottom:12px;">邀请码：${circle.invite_code}</p>
        <button class="glass-btn danger" style="width:100%;font-size:var(--font-sm);" onclick="leaveCircle()">退出圈子</button>
      ` : `
        <p style="font-size:var(--font-sm);color:var(--text-muted);">尚未加入圈子</p>
      `}
    </div>
  `;

  updateBMRPreview();
  // 监听变化实时更新 BMR
  ['set-height', 'set-weight', 'set-age'].forEach(id => {
    const el = $(`#${id}`);
    if (el) el.addEventListener('input', updateBMRPreview);
  });
}

let settingsGender = Store.get('user')?.gender || 'female';

function selectGender(gender, btn) {
  settingsGender = gender;
  $$('#settings-content .chip').forEach(c => c.classList.remove('active'));
  btn.classList.add('active');
  updateBMRPreview();
}

function updateBMRPreview() {
  const height = parseFloat($('#set-height')?.value) || 0;
  const weight = parseFloat($('#set-weight')?.value) || 0;
  const age = parseInt($('#set-age')?.value) || 0;

  if (height && weight && age) {
    let bmr;
    if (settingsGender === 'male') {
      bmr = Math.round(10 * weight + 6.25 * height - 5 * age + 5);
    } else {
      bmr = Math.round(10 * weight + 6.25 * height - 5 * age - 161);
    }
    $('#bmr-preview').innerHTML = `
      <div style="font-size:var(--font-2xl);font-weight:800;color:var(--primary-dark);">${bmr} <span style="font-size:var(--font-md);">kcal/天</span></div>
      <div style="margin-top:4px;">Mifflin-St Jeor 公式</div>
      <div style="font-size:var(--font-xs);color:var(--text-muted);margin-top:2px;">
        ${settingsGender === 'male' ? '10×体重 + 6.25×身高 - 5×年龄 + 5' : '10×体重 + 6.25×身高 - 5×年龄 - 161'}
      </div>
    `;
  } else {
    $('#bmr-preview').innerHTML = '<p>请填写完整的身高、体重和年龄以计算 BMR</p>';
  }
}

async function saveSettings() {
  const nickname = $('#set-nickname').value.trim();
  const height = parseFloat($('#set-height').value) || null;
  const weight = parseFloat($('#set-weight').value) || null;
  const age = parseInt($('#set-age').value) || null;

  if (!nickname) { showToast('昵称不能为空', 'error'); return; }

  const user = Store.get('user');
  const res = await API.updateUser(user.id, {
    nickname,
    height,
    weight,
    age,
    gender: settingsGender,
  });

  if (res.success) {
    Store.set('user', res.user);
    showToast('设置已保存', 'success');
  } else {
    showToast(res.error || '保存失败', 'error');
  }
}

async function leaveCircle() {
  if (!confirm('确定要退出当前圈子吗？')) return;
  const user = Store.get('user');
  await API.updateUser(user.id, { circle_id: null });
  Store.set('circle', null);
  user.circle_id = null;
  Store.set('user', user);
  showToast('已退出圈子', 'info');
  renderSettings();
}
