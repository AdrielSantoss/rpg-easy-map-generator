import { ABILITIES, ABILITY_LABEL, ABILITY_SHORT, SKILLS, type ClassId } from '../npc/sheet-data.ts';
import {
  modifier,
  passivePerception,
  saveBonus,
  signed,
  skillBonus,
  spellcasting,
  type CharacterSheet,
} from '../npc/sheet.ts';
import { drawToken } from './token.ts';

export const CARD_WIDTH = 900;
export const CARD_HEIGHT = 1260;

const PAPER = '#efe4c8';
const MUTED = '#b3a58c';
const GOLD = '#c9963f';
const SERIF = "Georgia, 'Times New Roman', serif";
const MARGIN = 56;
/** The side of the portrait. */
const PORTRAIT = 280;

type Emblem = (ctx: CanvasRenderingContext2D) => void;

const line = (ctx: CanvasRenderingContext2D, ...points: number[]) => {
  ctx.beginPath();
  ctx.moveTo(points[0], points[1]);
  for (let i = 2; i < points.length; i += 2) ctx.lineTo(points[i], points[i + 1]);
  ctx.stroke();
};

const disc = (ctx: CanvasRenderingContext2D, x: number, y: number, radius: number) => {
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
};

/**
 * One symbol per class, drawn in a box of 100 by 100 with the current stroke
 * and fill colors.
 */
const EMBLEM: Record<ClassId, Emblem> = {
  // A hammer.
  commoner: (ctx) => {
    line(ctx, 30, 86, 58, 40);
    ctx.beginPath();
    ctx.moveTo(40, 22);
    ctx.lineTo(82, 44);
    ctx.lineTo(74, 60);
    ctx.lineTo(32, 38);
    ctx.closePath();
    ctx.fill();
  },
  // An axe.
  barbarian: (ctx) => {
    line(ctx, 34, 90, 58, 12);
    ctx.beginPath();
    ctx.moveTo(56, 20);
    ctx.quadraticCurveTo(96, 22, 86, 66);
    ctx.quadraticCurveTo(70, 50, 48, 48);
    ctx.closePath();
    ctx.fill();
  },
  // A musical note.
  bard: (ctx) => {
    ctx.beginPath();
    ctx.ellipse(36, 76, 14, 10, -0.3, 0, Math.PI * 2);
    ctx.fill();
    line(ctx, 48, 74, 48, 16);
    ctx.beginPath();
    ctx.moveTo(48, 16);
    ctx.quadraticCurveTo(80, 22, 72, 52);
    ctx.stroke();
  },
  // A sun.
  cleric: (ctx) => {
    disc(ctx, 50, 50, 17);
    for (let i = 0; i < 8; i++) {
      const angle = (i * Math.PI) / 4;
      line(
        ctx,
        50 + Math.cos(angle) * 27,
        50 + Math.sin(angle) * 27,
        50 + Math.cos(angle) * 42,
        50 + Math.sin(angle) * 42,
      );
    }
  },
  // A leaf.
  druid: (ctx) => {
    ctx.beginPath();
    ctx.moveTo(50, 92);
    ctx.quadraticCurveTo(6, 54, 50, 8);
    ctx.quadraticCurveTo(94, 54, 50, 92);
    ctx.stroke();
    line(ctx, 50, 92, 50, 28);
    line(ctx, 50, 66, 32, 50);
    line(ctx, 50, 52, 68, 38);
  },
  // A sword.
  fighter: (ctx) => {
    ctx.beginPath();
    ctx.moveTo(43, 66);
    ctx.lineTo(50, 6);
    ctx.lineTo(57, 66);
    ctx.closePath();
    ctx.fill();
    line(ctx, 28, 68, 72, 68);
    line(ctx, 50, 68, 50, 88);
    disc(ctx, 50, 91, 5);
  },
  // A circle drawn in one brush stroke.
  monk: (ctx) => {
    ctx.save();
    ctx.lineWidth *= 1.5;
    ctx.beginPath();
    ctx.arc(50, 50, 32, Math.PI * 0.25, Math.PI * 2.05);
    ctx.stroke();
    ctx.restore();
    disc(ctx, 50, 50, 7);
  },
  // A shield with a cross.
  paladin: (ctx) => {
    ctx.beginPath();
    ctx.moveTo(18, 14);
    ctx.lineTo(82, 14);
    ctx.lineTo(82, 50);
    ctx.quadraticCurveTo(82, 78, 50, 94);
    ctx.quadraticCurveTo(18, 78, 18, 50);
    ctx.closePath();
    ctx.stroke();
    line(ctx, 50, 30, 50, 76);
    line(ctx, 34, 46, 66, 46);
  },
  // A drawn bow.
  ranger: (ctx) => {
    ctx.beginPath();
    ctx.arc(72, 50, 46, Math.PI * 0.62, Math.PI * 1.38);
    ctx.stroke();
    ctx.save();
    ctx.lineWidth *= 0.5;
    line(ctx, 54.5, 92.5, 54.5, 7.5);
    ctx.restore();
    line(ctx, 90, 50, 12, 50);
    line(ctx, 24, 40, 12, 50, 24, 60);
  },
  // A dagger, held low.
  rogue: (ctx) => {
    ctx.save();
    ctx.translate(50, 50);
    ctx.rotate(Math.PI * 0.75);
    ctx.translate(-50, -50);
    ctx.beginPath();
    ctx.moveTo(43, 58);
    ctx.lineTo(50, 4);
    ctx.lineTo(57, 58);
    ctx.closePath();
    ctx.fill();
    line(ctx, 34, 60, 66, 60);
    line(ctx, 50, 60, 50, 84);
    ctx.restore();
  },
  // A flame.
  sorcerer: (ctx) => {
    ctx.beginPath();
    ctx.moveTo(50, 6);
    ctx.bezierCurveTo(80, 40, 86, 60, 70, 80);
    ctx.bezierCurveTo(60, 96, 40, 96, 30, 80);
    ctx.bezierCurveTo(16, 58, 40, 50, 36, 30);
    ctx.bezierCurveTo(46, 38, 50, 28, 50, 6);
    ctx.fill();
  },
  // An eye.
  warlock: (ctx) => {
    ctx.beginPath();
    ctx.moveTo(6, 50);
    ctx.quadraticCurveTo(50, 8, 94, 50);
    ctx.quadraticCurveTo(50, 92, 6, 50);
    ctx.stroke();
    disc(ctx, 50, 50, 13);
  },
  // A star of eight points.
  wizard: (ctx) => {
    ctx.beginPath();
    for (let i = 0; i < 16; i++) {
      const radius = i % 2 === 0 ? 44 : 17;
      const angle = (i * Math.PI) / 8 - Math.PI / 2;
      ctx.lineTo(50 + Math.cos(angle) * radius, 50 + Math.sin(angle) * radius);
    }
    ctx.closePath();
    ctx.fill();
  },
};

/** The color each class is known by, and the dark tone the card fades from. */
const THEME: Record<ClassId, readonly [accent: string, deep: string]> = {
  commoner: ['#b89b6a', '#3a2f22'],
  barbarian: ['#d2603f', '#3d1a12'],
  bard: ['#c874c0', '#35183a'],
  cleric: ['#e6d48a', '#3b3418'],
  druid: ['#7fb55a', '#1c3418'],
  fighter: ['#9fb0c8', '#222a36'],
  monk: ['#56c2b8', '#123532'],
  paladin: ['#f0cf60', '#3a2f10'],
  ranger: ['#5fa878', '#14301f'],
  rogue: ['#9a94b8', '#1f1d2c'],
  sorcerer: ['#f07a4a', '#3d1410'],
  warlock: ['#9f6fe0', '#22123d'],
  wizard: ['#6f9cf0', '#12203d'],
};

function drawEmblem(
  ctx: CanvasRenderingContext2D,
  classId: ClassId,
  x: number,
  y: number,
  size: number,
  color: string,
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size / 100, size / 100);
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 7;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  EMBLEM[classId](ctx);
  ctx.restore();
}

/** Breaks text into lines no wider than `width`, keeping the line breaks it already has. */
function wrap(ctx: CanvasRenderingContext2D, text: string, width: number): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split('\n')) {
    let current = '';
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      const longer = current ? `${current} ${word}` : word;
      if (current && ctx.measureText(longer).width > width) {
        lines.push(current);
        current = word;
      } else {
        current = longer;
      }
    }
    if (current) lines.push(current);
  }
  return lines;
}

/** Shrinks the font until the text fits on one line. Returns the size used. */
function fit(
  ctx: CanvasRenderingContext2D,
  text: string,
  width: number,
  size: number,
  style = 'bold',
): number {
  let used = size;
  do {
    ctx.font = `${style} ${used}px ${SERIF}`;
    used -= 2;
  } while (ctx.measureText(text).width > width && used > 16);
  return used + 2;
}

/**
 * Draws the short version of a character sheet as a card: portrait, who the
 * character is, and the numbers a game master reaches for at the table. Colors
 * and symbol follow the class; spellcasters lead with their magic, the others
 * with their weapons and gear.
 */
export function drawSheetCard(
  canvas: HTMLCanvasElement,
  sheet: CharacterSheet,
  portrait: CanvasImageSource & { width: number; height: number },
): void {
  canvas.width = CARD_WIDTH;
  canvas.height = CARD_HEIGHT;
  const ctx = canvas.getContext('2d')!;
  const [accent, deep] = THEME[sheet.classId];
  const inner = CARD_WIDTH - 2 * MARGIN;
  const bottom = CARD_HEIGHT - MARGIN - 4;

  // Ground: the class color fading into the dark, with a glow behind the portrait.
  const ground = ctx.createLinearGradient(0, 0, 0, CARD_HEIGHT);
  ground.addColorStop(0, deep);
  ground.addColorStop(0.55, '#1b1714');
  ground.addColorStop(1, '#120f0d');
  ctx.fillStyle = ground;
  ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);
  const glow = ctx.createRadialGradient(220, 220, 40, 220, 220, 520);
  glow.addColorStop(0, `${accent}55`);
  glow.addColorStop(1, `${accent}00`);
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);
  ctx.globalAlpha = 0.07;
  drawEmblem(ctx, sheet.classId, CARD_WIDTH - 470, CARD_HEIGHT - 520, 460, accent);
  ctx.globalAlpha = 1;

  // Frame.
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 4;
  ctx.strokeRect(16, 16, CARD_WIDTH - 32, CARD_HEIGHT - 32);
  ctx.strokeStyle = accent;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(26, 26, CARD_WIDTH - 52, CARD_HEIGHT - 52);

  // Portrait, as the same round token.
  const token = document.createElement('canvas');
  token.width = token.height = 640;
  drawToken(token, portrait);
  ctx.drawImage(token, MARGIN, MARGIN, PORTRAIT, PORTRAIT);

  // Who this is.
  const textX = MARGIN + PORTRAIT + 30;
  const textWidth = CARD_WIDTH - MARGIN - textX;
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = PAPER;
  let y = 108;
  ctx.font = `bold 50px ${SERIF}`;
  const nameLines = wrap(ctx, sheet.name || 'Sem nome', textWidth).slice(0, 2);
  for (const part of nameLines) {
    const size = fit(ctx, part, textWidth, 50);
    ctx.fillText(part, textX, y);
    y += size + 8;
  }
  y += 14;
  ctx.fillStyle = accent;
  fit(ctx, `${sheet.className} · nível ${sheet.level}`, textWidth, 34);
  ctx.fillText(`${sheet.className} · nível ${sheet.level}`, textX, y);
  y += 42;
  ctx.fillStyle = PAPER;
  const origin = [sheet.race, sheet.background].filter(Boolean).join(' · ');
  fit(ctx, origin, textWidth, 26, 'normal');
  ctx.fillText(origin, textX, y);
  y += 36;
  ctx.fillStyle = MUTED;
  fit(ctx, sheet.alignment, textWidth, 24, 'italic');
  ctx.fillText(sheet.alignment, textX, y);

  // The class symbol, on a medal under the text.
  const medalX = CARD_WIDTH - MARGIN - 44;
  const medalY = MARGIN + PORTRAIT - 44;
  ctx.fillStyle = '#14110f';
  disc(ctx, medalX, medalY, 44);
  ctx.strokeStyle = accent;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(medalX, medalY, 44, 0, Math.PI * 2);
  ctx.stroke();
  drawEmblem(ctx, sheet.classId, medalX - 29, medalY - 29, 58, accent);

  const box = (x: number, top: number, width: number, height: number) => {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.strokeStyle = `${accent}99`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(x, top, width, height, 10);
    ctx.fill();
    ctx.stroke();
  };
  const centered = (text: string, x: number, baseline: number, font: string, color: string) => {
    ctx.font = font;
    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.fillText(text, x, baseline);
    ctx.textAlign = 'left';
  };

  // What is asked for most in a fight.
  const stats: [string, string][] = [
    ['CA', String(sheet.armorClass)],
    ['PV', String(sheet.hpMax)],
    ['DESLOC.', sheet.speed],
    ['INICIATIVA', signed(sheet.initiative)],
    ['PROFICIÊNCIA', signed(sheet.proficiencyBonus)],
  ];
  const statGap = 12;
  const statWidth = (inner - statGap * (stats.length - 1)) / stats.length;
  const statTop = MARGIN + PORTRAIT + 30;
  for (const [index, [label, value]] of stats.entries()) {
    const x = MARGIN + index * (statWidth + statGap);
    box(x, statTop, statWidth, 96);
    centered(label, x + statWidth / 2, statTop + 28, `15px ${SERIF}`, MUTED);
    fit(ctx, value, statWidth - 16, 46);
    centered(value, x + statWidth / 2, statTop + 76, ctx.font, PAPER);
  }

  // The six abilities: the modifier large, the score beneath.
  const abilityGap = 10;
  const abilityWidth = (inner - abilityGap * 5) / 6;
  const abilityTop = statTop + 96 + 16;
  for (const [index, ability] of ABILITIES.entries()) {
    const x = MARGIN + index * (abilityWidth + abilityGap);
    const score = sheet.abilities[ability];
    box(x, abilityTop, abilityWidth, 120);
    centered(ABILITY_SHORT[ability], x + abilityWidth / 2, abilityTop + 28, `bold 17px ${SERIF}`, accent);
    centered(signed(modifier(score)), x + abilityWidth / 2, abilityTop + 76, `bold 44px ${SERIF}`, PAPER);
    centered(String(score), x + abilityWidth / 2, abilityTop + 106, `20px ${SERIF}`, MUTED);
  }

  // Below, two columns of text that run as far as their content goes.
  const columnGap = 28;
  const columnWidth = (inner - columnGap) / 2;
  const columnsTop = abilityTop + 120 + 42;
  const heading = (text: string, x: number, at: number, width = columnWidth): number => {
    ctx.font = `bold 19px ${SERIF}`;
    ctx.fillStyle = accent;
    ctx.fillText(text.toUpperCase(), x, at);
    ctx.fillRect(x, at + 8, width, 1.5);
    return at + 38;
  };
  /** Writes wrapped text and returns where the next line would go; stops at `limit` with an ellipsis. */
  const paragraph = (
    text: string,
    x: number,
    at: number,
    width: number,
    limit = bottom,
    size = 21,
    color = PAPER,
  ): number => {
    ctx.font = `${size}px ${SERIF}`;
    ctx.fillStyle = color;
    const lineHeight = Math.round(size * 1.35);
    const lines = wrap(ctx, text, width);
    for (const [index, part] of lines.entries()) {
      if (at > limit) break;
      const last = at + lineHeight > limit && index < lines.length - 1;
      ctx.fillText(last ? `${part.replace(/[\s.,;]+$/, '')}…` : part, x, at);
      at += lineHeight;
    }
    return at + 14;
  };

  const leftX = MARGIN;
  const rightX = MARGIN + columnWidth + columnGap;
  // The features go across the foot of the card, in as many lines as they
  // need up to five; the columns have what is left above them.
  ctx.font = `20px ${SERIF}`;
  const featureLines = Math.min(wrap(ctx, sheet.features, inner).length, 5);
  const footTop = bottom - 74 - featureLines * 27;
  const columnsLimit = footTop - 44;

  let left = heading('Testes de resistência', leftX, columnsTop);
  const saves = ABILITIES.filter((ability) => sheet.saves.includes(ability))
    .map((ability) => `${ABILITY_LABEL[ability]} ${signed(saveBonus(sheet, ability))}`)
    .join(' · ');
  left = paragraph(saves || 'Nenhum com proficiência', leftX, left, columnWidth, columnsLimit);
  left = heading('Perícias', leftX, left + 8);
  const skills = SKILLS.filter((skill) => sheet.skills.includes(skill.id))
    .map((skill) => `${skill.label} ${signed(skillBonus(sheet, skill.id))}`)
    .join(' · ');
  left = paragraph(skills || 'Nenhuma com proficiência', leftX, left, columnWidth, columnsLimit);
  left = paragraph(
    `Percepção passiva ${passivePerception(sheet)}`,
    leftX,
    left,
    columnWidth,
    columnsLimit,
    21,
    MUTED,
  );
  // How to play the character, when the column still has room for it.
  if (sheet.traits && left + 100 < columnsLimit) {
    left = heading('Personalidade', leftX, left + 8);
    paragraph(sheet.traits, leftX, left, columnWidth, columnsLimit, 19);
  }

  const attacks = (at: number): number => {
    at = heading('Ataques', rightX, at);
    for (const attack of sheet.attacks.filter((entry) => entry.name)) {
      if (at > columnsLimit) break;
      ctx.font = `bold 21px ${SERIF}`;
      ctx.fillStyle = PAPER;
      ctx.fillText(attack.name, rightX, at);
      ctx.textAlign = 'right';
      ctx.fillStyle = accent;
      ctx.fillText(attack.bonus, rightX + columnWidth, at);
      ctx.textAlign = 'left';
      ctx.font = `19px ${SERIF}`;
      ctx.fillStyle = MUTED;
      ctx.fillText(attack.damage, rightX, at + 24);
      at += 56;
    }
    return at + 4;
  };
  const magic = spellcasting(sheet);
  let right = columnsTop;
  if (magic) {
    // A spellcaster is their magic first.
    right = heading('Magia', rightX, right);
    right = paragraph(
      `${ABILITY_LABEL[magic.ability]} · CD ${magic.dc} · ataque ${signed(magic.attack)}`,
      rightX,
      right - 2,
      columnWidth,
      columnsLimit,
      21,
      accent,
    );
    right = paragraph(
      sheet.spells,
      rightX,
      right - 6,
      columnWidth,
      Math.min(columnsTop + 200, columnsLimit),
      19,
    );
    attacks(right + 8);
  } else {
    right = attacks(right);
    if (right + 70 < columnsLimit) {
      right = heading('Equipamento', rightX, right + 8);
      paragraph(sheet.equipment, rightX, right, columnWidth, columnsLimit, 19);
    }
  }

  paragraph(sheet.features, leftX, heading('Características', leftX, footTop, inner), inner, bottom - 40, 20);
  const languages = sheet.proficiencies.split('\n')[0] ?? '';
  ctx.font = `italic 18px ${SERIF}`;
  ctx.fillStyle = MUTED;
  const footer = wrap(ctx, languages, inner)[0] ?? '';
  ctx.fillText(footer, leftX, bottom - 4);
}
