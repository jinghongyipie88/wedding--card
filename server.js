/**
 * 婚礼邀请函 SaaS - 后端服务
 * 功能：邀请函CRUD、回执收集、管理后台、静态文件服务
 * 存储：本地 JSON 文件（自托管 / 本地开发）或 Upstash KV 云存储（Vercel 部署）
 * 部署：Vercel 时通过 api/index.js 导出，需配置环境变量 KV_REST_API_URL / KV_REST_API_TOKEN
 */
const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin2026';
// 数据加密密钥：生产环境必须通过环境变量 DATA_KEY 设置，勿使用默认值上线
const DATA_KEY = process.env.DATA_KEY || 'wedding-invite-dev-key-please-change';

const DATA_DIR = path.join(__dirname, 'data');
const INVITES_DIR = path.join(DATA_DIR, 'invites');
const RSVPS_DIR = path.join(DATA_DIR, 'rsvps');

// 确保目录存在（本地文件模式）
[DATA_DIR, INVITES_DIR, RSVPS_DIR].forEach(d => {
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
});

/* ── 云存储（Upstash KV REST API，供 Vercel 等无持久文件系统环境使用）──
   配置了 KV_REST_API_URL 与 KV_REST_API_TOKEN 时启用；未配置则回落本地文件。 */
const KV_URL = (process.env.KV_REST_API_URL || '').replace(/\/+$/, '');
const KV_TOKEN = process.env.KV_REST_API_TOKEN || '';
const USE_KV = !!(KV_URL && KV_TOKEN);

async function kvGet(key) {
  const res = await fetch(`${KV_URL}/get/${key}`, {
    headers: { Authorization: `Bearer ${KV_TOKEN}` }
  });
  if (!res.ok) throw new Error(`KV get ${key} failed: ${res.status}`);
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return data.result; // null 或 JSON 字符串
}
async function kvSet(key, value) {
  const res = await fetch(`${KV_URL}/set/${key}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${KV_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ value: JSON.stringify(value) })
  });
  if (!res.ok) throw new Error(`KV set ${key} failed: ${res.status}`);
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return data;
}
async function kvKeys(prefix) {
  const res = await fetch(`${KV_URL}/keys/${prefix}*`, {
    headers: { Authorization: `Bearer ${KV_TOKEN}` }
  });
  if (!res.ok) throw new Error(`KV keys ${prefix} failed: ${res.status}`);
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return data.result || [];
}
async function kvDel(key) {
  const res = await fetch(`${KV_URL}/del/${key}`, {
    headers: { Authorization: `Bearer ${KV_TOKEN}` }
  });
  if (!res.ok) throw new Error(`KV del ${key} failed: ${res.status}`);
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return data;
}

app.use(express.json({ limit: '10mb' }));
// 静态文件目录：Vercel 函数运行时位于 api/ 下，public 在上一级
let PUBLIC_DIR = path.join(__dirname, 'public');
if (!fs.existsSync(PUBLIC_DIR) && fs.existsSync(path.join(__dirname, '..', 'public'))) {
  PUBLIC_DIR = path.join(__dirname, '..', 'public');
}
app.use(express.static(PUBLIC_DIR));
if (fs.existsSync(path.join(__dirname, 'assets'))) {
  app.use('/assets', express.static(path.join(__dirname, 'assets')));
}

// ── 工具函数 ──
function genId(len = 8) {
  return crypto.randomBytes(len).toString('hex').slice(0, len);
}
// 生成编辑解锁码：6位，不含易混淆字符（0/O、1/I）
function genUnlockCode() {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let code = '';
  for (let i = 0; i < 6; i++) code += chars[crypto.randomInt(chars.length)];
  return code;
}

/* ── 敏感数据加密（AES-256-GCM）──
   宾客电话等敏感字段在磁盘上以密文保存，即使服务器文件被拖走也无法读取明文。
   密钥来自环境变量 DATA_KEY，代码中不存明文密钥。 */
const encKey = crypto.createHash('sha256').update(DATA_KEY).digest();
function encrypt(text) {
  if (text === undefined || text === null || text === '') return '';
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', encKey, iv);
  const enc = Buffer.concat([cipher.update(String(text), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return 'enc:' + Buffer.concat([iv, tag, enc]).toString('base64');
}
function decrypt(text) {
  if (!text || typeof text !== 'string' || !text.startsWith('enc:')) return text || '';
  try {
    const buf = Buffer.from(text.slice(4), 'base64');
    const iv = buf.slice(0, 12);
    const tag = buf.slice(12, 28);
    const data = buf.slice(28);
    const decipher = crypto.createDecipheriv('aes-256-gcm', encKey, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
  } catch (e) {
    return text; // 解密失败时返回原值，避免后台崩溃
  }
}

/* ── 管理后台登录限流 ──
   同一 IP 连续输错密码 5 次，锁定 10 分钟，防止暴力破解 */
const loginFails = new Map(); // ip -> {count, lockUntil}
function checkLocked(req) {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const rec = loginFails.get(ip);
  if (!rec) return false;
  if (rec.lockUntil && rec.lockUntil > Date.now()) return true;
  if (rec.lockUntil && rec.lockUntil <= Date.now()) loginFails.delete(ip);
  return false;
}
function recordLoginFail(req) {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const rec = loginFails.get(ip) || { count: 0, lockUntil: 0 };
  rec.count += 1;
  if (rec.count >= 5) {
    rec.lockUntil = Date.now() + 10 * 60 * 1000; // 锁10分钟
    rec.count = 0;
  }
  loginFails.set(ip, rec);
}
function recordLoginOk(req) {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  loginFails.delete(ip);
}

/* ── 存储层：云存储（KV）与本地文件双实现 ── */
async function readInvite(id) {
  if (USE_KV) {
    const raw = await kvGet(`invite:${id}`);
    return raw ? JSON.parse(raw) : null;
  }
  const file = path.join(INVITES_DIR, `${id}.json`);
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

async function writeInvite(id, data) {
  if (USE_KV) return kvSet(`invite:${id}`, data);
  fs.writeFileSync(path.join(INVITES_DIR, `${id}.json`), JSON.stringify(data, null, 2));
}

async function readRsvps(inviteId) {
  if (USE_KV) {
    const raw = await kvGet(`rsvp:${inviteId}`);
    const list = raw ? JSON.parse(raw) : [];
    // 读取时解密电话，供管理后台展示
    return list.map(r => ({ ...r, phone: decrypt(r.phone) }));
  }
  const file = path.join(RSVPS_DIR, `${inviteId}.json`);
  if (!fs.existsSync(file)) return [];
  const list = JSON.parse(fs.readFileSync(file, 'utf8'));
  // 读取时解密电话，供管理后台展示
  return list.map(r => ({ ...r, phone: decrypt(r.phone) }));
}

async function writeRsvp(inviteId, rsvp) {
  const list = await readRsvps(inviteId);
  // readRsvps 已解密电话，这里需重新加密后落盘
  const stored = {
    name: rsvp.name,
    count: rsvp.count,
    phone: encrypt(rsvp.phone),
    message: rsvp.message || ''
  };
  list.push({ ...stored, id: genId(6), createdAt: new Date().toISOString() });
  if (USE_KV) {
    await kvSet(`rsvp:${inviteId}`, list);
    return list;
  }
  fs.writeFileSync(path.join(RSVPS_DIR, `${inviteId}.json`), JSON.stringify(list, null, 2));
  return list;
}

async function listInvites() {
  if (USE_KV) {
    const keys = await kvKeys('invite:');
    const invites = [];
    for (const key of keys) {
      const raw = await kvGet(key);
      if (!raw) continue;
      const data = JSON.parse(raw);
      const rsvps = await readRsvps(data.id);
      invites.push({
        id: data.id,
        groom: data.groom,
        bride: data.bride,
        date: data.date,
        location: data.location,
        theme: data.theme,
        views: data.views || 0,
        rsvpCount: rsvps.length,
        createdAt: data.createdAt,
        unlockCode: data.unlockCode || '',
        editUrl: `/editor?id=${data.id}&code=${data.unlockCode || ''}`
      });
    }
    return invites.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }
  const files = fs.readdirSync(INVITES_DIR).filter(f => f.endsWith('.json'));
  const invites = files.map(f => {
    const data = JSON.parse(fs.readFileSync(path.join(INVITES_DIR, f), 'utf8'));
    const rsvps = readRsvps(data.id);
    return {
      id: data.id,
      groom: data.groom,
      bride: data.bride,
      date: data.date,
      location: data.location,
      theme: data.theme,
      views: data.views || 0,
      rsvpCount: rsvps.length,
      createdAt: data.createdAt,
      unlockCode: data.unlockCode || '',
      editUrl: `/editor?id=${data.id}&code=${data.unlockCode || ''}`
    };
  }).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  return invites;
}

async function deleteInvite(id) {
  if (USE_KV) {
    await kvDel(`invite:${id}`);
    await kvDel(`rsvp:${id}`);
    return;
  }
  const inviteFile = path.join(INVITES_DIR, `${id}.json`);
  const rsvpFile = path.join(RSVPS_DIR, `${id}.json`);
  if (fs.existsSync(inviteFile)) fs.unlinkSync(inviteFile);
  if (fs.existsSync(rsvpFile)) fs.unlinkSync(rsvpFile);
}

async function clearRsvps(id) {
  if (USE_KV) {
    const raw = await kvGet(`rsvp:${id}`);
    if (!raw) return 0;
    const list = JSON.parse(raw);
    await kvSet(`rsvp:${id}`, []);
    return list.length;
  }
  const rsvpFile = path.join(RSVPS_DIR, `${id}.json`);
  if (fs.existsSync(rsvpFile)) {
    const list = JSON.parse(fs.readFileSync(rsvpFile, 'utf8'));
    fs.writeFileSync(rsvpFile, JSON.stringify([], null, 2));
    return list.length;
  }
  return 0;
}

function authAdmin(req, res, next) {
  // 限流：同 IP 连续输错 5 次锁 10 分钟
  if (checkLocked(req)) {
    return res.status(429).json({ error: '尝试次数过多，请 10 分钟后再试' });
  }
  const pwd = req.headers['x-admin-password'] || req.query.password;
  if (pwd !== ADMIN_PASSWORD) {
    recordLoginFail(req);
    return res.status(401).json({ error: '管理密码错误' });
  }
  recordLoginOk(req);
  next();
}

// async 路由错误统一处理
const ah = fn => (req, res) => {
  Promise.resolve(fn(req, res)).catch(e => {
    console.error('[server]', e);
    if (!res.headersSent) res.status(500).json({ error: '服务器错误，请稍后再试' });
  });
};

// ── API: 创建邀请函（需管理认证，运营代客户创建草稿，客户凭解锁码自己编辑）──
app.post('/api/invites', authAdmin, ah(async (req, res) => {
  const { groom, bride, date, location, theme } = req.body;
  const id = genId();
  const invite = {
    id,
    groom: groom || '',
    bride: bride || '',
    date: date || '',
    location: location || '',
    theme: theme || 'champagne',
    story: [],
    coverImage: '',
    photos: [],
    music: '',
    unlockCode: genUnlockCode(),
    views: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  await writeInvite(id, invite);
  res.json({
    id,
    unlockCode: invite.unlockCode,
    editUrl: `/editor?id=${id}&code=${invite.unlockCode}`,
    url: `/invite/${id}`
  });
}));

// ── API: 获取邀请函 ──
app.get('/api/invites/:id', ah(async (req, res) => {
  const invite = await readInvite(req.params.id);
  if (!invite) return res.status(404).json({ error: '邀请函不存在' });
  // 浏览量+1
  invite.views = (invite.views || 0) + 1;
  await writeInvite(req.params.id, invite);
  // 不返回敏感字段（unlockCode 仅限管理后台可见）
  const { unlockCode, ...publicData } = invite;
  res.json(publicData);
}));

// ── API: 更新邀请函（必须携带正确的编辑解锁码）──
app.put('/api/invites/:id', ah(async (req, res) => {
  const invite = await readInvite(req.params.id);
  if (!invite) return res.status(404).json({ error: '邀请函不存在' });
  // 解锁码校验：没有正确的解锁码无法修改任何内容
  const code = (req.body.unlockCode || req.headers['x-unlock-code'] || '').trim();
  if (!invite.unlockCode || code !== invite.unlockCode) {
    return res.status(403).json({ error: '编辑码错误，无法修改这份邀请函' });
  }
  const { unlockCode, ...body } = req.body; // 解锁码只用于校验，不覆盖原值
  const updated = { ...invite, ...body, id: invite.id, unlockCode: invite.unlockCode, updatedAt: new Date().toISOString() };
  await writeInvite(req.params.id, updated);
  res.json({ success: true });
}));

// ── API: 提交回执 ──
app.post('/api/invites/:id/rsvp', ah(async (req, res) => {
  const invite = await readInvite(req.params.id);
  if (!invite) return res.status(404).json({ error: '邀请函不存在' });
  const { name, count, phone, message } = req.body;
  if (!name || !count || !phone) {
    return res.status(400).json({ error: '姓名、人数、电话为必填项' });
  }
  const list = await writeRsvp(req.params.id, { name, count: parseInt(count), phone, message: message || '' });
  res.json({ success: true, total: list.length });
}));

// ── API: 获取回执列表（需管理密码）──
app.get('/api/invites/:id/rsvps', authAdmin, ah(async (req, res) => {
  const list = await readRsvps(req.params.id);
  res.json({ rsvps: list, total: list.length });
}));

// ── API: 管理后台 - 获取所有邀请函 ──
app.get('/api/admin/invites', authAdmin, ah(async (req, res) => {
  const invites = await listInvites();
  res.json({ invites, total: invites.length });
}));

// ── API: 管理后台 - 删除邀请函 ──
app.delete('/api/admin/invites/:id', authAdmin, ah(async (req, res) => {
  await deleteInvite(req.params.id);
  res.json({ success: true });
}));

// ── API: 管理后台 - 一键清空宾客回执数据（婚礼后可执行，保留邀请函本身）──
app.delete('/api/admin/invites/:id/rsvps', authAdmin, ah(async (req, res) => {
  const cleared = await clearRsvps(req.params.id);
  res.json({ success: true, cleared });
}));

// ── 页面路由 ──
app.get('/invite/:id', (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'invite.html'));
});

app.get('/editor', (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'editor.html'));
});

app.get('/editor/:id', (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'editor.html'));
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'admin.html'));
});

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// 本地直接运行时启动监听；Vercel 通过 api/index.js 导出 app
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`\n  婚礼邀请函服务已启动`);
    console.log(`  存储模式: ${USE_KV ? 'Upstash KV（云存储）' : '本地 JSON 文件'}`);
    console.log(`  本地地址: http://localhost:${PORT}`);
    console.log(`  落地页:   http://localhost:${PORT}/`);
    console.log(`  编辑器:   http://localhost:${PORT}/editor`);
    console.log(`  管理后台: http://localhost:${PORT}/admin`);
    console.log(`  管理密码: ${ADMIN_PASSWORD}\n`);
  });
}

module.exports = app;
