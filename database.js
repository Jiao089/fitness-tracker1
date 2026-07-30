const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

const DB_PATH = path.join(__dirname, 'fitness.db');

let SQL = null;
let db = null;
let ready = false;

async function init() {
  if (ready) return;
  SQL = await initSqlJs();
  
  // 尝试从文件加载
  if (fs.existsSync(DB_PATH)) {
    const buffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }
  
  initTables();
  ready = true;
}

function saveDb() {
  if (!db) return;
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(DB_PATH, buffer);
}

function initTables() {
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      nickname TEXT NOT NULL,
      height REAL,
      weight REAL,
      age INTEGER,
      gender TEXT DEFAULT 'female',
      circle_id TEXT,
      created_at TEXT DEFAULT (datetime('now','localtime'))
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS circles (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      invite_code TEXT UNIQUE NOT NULL,
      created_at TEXT DEFAULT (datetime('now','localtime'))
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS weight_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      weight REAL NOT NULL,
      recorded_date TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now','localtime'))
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS food_checkins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      food_name TEXT NOT NULL,
      category TEXT,
      amount_g REAL NOT NULL,
      calories REAL NOT NULL,
      protein REAL DEFAULT 0,
      fat REAL DEFAULT 0,
      carbs REAL DEFAULT 0,
      meal_type TEXT DEFAULT 'lunch',
      photo_path TEXT,
      checkin_date TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now','localtime'))
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS exercise_checkins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      exercise_type TEXT NOT NULL,
      duration_min REAL NOT NULL,
      met_value REAL NOT NULL,
      calories_burned REAL NOT NULL,
      checkin_date TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now','localtime'))
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS mood_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      mood_level INTEGER NOT NULL,
      note TEXT,
      recorded_date TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now','localtime'))
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS water_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      amount_ml REAL NOT NULL,
      drink_type TEXT DEFAULT '水',
      checkin_date TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now','localtime'))
    )
  `);

  // 索引
  db.run('CREATE INDEX IF NOT EXISTS idx_weight_user_date ON weight_records(user_id, recorded_date)');
  db.run('CREATE INDEX IF NOT EXISTS idx_food_user_date ON food_checkins(user_id, checkin_date)');
  db.run('CREATE INDEX IF NOT EXISTS idx_exercise_user_date ON exercise_checkins(user_id, checkin_date)');
  db.run('CREATE INDEX IF NOT EXISTS idx_mood_user_date ON mood_records(user_id, recorded_date)');
  db.run('CREATE INDEX IF NOT EXISTS idx_water_user_date ON water_records(user_id, checkin_date)');
  db.run('CREATE INDEX IF NOT EXISTS idx_users_circle ON users(circle_id)');
  
  saveDb();
}

function queryOne(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  if (stmt.step()) {
    const cols = stmt.getColumnNames();
    const vals = stmt.get();
    const obj = {};
    cols.forEach((c, i) => obj[c] = vals[i]);
    stmt.free();
    return obj;
  }
  stmt.free();
  return null;
}

function queryAll(sql, params = []) {
  const results = [];
  const stmt = db.prepare(sql);
  stmt.bind(params);
  while (stmt.step()) {
    const cols = stmt.getColumnNames();
    const vals = stmt.get();
    const obj = {};
    cols.forEach((c, i) => obj[c] = vals[i]);
    results.push(obj);
  }
  stmt.free();
  return results;
}

function execute(sql, params = []) {
  db.run(sql, params);
  saveDb();
}

// ==================== 用户操作 ====================
function createUser(nickname) {
  const id = uuidv4().slice(0, 8);
  execute('INSERT INTO users (id, nickname) VALUES (?, ?)', [id, nickname]);
  return getUser(id);
}

function getUser(id) {
  return queryOne('SELECT * FROM users WHERE id = ?', [id]);
}

function updateUser(id, { nickname, height, weight, age, gender, circle_id }) {
  const fields = [];
  const values = [];
  if (nickname !== undefined) { fields.push('nickname = ?'); values.push(nickname); }
  if (height !== undefined) { fields.push('height = ?'); values.push(height); }
  if (weight !== undefined) { fields.push('weight = ?'); values.push(weight); }
  if (age !== undefined) { fields.push('age = ?'); values.push(age); }
  if (gender !== undefined) { fields.push('gender = ?'); values.push(gender); }
  if (circle_id !== undefined) { fields.push('circle_id = ?'); values.push(circle_id); }
  if (fields.length > 0) {
    values.push(id);
    execute(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, values);
  }
  return getUser(id);
}

function joinCircle(userId, circleId) {
  execute('UPDATE users SET circle_id = ? WHERE id = ?', [circleId, userId]);
  return getUser(userId);
}

// ==================== 圈子操作 ====================
function createCircle(name) {
  const id = uuidv4().slice(0, 8);
  let inviteCode;
  do {
    inviteCode = Math.floor(100000 + Math.random() * 900000).toString();
  } while (queryOne('SELECT id FROM circles WHERE invite_code = ?', [inviteCode]));
  execute('INSERT INTO circles (id, name, invite_code) VALUES (?, ?, ?)', [id, name, inviteCode]);
  return queryOne('SELECT * FROM circles WHERE id = ?', [id]);
}

function getCircle(id) {
  return queryOne('SELECT * FROM circles WHERE id = ?', [id]);
}

function getCircleByCode(inviteCode) {
  return queryOne('SELECT * FROM circles WHERE invite_code = ?', [inviteCode]);
}

function getCircleMembers(circleId) {
  return queryAll('SELECT id, nickname, height, weight, age, gender, created_at FROM users WHERE circle_id = ?', [circleId]);
}

// ==================== 体重记录 ====================
function recordWeight(userId, weight, date) {
  const recordDate = date || new Date().toISOString().split('T')[0];
  execute('INSERT INTO weight_records (user_id, weight, recorded_date) VALUES (?, ?, ?)', [userId, weight, recordDate]);
  execute('UPDATE users SET weight = ? WHERE id = ?', [weight, userId]);
  return getWeightRecords(userId, recordDate, recordDate);
}

function getWeightRecords(userId, startDate, endDate) {
  let sql = 'SELECT * FROM weight_records WHERE user_id = ?';
  const params = [userId];
  if (startDate) { sql += ' AND recorded_date >= ?'; params.push(startDate); }
  if (endDate) { sql += ' AND recorded_date <= ?'; params.push(endDate); }
  sql += ' ORDER BY recorded_date ASC';
  return queryAll(sql, params);
}

// ==================== 饮食打卡 ====================
function checkinFood(userId, { food_name, category, amount_g, calories, protein, fat, carbs, meal_type, photo_path, date }) {
  const checkinDate = date || new Date().toISOString().split('T')[0];
  execute(
    'INSERT INTO food_checkins (user_id, food_name, category, amount_g, calories, protein, fat, carbs, meal_type, photo_path, checkin_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [userId, food_name, category || '', amount_g, calories, protein || 0, fat || 0, carbs || 0, meal_type || 'lunch', photo_path || '', checkinDate]
  );
  return getFoodCheckins(userId, checkinDate);
}

function getFoodCheckins(userId, date) {
  let sql = 'SELECT * FROM food_checkins WHERE user_id = ?';
  const params = [userId];
  if (date) { sql += ' AND checkin_date = ?'; params.push(date); }
  sql += ' ORDER BY created_at DESC';
  return queryAll(sql, params);
}

// ==================== 运动打卡 ====================
function checkinExercise(userId, { exercise_type, duration_min, met_value, calories_burned, date }) {
  const checkinDate = date || new Date().toISOString().split('T')[0];
  execute(
    'INSERT INTO exercise_checkins (user_id, exercise_type, duration_min, met_value, calories_burned, checkin_date) VALUES (?, ?, ?, ?, ?, ?)',
    [userId, exercise_type, duration_min, met_value, calories_burned, checkinDate]
  );
  return getExerciseCheckins(userId, checkinDate);
}

function getExerciseCheckins(userId, date) {
  let sql = 'SELECT * FROM exercise_checkins WHERE user_id = ?';
  const params = [userId];
  if (date) { sql += ' AND checkin_date = ?'; params.push(date); }
  sql += ' ORDER BY created_at DESC';
  return queryAll(sql, params);
}

// ==================== 心情记录 ====================
function recordMood(userId, moodLevel, note, date) {
  const recordDate = date || new Date().toISOString().split('T')[0];
  execute('INSERT INTO mood_records (user_id, mood_level, note, recorded_date) VALUES (?, ?, ?, ?)', [userId, moodLevel, note || '', recordDate]);
  return getMoodRecords(userId, recordDate, recordDate);
}

function getMoodRecords(userId, startDate, endDate) {
  let sql = 'SELECT * FROM mood_records WHERE user_id = ?';
  const params = [userId];
  if (startDate) { sql += ' AND recorded_date >= ?'; params.push(startDate); }
  if (endDate) { sql += ' AND recorded_date <= ?'; params.push(endDate); }
  sql += ' ORDER BY recorded_date ASC';
  return queryAll(sql, params);
}

// ==================== 日汇总 ====================
function getDailySummary(userId, date) {
  const user = getUser(userId);
  if (!user) return null;

  const targetDate = date || new Date().toISOString().split('T')[0];

  const foodResult = queryOne(
    'SELECT COALESCE(SUM(calories), 0) as total_calories, COALESCE(SUM(protein), 0) as total_protein, COALESCE(SUM(fat), 0) as total_fat, COALESCE(SUM(carbs), 0) as total_carbs FROM food_checkins WHERE user_id = ? AND checkin_date = ?',
    [userId, targetDate]
  );

  const exerciseResult = queryOne(
    'SELECT COALESCE(SUM(calories_burned), 0) as total_burned, COALESCE(SUM(duration_min), 0) as total_duration FROM exercise_checkins WHERE user_id = ? AND checkin_date = ?',
    [userId, targetDate]
  );

  const weightResult = queryOne(
    'SELECT weight FROM weight_records WHERE user_id = ? AND recorded_date = ? ORDER BY created_at DESC LIMIT 1',
    [userId, targetDate]
  );

  const moodResult = queryOne(
    'SELECT mood_level, note FROM mood_records WHERE user_id = ? AND recorded_date = ? ORDER BY created_at DESC LIMIT 1',
    [userId, targetDate]
  );

  const waterResult = queryOne(
    'SELECT COALESCE(SUM(amount_ml), 0) as total_ml, COUNT(*) as count FROM water_records WHERE user_id = ? AND checkin_date = ?',
    [userId, targetDate]
  );

  let bmr = 0;
  if (user.weight && user.height && user.age) {
    if (user.gender === 'male') {
      bmr = 10 * user.weight + 6.25 * user.height - 5 * user.age + 5;
    } else {
      bmr = 10 * user.weight + 6.25 * user.height - 5 * user.age - 161;
    }
  }

  const totalIntake = foodResult.total_calories;
  const totalBurned = exerciseResult.total_burned;
  const tdee = bmr + totalBurned;
  const deficit = totalIntake - tdee;

  return {
    date: targetDate,
    total_calories_intake: totalIntake,
    total_protein: foodResult.total_protein,
    total_fat: foodResult.total_fat,
    total_carbs: foodResult.total_carbs,
    total_calories_burned: totalBurned,
    total_exercise_min: exerciseResult.total_duration,
    bmr: Math.round(bmr),
    tdee: Math.round(tdee),
    deficit: Math.round(deficit),
    weight: weightResult ? weightResult.weight : user.weight,
    mood: moodResult || null,
    water_ml: waterResult.total_ml,
    water_count: waterResult.count,
    food_checkins: queryAll('SELECT * FROM food_checkins WHERE user_id = ? AND checkin_date = ? ORDER BY created_at DESC', [userId, targetDate]),
    exercise_checkins: queryAll('SELECT * FROM exercise_checkins WHERE user_id = ? AND checkin_date = ? ORDER BY created_at DESC', [userId, targetDate]),
  };
}

// ==================== 个人趋势 ====================
function getUserTrends(userId, days) {
  days = days || 30;
  const endDate = new Date().toISOString().split('T')[0];
  const startDate = new Date(Date.now() - (days - 1) * 86400000).toISOString().split('T')[0];

  const weights = queryAll(
    'SELECT recorded_date as date, weight as value FROM weight_records WHERE user_id = ? AND recorded_date >= ? AND recorded_date <= ? ORDER BY recorded_date ASC',
    [userId, startDate, endDate]
  );

  const foodCalories = queryAll(
    'SELECT checkin_date as date, SUM(calories) as value FROM food_checkins WHERE user_id = ? AND checkin_date >= ? AND checkin_date <= ? GROUP BY checkin_date ORDER BY checkin_date ASC',
    [userId, startDate, endDate]
  );

  const exerciseCalories = queryAll(
    'SELECT checkin_date as date, SUM(calories_burned) as value FROM exercise_checkins WHERE user_id = ? AND checkin_date >= ? AND checkin_date <= ? GROUP BY checkin_date ORDER BY checkin_date ASC',
    [userId, startDate, endDate]
  );

  const exerciseMinutes = queryAll(
    'SELECT checkin_date as date, SUM(duration_min) as value FROM exercise_checkins WHERE user_id = ? AND checkin_date >= ? AND checkin_date <= ? GROUP BY checkin_date ORDER BY checkin_date ASC',
    [userId, startDate, endDate]
  );

  const moods = queryAll(
    'SELECT recorded_date as date, mood_level as value FROM mood_records WHERE user_id = ? AND recorded_date >= ? AND recorded_date <= ? ORDER BY recorded_date ASC',
    [userId, startDate, endDate]
  );

  const waterData = getWaterStats(userId, startDate, endDate);

  const deficits = []; // 计算每天热量缺口
  const allDates = [];
  for (let d = new Date(startDate); d <= new Date(endDate); d.setDate(d.getDate() + 1)) {
    allDates.push(d.toISOString().split('T')[0]);
  }
  allDates.forEach(ds => {
    const foodDay = foodCalories.find(f => f.date === ds);
    const exDay = exerciseCalories.find(e => e.date === ds);
    const intake = foodDay ? foodDay.value : 0;
    const burned = exDay ? exDay.value : 0;
    const user = getUser(userId);
    let bmr = 0;
    if (user && user.weight && user.height && user.age) {
      bmr = user.gender === 'male' ? 10*user.weight + 6.25*user.height - 5*user.age + 5 : 10*user.weight + 6.25*user.height - 5*user.age - 161;
    }
    deficits.push({ date: ds, value: Math.round(intake - (bmr + burned)) });
  });

  return { weights, foodCalories, exerciseCalories, exerciseMinutes, moods, waterData, deficits, startDate, endDate };
}

// ==================== 圈子今日打卡 ====================
function getCircleToday(circleId) {
  const today = new Date().toISOString().split('T')[0];
  const members = getCircleMembers(circleId);

  const result = [];
  for (const member of members) {
    const foodItems = queryAll(
      'SELECT food_name, category, amount_g, calories, meal_type, photo_path FROM food_checkins WHERE user_id = ? AND checkin_date = ? ORDER BY created_at DESC',
      [member.id, today]
    );
    const exerciseItems = queryAll(
      'SELECT exercise_type, duration_min, calories_burned FROM exercise_checkins WHERE user_id = ? AND checkin_date = ? ORDER BY created_at DESC',
      [member.id, today]
    );
    const weightItem = queryOne(
      'SELECT weight FROM weight_records WHERE user_id = ? AND recorded_date = ? ORDER BY created_at DESC LIMIT 1',
      [member.id, today]
    );
    const moodItem = queryOne(
      'SELECT mood_level, note FROM mood_records WHERE user_id = ? AND recorded_date = ? ORDER BY created_at DESC LIMIT 1',
      [member.id, today]
    );

    result.push({
      user: member,
      food: foodItems,
      exercise: exerciseItems,
      weight: weightItem ? weightItem.weight : null,
      mood: moodItem || null,
      total_calories_intake: foodItems.reduce((s, f) => s + f.calories, 0),
      total_calories_burned: exerciseItems.reduce((s, e) => s + e.calories_burned, 0),
    });
  }

  return { date: today, members: result };
}

// ==================== 圈子趋势对比 ====================
function getCircleTrends(circleId, metric, days) {
  days = days || 30;
  const endDate = new Date().toISOString().split('T')[0];
  const startDate = new Date(Date.now() - (days - 1) * 86400000).toISOString().split('T')[0];
  const members = getCircleMembers(circleId);

  const datasets = [];
  for (const member of members) {
    let data;
    switch (metric) {
      case 'weight':
        data = queryAll(
          'SELECT recorded_date as date, weight as value FROM weight_records WHERE user_id = ? AND recorded_date >= ? AND recorded_date <= ? ORDER BY recorded_date ASC',
          [member.id, startDate, endDate]
        );
        break;
      case 'calories':
        data = queryAll(
          'SELECT checkin_date as date, SUM(calories) as value FROM food_checkins WHERE user_id = ? AND checkin_date >= ? AND checkin_date <= ? GROUP BY checkin_date ORDER BY checkin_date ASC',
          [member.id, startDate, endDate]
        );
        break;
      case 'exercise':
        data = queryAll(
          'SELECT checkin_date as date, SUM(calories_burned) as value FROM exercise_checkins WHERE user_id = ? AND checkin_date >= ? AND checkin_date <= ? GROUP BY checkin_date ORDER BY checkin_date ASC',
          [member.id, startDate, endDate]
        );
        break;
      case 'mood':
        data = queryAll(
          'SELECT recorded_date as date, mood_level as value FROM mood_records WHERE user_id = ? AND recorded_date >= ? AND recorded_date <= ? ORDER BY recorded_date ASC',
          [member.id, startDate, endDate]
        );
        break;
      default:
        data = [];
    }
    datasets.push({
      userId: member.id,
      nickname: member.nickname,
      data,
    });
  }

  return { metric, startDate, endDate, datasets };
}

// ==================== 喝水记录 ====================
function checkinWater(userId, amountMl, drinkType, date) {
  const checkinDate = date || new Date().toISOString().split('T')[0];
  execute(
    'INSERT INTO water_records (user_id, amount_ml, drink_type, checkin_date) VALUES (?, ?, ?, ?)',
    [userId, amountMl, drinkType || '水', checkinDate]
  );
  return getWaterRecords(userId, checkinDate);
}

function getWaterRecords(userId, date) {
  let sql = 'SELECT * FROM water_records WHERE user_id = ?';
  const params = [userId];
  if (date) { sql += ' AND checkin_date = ?'; params.push(date); }
  sql += ' ORDER BY created_at DESC';
  return queryAll(sql, params);
}

function getWaterStats(userId, startDate, endDate) {
  let sql = 'SELECT checkin_date as date, SUM(amount_ml) as value FROM water_records WHERE user_id = ?';
  const params = [userId];
  if (startDate) { sql += ' AND checkin_date >= ?'; params.push(startDate); }
  if (endDate) { sql += ' AND checkin_date <= ?'; params.push(endDate); }
  sql += ' GROUP BY checkin_date ORDER BY checkin_date ASC';
  return queryAll(sql, params);
}

// ==================== 历史数据 ====================
function getUserHistory(userId, type, startDate, endDate, page, pageSize) {
  page = page || 1;
  pageSize = pageSize || 20;

  let results = [];

  if (!type || type === 'food') {
    let sql = 'SELECT *, \'food\' as record_type FROM food_checkins WHERE user_id = ?';
    const params = [userId];
    if (startDate) { sql += ' AND checkin_date >= ?'; params.push(startDate); }
    if (endDate) { sql += ' AND checkin_date <= ?'; params.push(endDate); }
    sql += ' ORDER BY checkin_date DESC, created_at DESC';
    results = results.concat(queryAll(sql, params));
  }

  if (!type || type === 'exercise') {
    let sql = 'SELECT *, \'exercise\' as record_type FROM exercise_checkins WHERE user_id = ?';
    const params = [userId];
    if (startDate) { sql += ' AND checkin_date >= ?'; params.push(startDate); }
    if (endDate) { sql += ' AND checkin_date <= ?'; params.push(endDate); }
    sql += ' ORDER BY checkin_date DESC, created_at DESC';
    results = results.concat(queryAll(sql, params));
  }

  if (!type || type === 'weight') {
    let sql = 'SELECT *, \'weight\' as record_type FROM weight_records WHERE user_id = ?';
    const params = [userId];
    if (startDate) { sql += ' AND recorded_date >= ?'; params.push(startDate); }
    if (endDate) { sql += ' AND recorded_date <= ?'; params.push(endDate); }
    sql += ' ORDER BY recorded_date DESC, created_at DESC';
    results = results.concat(queryAll(sql, params));
  }

  if (!type || type === 'mood') {
    let sql = 'SELECT *, \'mood\' as record_type FROM mood_records WHERE user_id = ?';
    const params = [userId];
    if (startDate) { sql += ' AND recorded_date >= ?'; params.push(startDate); }
    if (endDate) { sql += ' AND recorded_date <= ?'; params.push(endDate); }
    sql += ' ORDER BY recorded_date DESC, created_at DESC';
    results = results.concat(queryAll(sql, params));
  }

  if (!type || type === 'water') {
    let sql = 'SELECT *, \'water\' as record_type FROM water_records WHERE user_id = ?';
    const params = [userId];
    if (startDate) { sql += ' AND checkin_date >= ?'; params.push(startDate); }
    if (endDate) { sql += ' AND checkin_date <= ?'; params.push(endDate); }
    sql += ' ORDER BY checkin_date DESC, created_at DESC';
    results = results.concat(queryAll(sql, params));
  }

  results.sort((a, b) => {
    const dateA = a.checkin_date || a.recorded_date;
    const dateB = b.checkin_date || b.recorded_date;
    return dateB.localeCompare(dateA);
  });

  const totalCount = results.length;
  const offset = (page - 1) * pageSize;
  const paged = results.slice(offset, offset + pageSize);

  return { records: paged, total: totalCount, page, pageSize, totalPages: Math.ceil(totalCount / pageSize) };
}

module.exports = {
  init,
  createUser, getUser, updateUser, joinCircle,
  createCircle, getCircle, getCircleByCode, getCircleMembers,
  recordWeight, getWeightRecords,
  checkinFood, getFoodCheckins,
  checkinExercise, getExerciseCheckins,
  recordMood, getMoodRecords,
  checkinWater, getWaterRecords, getWaterStats,
  getDailySummary, getUserTrends,
  getCircleToday, getCircleTrends,
  getUserHistory,
};
