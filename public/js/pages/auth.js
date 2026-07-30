// ============ 登录/注册 ============
function renderAuth() {
  // 页面已在 HTML 中
}

async function doLogin() {
  const nickname = $('#auth-nickname').value.trim();
  if (!nickname) { showToast('请输入昵称', 'error'); return; }
  const res = await API.createUser(nickname);
  if (res.success) {
    Store.set('user', res.user);
    showToast(`欢迎，${res.user.nickname}！`, 'success');
    // 检查是否需要设置个人信息
    if (!res.user.height || !res.user.weight || !res.user.age) {
      navigate('settings');
    } else {
      navigate('home');
    }
  } else {
    showToast(res.error || '创建失败', 'error');
  }
}

async function showJoinCircle() {
  const nickname = $('#auth-nickname').value.trim();
  if (!nickname) { showToast('请先输入昵称', 'error'); return; }
  const inviteCode = prompt('请输入6位圈子邀请码：');
  if (!inviteCode) return;
  
  // 先创建用户
  const res = await API.createUser(nickname);
  if (!res.success) { showToast(res.error, 'error'); return; }
  Store.set('user', res.user);

  const joinRes = await API.joinCircle(res.user.id, inviteCode);
  if (joinRes.success) {
    Store.set('circle', joinRes.circle);
    Store.set('user', joinRes.user);
    showToast(`已加入圈子「${joinRes.circle.name}」`, 'success');
    if (!res.user.height || !res.user.weight || !res.user.age) {
      navigate('settings');
    } else {
      navigate('home');
    }
  } else {
    showToast(joinRes.error || '加入失败', 'error');
    navigate('home');
  }
}
