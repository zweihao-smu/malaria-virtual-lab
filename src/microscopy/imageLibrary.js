/**
 * 真实疟原虫血涂片图片库（存于 public/parasites/）。
 * 图片来源：Wikimedia Commons / CDC DPDx / CDC PHIL，均为公有领域或 CC 许可（署名信息见 credit）。
 * 仅包含教学要求的两种虫种：间日疟原虫（vivax）、恶性疟原虫（falciparum）。
 */
const base = import.meta.env.BASE_URL

export const REAL_IMAGES = {
  vivax: {
    ring: [
      { src: 'parasites/vivax-ring-2.jpg', credit: 'CDC DPDx / Merlin magicien (CC BY 2.0)' },
    ],
    trophozoite: [
      { src: 'parasites/vivax-trophozoite-1.jpg', credit: 'Dr Osaro Erhabor (CC BY-SA 3.0)' },
    ],
    schizont: [
      { src: 'parasites/vivax-schizont-1.jpg', credit: 'Stefan Walkowski (CC BY-SA 4.0)' },
    ],
    gametocyte: [
      { src: 'parasites/vivax-gametocyte-1.jpg', credit: 'CDC PHIL #2727 (公有领域)' },
      { src: 'parasites/vivax-gametocyte-2.png', credit: 'CDC / Steven Glenn (公有领域)' },
    ],
  },
  falciparum: {
    ring: [
      { src: 'parasites/falciparum-ring-1.jpg', credit: 'Dr Graham Beards (CC BY-SA 4.0)' },
      { src: 'parasites/falciparum-ring-2.jpg', credit: 'Dr Osaro Erhabor (CC BY-SA 3.0)' },
    ],
    gametocyte: [
      { src: 'parasites/falciparum-gametocyte-1.jpg', credit: 'Microrao (CC BY-SA 4.0)' },
      { src: 'parasites/falciparum-gametocyte-2.jpg', credit: 'Michael Wunderli (CC BY 2.0)' },
    ],
  },
}

export function imgUrl(entry) { return base + entry.src }

/** 展开为扁平题目池 [{ species, stage, src, credit }] */
export function buildQuestionPool() {
  const pool = []
  for (const [species, stages] of Object.entries(REAL_IMAGES)) {
    for (const [stage, images] of Object.entries(stages)) {
      for (const img of images) pool.push({ species, stage, ...img })
    }
  }
  return pool
}
