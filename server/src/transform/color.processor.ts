import { Injectable, Logger } from '@nestjs/common';
// sharp 是 CJS 模块，使用 require 避免 ESM 互操作问题
// eslint-disable-next-line @typescript-eslint/no-var-requires
const sharp = require('sharp');

/**
 * 颜色后处理服务
 * AI 图生图对"暗朱红/西泠印社朱标"色调控制不准，
 * 在服务端用 sharp 做像素级颜色重映射，把"鲜红"统一调整为"暗朱红"。
 */
@Injectable()
export class ColorProcessor {
  private readonly logger = new Logger(ColorProcessor.name);

  /**
   * 把图中的红色像素重映射为"西泠印社朱标"印泥的暗朱红。
   * - 目标主色：hex #A93226 = rgb(169, 50, 38)
   * - 检测规则：R > 80 且 R - max(G, B) >= 20（避免误伤米白/灰色像素）
   * - 越纯的红，混合比例越高
   * - 完全不影响白字/米白色/灰色像素
   */
  async adjustRedToDarkCinnabar(input: Buffer): Promise<Buffer> {
    const { data, info } = await sharp(input)
      .raw()
      .toBuffer({ resolveWithObject: true });

    const channels = info.channels;
    const targetR = 169; // #A9
    const targetG = 50;  // #32
    const targetB = 38;  // #26

    let touched = 0;
    for (let i = 0; i < data.length; i += channels) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      // 检测"红色"像素
      const rDiff = r - Math.max(g, b);
      if (r < 80 || rDiff < 20) continue;

      // 红度归一化到 0~1（rDiff=20 → 0，rDiff=200+ → 1）
      const t = Math.min(1, Math.max(0, (rDiff - 20) / 180));

      // 混合系数：纯度越高，混合比例越大（0.45 ~ 0.85）
      const mix = 0.45 + 0.4 * t;

      const newR = Math.round(r * (1 - mix) + targetR * mix);
      const newG = Math.round(g * (1 - mix) + targetG * mix);
      const newB = Math.round(b * (1 - mix) + targetB * mix);

      data[i] = Math.max(0, Math.min(255, newR));
      data[i + 1] = Math.max(0, Math.min(255, newG));
      data[i + 2] = Math.max(0, Math.min(255, newB));
      touched++;
    }

    this.logger.log(
      `ColorProcessor: 调整 ${touched} 个红色像素（共 ${Math.floor(data.length / channels)} 个，目标 #A93226）`,
    );

    return sharp(data, {
      raw: { width: info.width, height: info.height, channels },
    })
      .png()
      .toBuffer();
  }
}
