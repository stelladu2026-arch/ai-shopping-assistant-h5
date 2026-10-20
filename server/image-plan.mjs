export const MARKETING_IMAGE_SHOTS = [
  {name:'使用场景全景', description:'在符合商品品类的家居使用场景中展示完整商品，只有一个商品主体。'},
  {name:'材质纹理细节', description:'近景展示资料所述材质的表面纹理与颜色，不虚构未提供的材质或性能。'},
  {name:'外观造型细节', description:'聚焦商品可见外观的线条和轮廓，保持与全景图相同的造型。'},
  {name:'结构视角细节', description:'换一个近景视角展示可见结构，不虚构内部结构、五金、功能或卖点。'},
];
export function normalizeImageCount(value, fallback = 1) {
  return value === 4 ? 4 : value === 1 ? 1 : fallback;
}
export function imageShotPrompt(count) {
  if (count !== 4) return '';
  return '请按顺序生成4张独立图片，不要把4个视角拼在同一张图里。'
    + MARKETING_IMAGE_SHOTS.map((shot,index)=>`第${index+1}张：${shot.name}，${shot.description}`).join('')
    + '4张必须围绕同一件商品，颜色、材质、造型和风格一致。每张只有一个产品主体，不重复复制商品，不加Logo、水印、促销文字或未经提供的认证承诺。';
}
