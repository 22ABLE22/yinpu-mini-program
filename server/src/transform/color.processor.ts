import { Injectable, Logger } from '@nestjs/common';
import { INK } from './seal.constants';
import { paperNoise, clamp255, lumaOf, isReddish } from './image-math';
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
  /**
   * 朱文印章专用：白底 + 朱砂红字。
   *
   * ComfyUI/SD 常把印章字画成黑色或灰色，旧逻辑「非红一律刷白」会把黑字抹掉。
   * 现在按亮度分类：
   *  1) 已是红色 → 锁定 #A93226
   *  2) 深色笔画（亮度低、非偏红）→ 也映射为 #A93226
   *  3) 接近白/浅底 → 米白 #FBF7F0
   */
  async adjustToZhuwenSeal(input: Buffer): Promise<Buffer> {
    const { data, info } = await sharp(input)
      .raw()
      .toBuffer({ resolveWithObject: true });

    const channels = info.channels;
    const targetR = 169; // #A9
    const targetG = 50;  // #32
    const targetB = 38;  // #26

    const bgR = 251; // #FB
    const bgG = 247; // #F7
    const bgB = 240; // #F0

    let recolored = 0;
    let darkToRed = 0;
    let keptWhite = 0;
    for (let i = 0; i < data.length; i += channels) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const luma = 0.299 * r + 0.587 * g + 0.114 * b;
      const isReddish = r > g + 20 && r > b + 20 && r > 70;

      if (isReddish) {
        data[i] = targetR;
        data[i + 1] = targetG;
        data[i + 2] = targetB;
        recolored++;
      } else if (luma < 140) {
        // 黑/深灰笔画 → 朱砂红
        data[i] = targetR;
        data[i + 1] = targetG;
        data[i + 2] = targetB;
        darkToRed++;
      } else {
        data[i] = bgR;
        data[i + 1] = bgG;
        data[i + 2] = bgB;
        keptWhite++;
      }
    }

    this.logger.log(
      `ColorProcessor[zhuwen]: 红锁定 ${recolored}, 深色→红 ${darkToRed}, 背景→米白 ${keptWhite}`,
    );

    return sharp(data, {
      raw: { width: info.width, height: info.height, channels },
    })
      .png()
      .toBuffer();
  }

  /**
   * 白文：纯包围盒（无掩膜）
   * 印区内：深→白字，浅→朱红；印区外：米白纸。
   * pad 取中等值：印文完整，又不会出现很宽的红框。
   */
  async adjustToBaiwenSeal(input: Buffer): Promise<Buffer> {
    const { data, info } = await sharp(input)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const channels = info.channels;
    const w = info.width;
    const h = info.height;
    const redR = INK.cinnabar.r;
    const redG = INK.cinnabar.g;
    const redB = INK.cinnabar.b;
    const paperR = INK.paper.r;
    const paperG = INK.paper.g;
    const paperB = INK.paper.b;

    // 忽略最外圈 3%
    const borderX = Math.floor(w * 0.03);
    const borderY = Math.floor(h * 0.03);

    // 32 网格密度，丢掉稀疏杂点
    const grid = 32;
    const cellW = Math.max(1, Math.floor((w - borderX * 2) / grid));
    const cellH = Math.max(1, Math.floor((h - borderY * 2) / grid));
    const dens = new Int32Array(grid * grid);
    let maxDens = 1;
    for (let y = borderY; y < h - borderY; y++) {
      for (let x = borderX; x < w - borderX; x++) {
        const i = (y * w + x) * channels;
        if (lumaOf(data[i], data[i + 1], data[i + 2]) < 100 || isReddish(data[i], data[i + 1], data[i + 2])) {
          const gx = Math.min(grid - 1, Math.floor((x - borderX) / cellW));
          const gy = Math.min(grid - 1, Math.floor((y - borderY) / cellH));
          const gi = gy * grid + gx;
          dens[gi]++;
          if (dens[gi] > maxDens) maxDens = dens[gi];
        }
      }
    }

    const densTh = Math.max(8, Math.floor(maxDens * 0.22));
    const xs: number[] = [];
    const ys: number[] = [];
    for (let y = borderY; y < h - borderY; y++) {
      for (let x = borderX; x < w - borderX; x++) {
        const gx = Math.min(grid - 1, Math.floor((x - borderX) / cellW));
        const gy = Math.min(grid - 1, Math.floor((y - borderY) / cellH));
        if (dens[gy * grid + gx] < densTh) continue;
        const i = (y * w + x) * channels;
        if (lumaOf(data[i], data[i + 1], data[i + 2]) < 100 || isReddish(data[i], data[i + 1], data[i + 2])) {
          xs.push(x);
          ys.push(y);
        }
      }
    }

    let minX: number;
    let minY: number;
    let maxX: number;
    let maxY: number;
    if (xs.length < 200) {
      minX = Math.floor(w * 0.2);
      minY = Math.floor(h * 0.2);
      maxX = Math.floor(w * 0.8);
      maxY = Math.floor(h * 0.8);
    } else {
      xs.sort((a, b) => a - b);
      ys.sort((a, b) => a - b);
      const p = (arr: number[], t: number) =>
        arr[Math.min(arr.length - 1, Math.max(0, Math.floor(arr.length * t)))];
      minX = p(xs, 0.02);
      maxX = p(xs, 0.98);
      minY = p(ys, 0.02);
      maxY = p(ys, 0.98);
      // 中等外扩：印文完整，红框不至于过宽
      const padX = Math.max(16, Math.floor((maxX - minX) * 0.04));
      const padY = Math.max(16, Math.floor((maxY - minY) * 0.04));
      minX = Math.max(0, minX - padX);
      minY = Math.max(0, minY - padY);
      maxX = Math.min(w - 1, maxX + padX);
      maxY = Math.min(h - 1, maxY + padY);
    }

    let toWhite = 0;
    let toRed = 0;
    let toPaper = 0;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * channels;
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const luma = lumaOf(r, g, b);
        const inside = x >= minX && x <= maxX && y >= minY && y <= maxY;
        const nz = paperNoise(x, y);

        if (!inside) {
          data[i] = clamp255(paperR + nz);
          data[i + 1] = clamp255(paperG + nz * 0.9);
          data[i + 2] = clamp255(paperB + nz * 0.7);
          toPaper++;
        } else if (luma < 120) {
          data[i] = paperR;
          data[i + 1] = paperG;
          data[i + 2] = paperB;
          toWhite++;
        } else {
          data[i] = redR;
          data[i + 1] = redG;
          data[i + 2] = redB;
          toRed++;
        }
      }
    }

    this.logger.log(
      `ColorProcessor[baiwen]: 印区(${minX},${minY})-(${maxX},${maxY}) 字→白 ${toWhite}, 底→红 ${toRed}, 印外→纸 ${toPaper}`,
    );

    return sharp(data, {
      raw: { width: w, height: h, channels },
    })
      .png()
      .toBuffer();
  }

  /**
   * 喂给 ControlNet 前的预处理：
   * 去掉格子纸的红色辅助线，只保留黑/深色手写墨迹为线稿，避免 Canny 锁死格子。
   */
  async toControlNetLineArt(input: Buffer): Promise<Buffer> {
    const { data, info } = await sharp(input)
      .resize(1024, 1024, { fit: 'inside', withoutEnlargement: false })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const channels = info.channels;
    let ink = 0;
    let cleared = 0;
    for (let i = 0; i < data.length; i += channels) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const luma = 0.299 * r + 0.587 * g + 0.114 * b;
      const isRedGrid = r > g + 35 && r > b + 35 && r > 90;

      if (isRedGrid) {
        data[i] = 255;
        data[i + 1] = 255;
        data[i + 2] = 255;
        cleared++;
      } else if (luma < 130) {
        data[i] = 0;
        data[i + 1] = 0;
        data[i + 2] = 0;
        ink++;
      } else {
        data[i] = 255;
        data[i + 1] = 255;
        data[i + 2] = 255;
      }
    }

    this.logger.log(`ControlNet lineart: 墨迹 ${ink}, 去红格 ${cleared}`);
    return sharp(data, {
      raw: { width: info.width, height: info.height, channels },
    })
      .png()
      .toBuffer();
  }

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

  /**
   * 朱文 step2：白底红字 → 米白宣纸
   * - 印区内：红字保留/收成朱砂，浅底→米白+颗粒
   * - 印区外：清红杂点，米白纸+颗粒
   */
  async shiftWhiteToRicePaper(input: Buffer): Promise<Buffer> {
    const { data, info } = await sharp(input)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const channels = info.channels;
    const w = info.width;
    const h = info.height;
    const targetRed = [INK.cinnabar.r, INK.cinnabar.g, INK.cinnabar.b];
    const paperR = INK.paper.r;
    const paperG = INK.paper.g;
    const paperB = INK.paper.b;

    const borderX = Math.floor(w * 0.03);
    const borderY = Math.floor(h * 0.03);
    const grid = 32;
    const cellW = Math.max(1, Math.floor((w - borderX * 2) / grid));
    const cellH = Math.max(1, Math.floor((h - borderY * 2) / grid));
    const dens = new Int32Array(grid * grid);
    let maxDens = 1;
    for (let y = borderY; y < h - borderY; y++) {
      for (let x = borderX; x < w - borderX; x++) {
        const i = (y * w + x) * channels;
        if (isReddish(data[i], data[i + 1], data[i + 2])) {
          const gx = Math.min(grid - 1, Math.floor((x - borderX) / cellW));
          const gy = Math.min(grid - 1, Math.floor((y - borderY) / cellH));
          const gi = gy * grid + gx;
          dens[gi]++;
          if (dens[gi] > maxDens) maxDens = dens[gi];
        }
      }
    }

    const densTh = Math.max(6, Math.floor(maxDens * 0.22));
    const xs: number[] = [];
    const ys: number[] = [];
    for (let y = borderY; y < h - borderY; y++) {
      for (let x = borderX; x < w - borderX; x++) {
        const gx = Math.min(grid - 1, Math.floor((x - borderX) / cellW));
        const gy = Math.min(grid - 1, Math.floor((y - borderY) / cellH));
        if (dens[gy * grid + gx] < densTh) continue;
        const i = (y * w + x) * channels;
        if (isReddish(data[i], data[i + 1], data[i + 2])) {
          xs.push(x);
          ys.push(y);
        }
      }
    }

    let minX: number;
    let minY: number;
    let maxX: number;
    let maxY: number;
    if (xs.length < 200) {
      minX = Math.floor(w * 0.2);
      minY = Math.floor(h * 0.2);
      maxX = Math.floor(w * 0.8);
      maxY = Math.floor(h * 0.8);
    } else {
      xs.sort((a, b) => a - b);
      ys.sort((a, b) => a - b);
      const p = (arr: number[], t: number) =>
        arr[Math.min(arr.length - 1, Math.max(0, Math.floor(arr.length * t)))];
      minX = p(xs, 0.02);
      maxX = p(xs, 0.98);
      minY = p(ys, 0.02);
      maxY = p(ys, 0.98);
      const padX = Math.max(16, Math.floor((maxX - minX) * 0.04));
      const padY = Math.max(16, Math.floor((maxY - minY) * 0.04));
      minX = Math.max(0, minX - padX);
      minY = Math.max(0, minY - padY);
      maxX = Math.min(w - 1, maxX + padX);
      maxY = Math.min(h - 1, maxY + padY);
    }

    let redKept = 0;
    let toPaper = 0;
    let cleanedRed = 0;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * channels;
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const luma = lumaOf(r, g, b);
        const inside = x >= minX && x <= maxX && y >= minY && y <= maxY;
        const nz = paperNoise(x, y);

        if (!inside) {
          if (isReddish(r, g, b)) cleanedRed++;
          data[i] = clamp255(paperR + nz);
          data[i + 1] = clamp255(paperG + nz * 0.9);
          data[i + 2] = clamp255(paperB + nz * 0.7);
          toPaper++;
        } else if (isReddish(r, g, b) && luma < 170) {
          data[i] = targetRed[0];
          data[i + 1] = targetRed[1];
          data[i + 2] = targetRed[2];
          redKept++;
        } else {
          data[i] = clamp255(paperR + nz * 0.5);
          data[i + 1] = clamp255(paperG + nz * 0.45);
          data[i + 2] = clamp255(paperB + nz * 0.35);
          toPaper++;
        }
      }
    }

    this.logger.log(
      `ColorProcessor[zhuwen paper]: 印区(${minX},${minY})-(${maxX},${maxY}) 红字 ${redKept}, 纸面 ${toPaper}, 印外清红 ${cleanedRed}`,
    );

    return sharp(data, {
      raw: { width: w, height: h, channels },
    })
      .png()
      .toBuffer();
  }
}
