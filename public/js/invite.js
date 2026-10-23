/* ═══════════════════════════════════════════════════════════════
   婚礼邀请函 - 前端交互逻辑
   从后端API获取数据，渲染多主题，回执和祝福提交到后端
   ═══════════════════════════════════════════════════════════════ */
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];

let inviteData = null;
let blessings = [];

/* ── 从URL获取邀请函ID ── */
function getInviteId() {
  const path = window.location.pathname;
  const match = path.match(/\/invite\/([a-zA-Z0-9]+)/);
  return match ? match[1] : null;
}

/* ── 加载邀请函数据 ── */
async function loadInvite() {
  const id = getInviteId();
  if (!id) {
    $('#loading').innerHTML = '<p style="color:var(--ink)">邀请函不存在或链接无效</p>';
    return;
  }
  try {
    const res = await fetch(`/api/invites/${id}`);
    if (!res.ok) throw new Error('加载失败');
    inviteData = await res.json();
    renderInvite();
    $('#loading').style.display = 'none';
  } catch (e) {
    $('#loading').innerHTML = '<p style="color:var(--ink)">邀请函加载失败，请稍后重试</p>';
  }
}

/* ── 渲染邀请函 ── */
function renderInvite() {
  const d = inviteData;
  // 主题：默认取邀请函主题；URL 带 ?theme= 时用于预览（仅影响展示，不改数据）
  const validThemes = ['champagne','chinese','white','forest','vintage'];
  const urlTheme = new URLSearchParams(window.location.search).get('theme');
  const theme = validThemes.includes(urlTheme) ? urlTheme : (d.theme || 'champagne');
  $('#themeCss').href = `/css/theme-${theme}.css`;

  // 标题和OG
  document.title = `我们结婚啦 | ${d.groom} & ${d.bride}的婚礼邀请`;
  document.querySelector('meta[property="og:title"]').content = `我们结婚啦 | ${d.groom} & ${d.bride}的婚礼邀请`;
  document.querySelector('meta[property="og:description"]').content = `${formatDate(d.date)}，诚邀您见证我们的幸福时刻`;

  // 姓名
  $('#groomName').textContent = d.groom;
  $('#brideName').textContent = d.bride;
  $('#endGroom').textContent = d.groom;
  $('#endBride').textContent = d.bride;

  // 日期
  const date = new Date(d.date);
  const months = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
  $('#coverDay').textContent = String(date.getDate()).padStart(2,'0');
  $('#coverMonth').textContent = months[date.getMonth()];
  $('#coverYear').textContent = date.getFullYear();
  $('#ceremonyTime').textContent = `${String(date.getHours()).padStart(2,'0')}:${String(date.getMinutes()).padStart(2,'0')}`;
  $('#flowCeremony').textContent = `${String(date.getHours()).padStart(2,'0')}:${String(date.getMinutes()).padStart(2,'0')}`;
  const weekDays = ['星期日','星期一','星期二','星期三','星期四','星期五','星期六'];
  $('#endDate').textContent = `${date.getFullYear()}年${date.getMonth()+1}月${date.getDate()}日 ${weekDays[date.getDay()]} ${String(date.getHours()).padStart(2,'0')}:${String(date.getMinutes()).padStart(2,'0')}`;

  // 地点
  $('#coverLoc').textContent = d.location;
  $('#infoLoc').textContent = d.location;
  $('#endLoc').textContent = d.location;

  // 自定义封面图
  if (d.coverImage) {
    document.documentElement.style.setProperty('--cover-bg', `url(${d.coverImage})`);
  }

  // 故事时间线
  renderStory(d.story || []);

  // 相册
  renderAlbum(d.photos || []);

  // 倒计时
  updateCountdown();
  setInterval(updateCountdown, 1000);

  // 花瓣
  createPetals();

  // 导航点
  initDotNav();

  // 状态栏时间
  updateSbTime();
  setInterval(updateSbTime, 30000);

  // 绑定事件
  bindEvents();

  // 检测是否从编辑器预览进入，显示返回编辑按钮
  const params = new URLSearchParams(window.location.search);
  if (params.get('from') === 'editor') {
    $('#backEditBtn').classList.add('show');
  }
}

/* ── 渲染故事时间线 ── */
function renderStory(story) {
  const defaultStory = [
    {date:'2020 · 夏', title:'初到深圳', desc:'两人刚毕业，怀揣梦想来到这座城市'},
    {date:'2021 · 春', title:'初次相遇', desc:'一次偶然的聚会，目光交汇的瞬间'},
    {date:'2021 · 夏', title:'确定关系', desc:'牵手漫步在深圳湾的晚风里'},
    {date:'2025 · 冬', title:'求婚成功', desc:'在初雪的夜晚，你说"我愿意"'},
    {date:'2026 · 秋', title:'步入婚姻', desc:'从此，一屋两人，三餐四季'}
  ];
  const list = story.length ? story : defaultStory;
  $('#timeline').innerHTML = list.map(item => `
    <div class="tl-item">
      <div class="tl-dot"></div>
      <div class="tl-content">
        <div class="tl-date">${item.date || ''}</div>
        <div class="tl-text"><span class="hand">${item.title || ''}</span><br>${item.desc || ''}</div>
      </div>
    </div>
  `).join('');
}

/* ── 渲染相册 ── */
function renderAlbum(photos) {
  const grid = $('#albumGrid');
  let html = '';
  for (let i = 0; i < 4; i++) {
    if (photos[i]) {
      html += `<div class="album-item" data-idx="${i}"><img src="${photos[i]}" alt="相册${i+1}"></div>`;
    } else {
      html += `<div class="album-item" data-idx="${i}"><span class="ph">♥</span></div>`;
    }
  }
  grid.innerHTML = html;
  // Lightbox绑定
  grid.querySelectorAll('.album-item').forEach(item => {
    item.onclick = () => {
      const idx = +item.dataset.idx;
      if (photos[idx]) {
        lbIdx = idx;
        showLightbox(photos);
      }
    };
  });
}

/* ── Lightbox ── */
let lbIdx = 0;
let lbPhotos = [];
function showLightbox(photos) {
  lbPhotos = photos;
  $('#lbImg').src = photos[lbIdx];
  $('#lightbox').classList.add('show');
}
$('#lbClose').onclick = () => $('#lightbox').classList.remove('show');
$('#lbPrev').onclick = () => { lbIdx = (lbIdx - 1 + lbPhotos.length) % lbPhotos.length; $('#lbImg').src = lbPhotos[lbIdx]; };
$('#lbNext').onclick = () => { lbIdx = (lbIdx + 1) % lbPhotos.length; $('#lbImg').src = lbPhotos[lbIdx]; };
$('#lightbox').onclick = e => { if (e.target.id === 'lightbox') $('#lightbox').classList.remove('show'); };

/* ── 倒计时 ── */
function updateCountdown() {
  if (!inviteData) return;
  const target = new Date(inviteData.date).getTime();
  const diff = target - Date.now();
  if (diff <= 0) {
    $('#cdDays').textContent = '00';
    $('#cdHours').textContent = '00';
    $('#cdMins').textContent = '00';
    $('#cdSecs').textContent = '00';
    return;
  }
  $('#cdDays').textContent = String(Math.floor(diff / 86400000)).padStart(2,'0');
  $('#cdHours').textContent = String(Math.floor((diff % 86400000) / 3600000)).padStart(2,'0');
  $('#cdMins').textContent = String(Math.floor((diff % 3600000) / 60000)).padStart(2,'0');
  $('#cdSecs').textContent = String(Math.floor((diff % 60000) / 1000)).padStart(2,'0');
}

/* ── 花瓣 ── */
function createPetals() {
  const container = $('#petals');
  for (let i = 0; i < 12; i++) {
    const p = document.createElement('div');
    p.className = 'petal';
    p.style.left = Math.random() * 100 + '%';
    p.style.animationDuration = (6 + Math.random() * 8) + 's';
    p.style.animationDelay = (Math.random() * 8) + 's';
    p.style.width = (8 + Math.random() * 10) + 'px';
    p.style.height = p.style.width;
    container.appendChild(p);
  }
}

/* ── 分屏导航 ── */
const deck = $('#deck');
const screens = $$('.screen');
function initDotNav() {
  const dotNav = $('#dotNav');
  screens.forEach((_, i) => {
    const btn = document.createElement('button');
    btn.setAttribute('aria-label', `第${i+1}屏`);
    btn.onclick = () => go(i);
    dotNav.appendChild(btn);
  });
  const dotBtns = [...dotNav.children];
  const io = new IntersectionObserver(es => es.forEach(e => {
    if (e.intersectionRatio > 0.55) {
      e.target.classList.add('live');
      const idx = screens.indexOf(e.target);
      dotBtns.forEach((b, k) => b.classList.toggle('on', k === idx));
    }
  }), { root: deck, threshold: [0.55] });
  screens.forEach(s => io.observe(s));
}
function go(i) {
  screens[Math.max(0, Math.min(screens.length - 1, i))].scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/* ── Toast ── */
let toastT;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('on');
  clearTimeout(toastT);
  toastT = setTimeout(() => t.classList.remove('on'), 2000);
}

/* ── 状态栏时间 ── */
function updateSbTime() {
  const now = new Date();
  $('#sbTime').textContent = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
}

/* ── 格式化日期 ── */
function formatDate(dateStr) {
  const d = new Date(dateStr);
  return `${d.getFullYear()}年${d.getMonth()+1}月${d.getDate()}日`;
}

/* ── 绑定事件 ── */
function bindEvents() {
  // 一键导航
  $('#navBtn').onclick = () => {
    const addr = encodeURIComponent(inviteData.location);
    const ua = navigator.userAgent;
    if (/MicroMessenger/i.test(ua)) {
      window.open(`https://apis.map.qq.com/uri/v1/search?keyword=${addr}`, '_blank');
    } else if (/iPhone|iPad/i.test(ua)) {
      window.open(`https://maps.apple.com/?q=${addr}`, '_blank');
    } else {
      window.open(`https://uri.amap.com/search?keyword=${addr}`, '_blank');
    }
    toast('正在打开地图导航...');
  };

  // 回执提交
  $('#rsvpSubmit').onclick = async () => {
    const name = $('#rsvpName').value.trim();
    const count = $('#rsvpCount').value;
    const phone = $('#rsvpPhone').value.trim();
    const message = $('#rsvpMsg').value.trim();
    if (!name) { toast('请输入您的姓名'); return; }
    if (!count || count < 1) { toast('请输入出席人数'); return; }
    if (!phone || !/^1\d{10}$/.test(phone)) { toast('请输入正确的手机号'); return; }
    try {
      const res = await fetch(`/api/invites/${inviteData.id}/rsvp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, count, phone, message })
      });
      if (!res.ok) throw new Error();
      $('#rsvpForm').style.display = 'none';
      $('#rsvpSuccess').classList.add('show');
      toast('回执提交成功，感谢您的祝福！');
      // 祝福语自动加到祝福墙
      if (message) {
        blessings.unshift({ name, text: message, time: new Date().toISOString().slice(0,10) });
        renderBlessings();
      }
    } catch (e) {
      toast('提交失败，请稍后重试');
    }
  };

  // 祝福墙
  $('#blessingSend').onclick = async () => {
    const input = $('#blessingInput');
    const text = input.value.trim();
    if (!text) { toast('请输入祝福内容'); return; }
    blessings.unshift({ name: '匿名好友', text, time: new Date().toISOString().slice(0,10) });
    renderBlessings();
    input.value = '';
    toast('祝福已发送 ♥');
  };
  $('#blessingInput').addEventListener('keydown', e => {
    if (e.key === 'Enter') $('#blessingSend').click();
  });

  // 分享
  $('#shareBtn').onclick = () => {
    const ua = navigator.userAgent;
    if (/MicroMessenger/i.test(ua)) {
      $('#shareGuide').classList.add('show');
    } else if (navigator.share) {
      navigator.share({
        title: `我们结婚啦 | ${inviteData.groom} & ${inviteData.bride}的婚礼邀请`,
        text: `${formatDate(inviteData.date)}，诚邀您见证我们的幸福时刻`,
        url: window.location.href
      }).catch(() => {});
    } else {
      toast('请点击右上角分享给好友');
    }
  };
  $('#shareGuide').onclick = () => $('#shareGuide').classList.remove('show');

  // 回到顶部
  $('#backTop').onclick = () => go(0);

  // 生成并显示分享图
  $('#saveCardBtn').onclick = () => {
    if (!inviteData) return;
    toast('正在生成分享图...');
    setTimeout(() => {
      generateShareCard({
        groom: inviteData.groom,
        bride: inviteData.bride,
        date: inviteData.date,
        location: inviteData.location,
        theme: inviteData.theme,
        link: window.location.href
      }, dataUrl => {
        $('#shareCardImg').src = dataUrl;
        $('#shareCardModal').classList.add('show');
      });
    }, 300);
  };

  // 关闭分享图弹窗
  $('#closeCardModal').onclick = () => $('#shareCardModal').classList.remove('show');
  $('#shareCardModal').onclick = e => {
    if (e.target.id === 'shareCardModal') $('#shareCardModal').classList.remove('show');
  };

  // 下载分享图
  $('#saveCardDownload').onclick = () => {
    const img = $('#shareCardImg');
    if (!img.src) return;
    const a = document.createElement('a');
    a.href = img.src;
    a.download = `婚礼邀请函_${inviteData.groom}${inviteData.bride}.jpg`;
    a.click();
    toast('图片已保存');
  };

  // 返回编辑器：优先回到编辑链接（保留编辑码，直接进入编辑状态）
  $('#backEditBtn').onclick = () => {
    const ret = sessionStorage.getItem('editReturn');
    if (ret) {
      location.href = ret;
    } else if (window.history.length > 1) {
      window.history.back();
    } else {
      window.location.href = '/editor';
    }
  };
}

/* ── 渲染祝福墙 ── */
function renderBlessings() {
  const wall = $('#blessingWall');
  if (blessings.length === 0) {
    wall.innerHTML = '<div style="text-align:center;color:var(--ink-dim);padding:20px;font-size:13px">暂无祝福，快来留下第一条吧</div>';
    return;
  }
  wall.innerHTML = blessings.map(b => `
    <div class="blessing-item">
      <div class="b-name">${esc(b.name)}</div>
      <div class="b-text">${esc(b.text)}</div>
      <div class="b-time">${b.time || ''}</div>
    </div>
  `).join('');
}
function esc(s) { return String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }

/* ── 初始化 ── */
loadInvite();
