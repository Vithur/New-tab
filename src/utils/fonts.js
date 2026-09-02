export const CN_FONTS = [
  { name: "Gilroy", css: "Gilroy", desc: "默认拉丁字体，中文回落系统黑体", cat: "黑体" },
  { name: "微软雅黑", css: "Microsoft YaHei", desc: "屏幕显示最均衡的现代黑体，日常首选", cat: "黑体" },
  { name: "微软雅黑 Light", css: "Microsoft YaHei Light", desc: "雅黑的细字重版本，清爽轻盈", cat: "黑体" },
  { name: "等线", css: "DengXian", desc: "Office 默认中文字体，笔画干净利落", cat: "黑体" },
  { name: "思源黑体", css: "Noto Sans SC", desc: "Adobe 与 Google 联合开发的开源黑体", cat: "黑体" },
  { name: "黑体", css: "SimHei", desc: "老牌无衬线黑体，笔画粗壮醒目", cat: "黑体" },
  { name: "苹方", css: "PingFang SC", desc: "Apple 系统中文字体，简洁现代", cat: "黑体" },
  { name: "鸿蒙字体", css: "HarmonyOS Sans SC", desc: "华为鸿蒙系统字体，清晰易读", cat: "黑体" },
  { name: "小米字体", css: "MiSans", desc: "小米定制字体，圆润柔和", cat: "黑体" },
  { name: "得意黑", css: "Smiley Sans", desc: "开源窄斜体，兼具几何感与人文气息", cat: "创意" },
];

export const CN_FONT_NAMES = CN_FONTS.map((f) => f.name);

export const cnFontStack = (name) => {
  const f = CN_FONTS.find((x) => x.name === name);
  const fam = f ? f.css : name;
  return `"Gilroy", "${fam}", sans-serif`;
};
