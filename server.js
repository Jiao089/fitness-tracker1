const express = require('express');
const path = require('path');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const db = require('./database');
const foodDb = require('./food-db.json');

const app = express();
const PORT = process.env.PORT || 3000;

// 数据库初始化（异步）
let dbReady = false;
db.init().then(() => { dbReady = true; console.log('📦 数据库已初始化'); });

// 中间件
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// 文件上传配置
const storage = multer.diskStorage({
  destination: path.join(__dirname, 'uploads'),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  },
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

// ==================== 用户 API ====================
app.post('/api/users', (req, res) => {
  try {
    const { nickname } = req.body;
    if (!nickname || !nickname.trim()) {
      return res.status(400).json({ error: '昵称不能为空' });
    }
    const user = db.createUser(nickname.trim());
    res.json({ success: true, user });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/users/:id', (req, res) => {
  try {
    const user = db.getUser(req.params.id);
    if (!user) return res.status(404).json({ error: '用户不存在' });
    res.json({ success: true, user });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.put('/api/users/:id', (req, res) => {
  try {
    const user = db.updateUser(req.params.id, req.body);
    if (!user) return res.status(404).json({ error: '用户不存在' });
    res.json({ success: true, user });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ==================== 圈子 API ====================
app.post('/api/circles', (req, res) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: '圈子名称不能为空' });
    }
    const circle = db.createCircle(name.trim());
    res.json({ success: true, circle });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/circles/join', (req, res) => {
  try {
    const { userId, inviteCode } = req.body;
    if (!userId || !inviteCode) {
      return res.status(400).json({ error: '参数不完整' });
    }
    const circle = db.getCircleByCode(inviteCode);
    if (!circle) {
      return res.status(404).json({ error: '圈子不存在或邀请码错误' });
    }
    const user = db.joinCircle(userId, circle.id);
    res.json({ success: true, circle, user });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/circles/:id', (req, res) => {
  try {
    const circle = db.getCircle(req.params.id);
    if (!circle) return res.status(404).json({ error: '圈子不存在' });
    res.json({ success: true, circle });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/circles/:id/members', (req, res) => {
  try {
    const members = db.getCircleMembers(req.params.id);
    res.json({ success: true, members });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ==================== 打卡 API ====================
app.post('/api/checkins/food', (req, res) => {
  try {
    const { user_id, food_name, category, amount_g, meal_type, date } = req.body;
    if (!user_id || !food_name || !amount_g) {
      return res.status(400).json({ error: '参数不完整' });
    }

    // 从食物库查找营养数据；如果提供了直接热量则使用直接热量
    const foodData = foodDb.find(f => f.name === food_name);
    let calories, protein, fat, carbs;

    if (req.body.calories !== undefined && (req.body.calories > 0 || foodData)) {
      // 直接热量模式（自定义录入）
      calories = req.body.calories || (foodData ? Math.round(foodData.calories * amount_g / 100) : 0);
      protein = req.body.protein !== undefined ? req.body.protein : (foodData ? Math.round(foodData.protein * amount_g / 100 * 10) / 10 : 0);
      fat = req.body.fat !== undefined ? req.body.fat : (foodData ? Math.round(foodData.fat * amount_g / 100 * 10) / 10 : 0);
      carbs = req.body.carbs !== undefined ? req.body.carbs : (foodData ? Math.round(foodData.carbs * amount_g / 100 * 10) / 10 : 0);
    } else if (foodData) {
      const ratio = amount_g / 100;
      calories = Math.round(foodData.calories * ratio);
      protein = Math.round(foodData.protein * ratio * 10) / 10;
      fat = Math.round(foodData.fat * ratio * 10) / 10;
      carbs = Math.round(foodData.carbs * ratio * 10) / 10;
    } else {
      return res.status(400).json({ error: '未找到该食物，请使用快速录入模式' });
    }

    const result = db.checkinFood(user_id, {
      food_name,
      category: category || foodData.category,
      amount_g,
      calories,
      protein,
      fat,
      carbs,
      meal_type: meal_type || 'lunch',
      photo_path: req.body.photo_path || '',
      date,
    });

    res.json({ success: true, checkin: result[0], nutrition: { calories, protein, fat, carbs } });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/checkins/exercise', (req, res) => {
  try {
    const { user_id, exercise_type, duration_min, met_value, date } = req.body;
    if (!user_id || !exercise_type || !duration_min || !met_value) {
      return res.status(400).json({ error: '参数不完整' });
    }

    // 计算运动消耗: MET × 体重(kg) × 时长(小时)
    const user = db.getUser(user_id);
    if (!user) return res.status(404).json({ error: '用户不存在' });
    if (!user.weight) return res.status(400).json({ error: '请先设置体重' });

    const calories_burned = Math.round(met_value * user.weight * (duration_min / 60));

    const result = db.checkinExercise(user_id, {
      exercise_type,
      duration_min,
      met_value,
      calories_burned,
      date,
    });

    res.json({ success: true, checkin: result[0], calories_burned });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ==================== 记录 API ====================
app.post('/api/records/weight', (req, res) => {
  try {
    const { user_id, weight, date } = req.body;
    if (!user_id || !weight) {
      return res.status(400).json({ error: '参数不完整' });
    }
    const records = db.recordWeight(user_id, weight, date);
    res.json({ success: true, record: records[records.length - 1] });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/records/mood', (req, res) => {
  try {
    const { user_id, mood_level, note, date } = req.body;
    if (!user_id || !mood_level) {
      return res.status(400).json({ error: '参数不完整' });
    }
    const records = db.recordMood(user_id, mood_level, note, date);
    res.json({ success: true, record: records[records.length - 1] });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 喝水记录
app.post('/api/records/water', (req, res) => {
  try {
    const { user_id, amount_ml, drink_type, date } = req.body;
    if (!user_id || !amount_ml) {
      return res.status(400).json({ error: '参数不完整' });
    }
    const records = db.checkinWater(user_id, amount_ml, drink_type || '水', date);
    res.json({ success: true, record: records[0], total_ml: records.reduce((s, r) => s + r.amount_ml, 0) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/records/water', (req, res) => {
  try {
    const { user_id, date } = req.query;
    if (!user_id) return res.status(400).json({ error: '缺少user_id' });
    const records = db.getWaterRecords(user_id, date);
    res.json({ success: true, records });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ==================== 查询 API ====================
app.get('/api/checkins/food', (req, res) => {
  try {
    const { user_id, date } = req.query;
    if (!user_id) return res.status(400).json({ error: '缺少user_id' });
    const checkins = db.getFoodCheckins(user_id, date);
    res.json({ success: true, checkins });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/checkins/exercise', (req, res) => {
  try {
    const { user_id, date } = req.query;
    if (!user_id) return res.status(400).json({ error: '缺少user_id' });
    const checkins = db.getExerciseCheckins(user_id, date);
    res.json({ success: true, checkins });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/records/weight', (req, res) => {
  try {
    const { user_id, start, end } = req.query;
    if (!user_id) return res.status(400).json({ error: '缺少user_id' });
    const records = db.getWeightRecords(user_id, start, end);
    res.json({ success: true, records });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/records/mood', (req, res) => {
  try {
    const { user_id, start, end } = req.query;
    if (!user_id) return res.status(400).json({ error: '缺少user_id' });
    const records = db.getMoodRecords(user_id, start, end);
    res.json({ success: true, records });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ==================== 汇总 & 趋势 ====================
app.get('/api/users/:id/daily-summary', (req, res) => {
  try {
    const summary = db.getDailySummary(req.params.id, req.query.date);
    if (!summary) return res.status(404).json({ error: '用户不存在' });
    res.json({ success: true, summary });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/users/:id/trends', (req, res) => {
  try {
    const trends = db.getUserTrends(req.params.id, parseInt(req.query.days) || 30);
    res.json({ success: true, ...trends });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/users/:id/history', (req, res) => {
  try {
    const { type, start, end, page, pageSize } = req.query;
    const history = db.getUserHistory(req.params.id, type, start, end, parseInt(page) || 1, parseInt(pageSize) || 20);
    res.json({ success: true, ...history });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ==================== 圈子 API（打卡 & 趋势）====================
app.get('/api/circles/:id/today', (req, res) => {
  try {
    const today = db.getCircleToday(req.params.id);
    res.json({ success: true, ...today });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/circles/:id/trends', (req, res) => {
  try {
    const { metric, days } = req.query;
    const trends = db.getCircleTrends(req.params.id, metric || 'weight', parseInt(days) || 30);
    res.json({ success: true, ...trends });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ==================== 食物搜索 ====================
app.get('/api/foods', (req, res) => {
  const { search, category } = req.query;
  let results = foodDb;
  if (category) {
    results = results.filter(f => f.category === category);
  }
  if (search) {
    const kw = search.toLowerCase();
    results = results.filter(f => f.name.includes(kw) || f.category.includes(kw));
  }
  res.json({ success: true, foods: results });
});

app.get('/api/foods/categories', (req, res) => {
  const categories = [...new Set(foodDb.map(f => f.category))];
  res.json({ success: true, categories });
});

// 文件上传（保留接口，拍照功能已移除，但保留以防后续需要）
app.post('/api/upload', upload.single('photo'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: '未上传文件' });
  }
  res.json({ success: true, path: `/uploads/${req.file.filename}` });
});

// 静态文件 - uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ==================== 运动类型 MET 值 ====================
app.get('/api/exercises', (req, res) => {
  const exercises = [
    { name: '快走', met: 4.5, icon: 'walk' },
    { name: '慢跑', met: 7.0, icon: 'run' },
    { name: '跑步(8km/h)', met: 8.0, icon: 'run' },
    { name: '跑步(10km/h)', met: 10.0, icon: 'run' },
    { name: '跳绳', met: 12.0, icon: 'jump' },
    { name: '游泳(慢)', met: 6.0, icon: 'swim' },
    { name: '游泳(快)', met: 10.0, icon: 'swim' },
    { name: '骑行(12km/h)', met: 6.0, icon: 'bike' },
    { name: '骑行(20km/h)', met: 8.0, icon: 'bike' },
    { name: '瑜伽', met: 2.5, icon: 'yoga' },
    { name: 'HIIT', met: 10.0, icon: 'hiit' },
    { name: '力量训练', met: 6.0, icon: 'strength' },
    { name: '爬楼梯', met: 8.0, icon: 'stairs' },
    { name: '羽毛球', met: 5.5, icon: 'badminton' },
    { name: '篮球', met: 6.5, icon: 'basketball' },
    { name: '足球', met: 7.0, icon: 'football' },
    { name: '乒乓球', met: 4.0, icon: 'pingpong' },
    { name: '舞蹈', met: 5.0, icon: 'dance' },
    { name: '普拉提', met: 3.0, icon: 'pilates' },
    { name: '拉伸', met: 2.3, icon: 'stretch' },
  ];
  res.json({ success: true, exercises });
});

// SPA fallback
app.use((req, res, next) => {
  if (req.method === 'GET' && !req.path.startsWith('/api') && !req.path.startsWith('/uploads')) {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  } else {
    next();
  }
});

async function startServer() {
  await db.init();
  dbReady = true;
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🏃 减脂打卡服务器启动: http://0.0.0.0:${PORT}`);
  });
}
startServer().catch(e => { console.error('启动失败:', e); process.exit(1); });
