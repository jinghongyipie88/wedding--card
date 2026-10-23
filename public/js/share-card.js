/* ═══════════════════════════════════════════════════════════════
   分享封面图生成器
   根据邀请函数据和主题，用Canvas绘制750x1334的微信分享图
   支持真实二维码（需要 qrcode.min.js 提供 QRCode）
   ═══════════════════════════════════════════════════════════════ */

const THEMES = {
  champagne: {
    bg1: '#FAF6F0', bg2: '#F0E8DA',
    text: '#3D3530', sub: '#6B5F55', dim: '#9A8E82',
    accent: '#C9A96E', accent2: '#D4A5A5',
    card: 'rgba(255,255,255,0.75)',
    border: 'rgba(201,169,110,0.5)'
  },
  chinese: {
    bg1: '#FFF8F0', bg2: '#FDE8D8',
    text: '#3A1A1A', sub: '#7A4040', dim: '#A87070',
    accent: '#C41E3A', accent2: '#D4A040',
    card: 'rgba(255,248,240,0.85)',
    border: 'rgba(196,30,58,0.4)'
  },
  white: {
    bg1: '#FFFFFF', bg2: '#F4F4F6',
    text: '#2C2C2E', sub: '#636366', dim: '#AEAEB2',
    accent: '#8E8E93', accent2: '#C7C7CC',
    card: 'rgba(255,255,255,0.9)',
    border: 'rgba(142,142,147,0.35)'
  },
  forest: {
    bg1: '#F5F7F2', bg2: '#E6EDE0',
    text: '#2D3A2A', sub: '#5A6B55', dim: '#8A9A85',
    accent: '#5B7553', accent2: '#A8C09A',
    card: 'rgba(255,255,255,0.75)',
    border: 'rgba(91,117,83,0.45)'
  },
  vintage: {
    bg1: '#F7F1E8', bg2: '#EDE0CC',
    text: '#3A2E22', sub: '#6B5A48', dim: '#9A8870',
    accent: '#A0724A', accent2: '#D4B896',
    card: 'rgba(255,250,242,0.8)',
    border: 'rgba(160,114,74,0.45)'
  }
};

/**
 * 生成分享封面图
 * @param {Object} data - {groom, bride, date, location, theme, link}
 * @param {Function} callback - 回调(dataUrl)
 */
function generateShareCard(data, callback) {
  const theme = THEMES[data.theme] || THEMES.champagne;
  const canvas = document.createElement('canvas');
  canvas.width = 750;
  canvas.height = 1334;
  const ctx = canvas.getContext('2d');

  // 1. 背景渐变
  const grad = ctx.createLinearGradient(0, 0, 0, 1334);
  grad.addColorStop(0, theme.bg1);
  grad.addColorStop(1, theme.bg2);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 750, 1334);

  // 2. 装饰性光斑
  drawGlow(ctx, 150, 200, 200, theme.accent2, 0.15);
  drawGlow(ctx, 600, 1100, 250, theme.accent, 0.1);

  // 3. 外边框
  ctx.strokeStyle = theme.border;
  ctx.lineWidth = 2;
  ctx.strokeRect(40, 40, 670, 1254);

  // 内边框
  ctx.strokeStyle = theme.border;
  ctx.lineWidth = 1;
  ctx.strokeRect(52, 52, 646, 1230);

  // 4. 顶部装饰
  drawTopOrnament(ctx, 375, 120, theme);

  // 5. WEDDING INVITATION
  ctx.fillStyle = theme.accent;
  ctx.font = '600 22px "PingFang SC", "Microsoft YaHei", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  drawLetterSpaced(ctx, 'WEDDING INVITATION', 375, 180, 8);

  // 6. 装饰线
  drawDivider(ctx, 375, 230, 120, theme.accent);

  // 7. 新人姓名（动态居中排版，避免长名重叠）
  const groom = data.groom || '新郎';
  const bride = data.bride || '新娘';
  const nameSize = (groom.length > 3 || bride.length > 3) ? 48 : 64;
  ctx.font = `700 ${nameSize}px "KaiTi", "STKaiti", "PingFang SC", serif`;
  const groomW = ctx.measureText(groom).width;
  const brideW = ctx.measureText(bride).width;
  ctx.font = '500 40px "KaiTi", "STKaiti", serif';
  const ampW = ctx.measureText('&').width;
  const gap = nameSize * 0.6;
  const total = groomW + brideW + ampW + gap * 2;
  let curX = (750 - total) / 2;

  // 新郎
  ctx.fillStyle = theme.text;
  ctx.font = `700 ${nameSize}px "KaiTi", "STKaiti", "PingFang SC", serif`;
  ctx.textAlign = 'center';
  ctx.fillText(groom, curX + groomW / 2, 340);
  curX += groomW + gap;

  // & 符号
  ctx.fillStyle = theme.accent;
  ctx.font = '500 40px "KaiTi", "STKaiti", serif';
  ctx.fillText('&', curX + ampW / 2, 340);
  curX += ampW + gap;

  // 新娘
  ctx.fillStyle = theme.text;
  ctx.font = `700 ${nameSize}px "KaiTi", "STKaiti", "PingFang SC", serif`;
  ctx.fillText(bride, curX + brideW / 2, 340);

  // 8. 我们结婚啦
  ctx.fillStyle = theme.sub;
  ctx.font = '400 28px "PingFang SC", "Microsoft YaHei", sans-serif';
  ctx.fillText('我 们 结 婚 啦', 375, 420);

  // 9. 日期区域（卡片）
  const date = new Date(data.date);
  const months = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
  const weekDays = ['星期日','星期一','星期二','星期三','星期四','星期五','星期六'];
  const day = String(date.getDate()).padStart(2, '0');
  const month = months[date.getMonth()];
  const year = date.getFullYear();
  const time = `${String(date.getHours()).padStart(2,'0')}:${String(date.getMinutes()).padStart(2,'0')}`;
  const weekDay = weekDays[date.getDay()];

  // 日期卡片背景
  roundRect(ctx, 175, 490, 400, 280, 12);
  ctx.fillStyle = theme.card;
  ctx.fill();
  ctx.strokeStyle = theme.border;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // 日期大数字
  ctx.fillStyle = theme.accent;
  ctx.font = '800 120px "Georgia", serif';
  ctx.textAlign = 'center';
  ctx.fillText(day, 300, 610);

  // 月份年份
  ctx.fillStyle = theme.sub;
  ctx.font = '600 28px "Georgia", serif';
  ctx.textAlign = 'left';
  ctx.fillText(month, 400, 580);
  ctx.font = '500 24px "Georgia", serif';
  ctx.fillText(year, 400, 620);

  // 星期和时间
  ctx.fillStyle = theme.dim;
  ctx.font = '400 20px "PingFang SC", sans-serif';
  ctx.fillText(weekDay, 400, 660);
  ctx.fillText(time, 400, 695);

  // 10. 地点
  ctx.fillStyle = theme.sub;
  ctx.font = '500 22px "PingFang SC", "Microsoft YaHei", sans-serif';
  ctx.textAlign = 'center';
  const locLines = wrapText(ctx, data.location, 560, 2);
  locLines.forEach((line, i) => {
    ctx.fillText(line, 375, 840 + i * 36);
  });

  // 地点图标（简化为定位标记）
  ctx.fillStyle = theme.accent;
  ctx.font = '24px sans-serif';
  ctx.fillText('📍', 375, 800);

  // 11. 底部装饰
  drawDivider(ctx, 375, 960, 200, theme.accent);

  // 12. 底部提示
  ctx.fillStyle = theme.dim;
  ctx.font = '400 20px "PingFang SC", "Microsoft YaHei", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('长按识别二维码 · 查看完整邀请函', 375, 1020);

  // 二维码区域
  const qrCenter = 1140;
  const qrSize = 120;

  // 13. 底部小字
  ctx.fillStyle = theme.dim;
  ctx.font = '400 16px "PingFang SC", sans-serif';
  ctx.globalAlpha = 0.6;
  ctx.fillText('Wedding Invitation', 375, 1260);
  ctx.globalAlpha = 1;

  // 14. 花瓣装饰（香槟金/森系/复古主题）
  if (data.theme === 'champagne' || data.theme === 'forest' || data.theme === 'vintage') {
    drawPetals(ctx, theme);
  }

  // 15. 中式主题加双喜
  if (data.theme === 'chinese') {
    ctx.fillStyle = theme.accent;
    ctx.globalAlpha = 0.08;
    ctx.font = '800 200px "KaiTi", "STKaiti", serif';
    ctx.textAlign = 'center';
    ctx.fillText('囍', 375, 700);
    ctx.globalAlpha = 1;
  }

  // 完成回调（二维码异步加载后调用）
  const finish = () => {
    if (typeof callback === 'function') {
      callback(canvas.toDataURL('image/jpeg', 0.92));
    }
  };

  // 有链接且二维码库可用 → 绘制真实二维码
  if (data.link && typeof QRCode !== 'undefined') {
    const qrDataUrl = generateQRDataUrl(data.link, 240);
    if (qrDataUrl) {
      const img = new Image();
      img.onload = () => {
        // 白底保证扫描率
        ctx.fillStyle = '#FFFFFF';
        roundRect(ctx, 375 - qrSize - 10, qrCenter - qrSize - 10, qrSize * 2 + 20, qrSize * 2 + 20, 10);
        ctx.fill();
        ctx.drawImage(img, 375 - qrSize, qrCenter - qrSize, qrSize * 2, qrSize * 2);
        finish();
      };
      img.onerror = () => {
        drawQRPlaceholder(ctx, 375, qrCenter, qrSize, theme);
        finish();
      };
      img.src = qrDataUrl;
      return;
    }
  }

  // 无链接或库不可用 → 绘制占位二维码
  drawQRPlaceholder(ctx, 375, qrCenter, qrSize, theme);
  finish();
}

// ── 用 qrcodejs 生成二维码 dataURL ──
function generateQRDataUrl(text, size) {
  const holder = document.createElement('div');
  holder.style.cssText = 'position:fixed;left:-9999px;top:-9999px;width:0;height:0;overflow:hidden;';
  document.body.appendChild(holder);
  try {
    const qr = new QRCode(holder, {
      width: size,
      height: size,
      colorDark: '#1A1A1A',
      colorLight: '#FFFFFF',
      correctLevel: QRCode.CorrectLevel.M
    });
    qr.makeCode(text);
    const cv = holder.querySelector('canvas');
    return cv ? cv.toDataURL('image/png') : null;
  } catch (e) {
    return null;
  } finally {
    holder.remove();
  }
}

// ── 辅助函数 ──
function drawGlow(ctx, x, y, r, color, alpha) {
  const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
  grad.addColorStop(0, color);
  grad.addColorStop(1, 'transparent');
  ctx.globalAlpha = alpha;
  ctx.fillStyle = grad;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
  ctx.globalAlpha = 1;
}

function drawTopOrnament(ctx, x, y, theme) {
  ctx.strokeStyle = theme.accent;
  ctx.lineWidth = 1.5;
  // 中间菱形
  ctx.beginPath();
  ctx.moveTo(x, y - 8);
  ctx.lineTo(x + 8, y);
  ctx.lineTo(x, y + 8);
  ctx.lineTo(x - 8, y);
  ctx.closePath();
  ctx.stroke();
  // 两侧线条
  ctx.beginPath();
  ctx.moveTo(x - 60, y);
  ctx.lineTo(x - 16, y);
  ctx.moveTo(x + 16, y);
  ctx.lineTo(x + 60, y);
  ctx.stroke();
  // 两侧小圆点
  ctx.fillStyle = theme.accent;
  ctx.beginPath();
  ctx.arc(x - 70, y, 3, 0, Math.PI * 2);
  ctx.arc(x + 70, y, 3, 0, Math.PI * 2);
  ctx.fill();
}

function drawDivider(ctx, x, y, width, color) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x - width / 2, y);
  ctx.lineTo(x + width / 2, y);
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, 3, 0, Math.PI * 2);
  ctx.fill();
}

function drawLetterSpaced(ctx, text, x, y, spacing) {
  const chars = text.split('');
  const totalWidth = chars.length * spacing + chars.reduce((w, c) => w + ctx.measureText(c).width, 0);
  let curX = x - totalWidth / 2;
  chars.forEach(c => {
    const w = ctx.measureText(c).width;
    ctx.fillText(c, curX + w / 2, y);
    curX += w + spacing;
  });
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function wrapText(ctx, text, maxWidth, maxLines) {
  const lines = [];
  let line = '';
  for (let i = 0; i < text.length; i++) {
    const test = line + text[i];
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = text[i];
      if (lines.length >= maxLines - 1) {
        const rest = text.slice(i);
        lines.push(rest.length > 20 ? rest.slice(0, 20) + '...' : rest);
        return lines;
      }
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function drawQRPlaceholder(ctx, x, y, size, theme) {
  const s = size / 2;
  // 外框
  ctx.strokeStyle = theme.accent;
  ctx.lineWidth = 2;
  roundRect(ctx, x - s, y - s, size, size, 8);
  ctx.stroke();
  // 内部图案（模拟二维码）
  ctx.fillStyle = theme.text;
  const cell = size / 12;
  const pattern = [
    [1,1,1,1,1,1,1,0,1,0,1,0],
    [1,0,0,0,0,0,1,0,0,1,0,1],
    [1,0,1,1,1,0,1,0,1,0,1,0],
    [1,0,1,1,1,0,1,0,0,1,0,1],
    [1,0,0,0,0,0,1,0,1,0,1,0],
    [1,1,1,1,1,1,1,0,0,1,0,1],
    [0,0,0,0,0,0,0,0,1,0,1,0],
    [1,0,1,0,1,0,1,0,0,1,0,1],
    [0,1,0,1,0,1,0,1,1,0,1,0],
    [1,0,1,0,1,0,1,0,0,1,0,1],
    [0,1,0,1,0,1,0,1,1,0,1,0],
    [1,0,1,0,1,0,1,0,0,1,0,1]
  ];
  for (let row = 0; row < 12; row++) {
    for (let col = 0; col < 12; col++) {
      if (pattern[row][col]) {
        ctx.fillRect(x - s + col * cell + 4, y - s + row * cell + 4, cell - 1, cell - 1);
      }
    }
  }
  // 中心logo
  ctx.fillStyle = theme.bg1;
  ctx.fillRect(x - 12, y - 12, 24, 24);
  ctx.fillStyle = theme.accent;
  ctx.font = '700 16px "KaiTi", serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('囍', x, y);
}

function drawPetals(ctx, theme) {
  const petals = [
    {x: 100, y: 300, r: 12, rot: 30},
    {x: 650, y: 400, r: 10, rot: -20},
    {x: 80, y: 900, r: 14, rot: 45},
    {x: 670, y: 850, r: 11, rot: -35},
    {x: 120, y: 1150, r: 9, rot: 60},
    {x: 640, y: 1200, r: 13, rot: -15}
  ];
  petals.forEach(p => {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot * Math.PI / 180);
    ctx.fillStyle = theme.accent2;
    ctx.globalAlpha = 0.4;
    ctx.beginPath();
    ctx.ellipse(0, 0, p.r, p.r * 0.6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });
  ctx.globalAlpha = 1;
}

// 导出到全局
window.generateShareCard = generateShareCard;
