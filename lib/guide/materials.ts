// @ts-nocheck
// These groups describe the catalog's main material, not undocumented frames or legs.
const GROUPS = { '木质': ['橡木', '松木', '胡桃木', '板材'], '实木': ['橡木', '松木', '胡桃木'] };
const ALIASES = { '木头': '木质', '木制': '木质', '木材': '木质', '木料': '木质', '实木材质': '实木', '皮革': '皮质', '皮料': '皮质', '皮面': '皮质', '皮的': '皮质', '布料': '布艺', '布面': '布艺', '布的': '布艺' };
export const MATERIAL_TERMS = [...new Set([...Object.keys(ALIASES), ...Object.keys(GROUPS), '皮质', '布艺', '橡木', '松木', '板材', '胡桃木', '岩板'])].sort((a,b)=>b.length-a.length);
export function canonicalMaterial(value) { return ALIASES[value] || value; }
export function knownMaterial(value) { return MATERIAL_TERMS.includes(value); }
export function materialMatches(actual, requested) { return (GROUPS[canonicalMaterial(requested)] || [canonicalMaterial(requested)]).includes(actual); }
export function materialMentions(text) {
  const pattern = new RegExp(MATERIAL_TERMS.join('|'), 'g');
  return [...String(text).matchAll(pattern)].filter(m => !/^(色|颜色|风)/.test(text.slice(m.index+m[0].length))).map(m=>({raw:m[0], value:canonicalMaterial(m[0]), index:m.index}));
}
export function parseMaterialDemand(text) {
  if (/皮质也可以|可以皮质|材质不限|排除不限|不限材质|不限排除/.test(text)) return {clear:true};
  const excludes = [], includes = [];
  const mentions = materialMentions(text);
  if (mentions.length && /不是不要|并非不要|并不是不|不能不/.test(text)) return {ambiguous: mentions.map(m=>m.value)};
  if (mentions.length > 1 && /或者|或|都可以|均可|都行/.test(text)) return {ambiguous: mentions.map(m=>m.value)};
  for (const part of String(text).split(/[、，,。；;\n]/)) {
    for (const mention of materialMentions(part)) {
      const prefix = part.slice(0,mention.index);
      if (/(?:去掉|取消)(?:不要|排除)?$|不要排除$/.test(prefix)) return {clear:true};
      const markers = [...prefix.matchAll(/不要|排除|不选|不考虑|拒绝|非|想要|要|选择|选/g)];
      const last = markers[markers.length-1]?.[0] || '';
      const list = ['不要','排除','不选','不考虑','拒绝','非'].includes(last) ? excludes : includes;
      if (!list.includes(mention.value)) list.push(mention.value);
    }
  }
  // Multiple independent exclusions retain the existing clarification contract.
  if (excludes.length > 1) return {ambiguous:excludes};
  return excludes.length || includes.length ? { ...(excludes.length ? {value:excludes[0]} : {}), ...(includes.length ? {include:includes[includes.length-1]} : {}) } : null;
}
