import fs from 'node:fs';
import {models} from '../dist/catalog/registry.mjs';
const base=new URL('../dist/',import.meta.url),escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const old=[['两级斜齿减速器','lab.html','两级斜齿轮与装配拆解'],['参数化汽轮机','turbine.html','汽缸、动静叶与级数参数'],['自行车链传动','bicycle.html','牙盘、链条与后轮'],['摩擦轮传动','friction.html','轮径、压紧与摩擦容量'],['单级直齿圆柱齿轮','spur.html','齿数、模数与速比'],['带惰轮齿轮列','idler.html','惰轮、转向与传动比'],['交叉平带传动','belt.html','交叉带与开口带对照'],['同步带传动','timing.html','带齿、轮槽与闭合关系'],['台虎钳·丝杠螺母','vice.html','导程、开口与端点停机'],
  ['曲柄滑块 · 活塞运动','slider-crank.html','调节曲柄半径，拖动曲柄，观察活塞行程、止点和位移曲线。'],
  ['汽车开放式差速器','open-differential.html','切换直行与转弯，比较左右半轴转速，观察差速齿轮运动。'],
  ['电钻两挡行星减速器','drill-planetary.html','切换高低挡，跟踪两级行星传动的动力路径和夹头转速。'],
  ['蜗轮蜗杆传动','worm-drive.html','调整蜗杆头数和蜗轮齿数，用蜗杆一圈验证蜗轮推进的齿数。'],
].map(([title,url,description])=>({title,url,description,number:null}));
const additions=models.map(m=>({id:m.id,number:m.number,title:m.title,description:m.description,url:'catalog.html?model='+encodeURIComponent(m.id)})),items=[...old,...additions];
fs.writeFileSync(new URL('catalog/models.json',base),JSON.stringify({count:items.length,source:'https://www.kdocs.cn/l/cnXEgCQ0UECb',blankRows:additions.map(m=>m.number+4),items},null,2)+'\n');
const categories = JSON.parse(fs.readFileSync(new URL('homepage-categories.json', import.meta.url), 'utf8'));
const labels = {
  all: '全部', gears: '齿轮与减变速', flex: '带链与摩擦传动', joints: '轴连接与离合',
  motion: '直线与往复机构', systems: '动力与装备系统', other: '其他结构'
};
const counts = {all:items.length};
const entries = [...items].sort((a,b) => a.title.localeCompare(b.title,'zh-CN')).map(item => {
  const id = item.id || item.url.replace(/\.html$/, '');
  const {group,aliases} = categories[id] || {group:'other',aliases:''};
  counts[group] = (counts[group] || 0) + 1;
  const terms = [id, aliases].filter(Boolean).join(' ');
  return `<a class="result" data-group="${escape(group)}" data-terms="${escape(terms)}" href="${escape(item.url)}"><small>${escape(labels[group])}</small><h3>${escape(item.title)}</h3><p>${escape(item.description)}</p></a>`;
});
const buttons = Object.entries(labels).filter(([group]) => counts[group]).map(([group,label]) =>
  `<button type="button" data-filter="${group}" aria-pressed="${group === 'all'}">${label}<span>${counts[group]}</span></button>`
);
const path = new URL('index.html', base);
let html = fs.readFileSync(path, 'utf8');
function replaceBlock(name, lines) {
  const start = '<!-- catalog:' + name + ' -->', end = '<!-- /catalog:' + name + ' -->';
  const first = html.indexOf(start), last = html.indexOf(end);
  if (first < 0 || last < first) throw new Error('Missing homepage catalog block: ' + name);
  html = html.slice(0, first + start.length) + '\n            ' +
    lines.join('\n            ') + '\n          ' + html.slice(last);
}
replaceBlock('filters', buttons);
replaceBlock('results', entries);
html = html.replace(/(id="match-count" role="status" aria-live="polite">)共 \d+ 个实验/, '$1共 ' + items.length + ' 个实验');
fs.writeFileSync(path, html);
for(const name of fs.readdirSync(base).filter(n=>n.endsWith('.html'))){const file=new URL(name,base),s=fs.readFileSync(file,'utf8');fs.writeFileSync(file,s.replace(/chat\.js\?v=[^"']+/g,'chat.js?v=20261116-all1'));}
console.log(`Generated ${items.length} direct experiment links (${models.length} new)`);
