import type { TerrainDistribution, TerrainShares } from '../generator/distribution.ts';
import { TERRAIN_KINDS, type BrushKind, type TerrainKind } from '../generator/hints.ts';
import { TERRAIN_COLOR } from '../render/hints.ts';

const LABEL: Record<TerrainKind, string> = {
  mountains: 'Montanha',
  forest: 'Floresta',
  desert: 'Deserto',
  swamp: 'Pântano',
  plains: 'Planície',
};

/**
 * One slider per base terrain, in percent of the land, under a bar that shows
 * how they split it; then a separate slider for snow, which covers terrain
 * rather than competing with it. The terrain sliders are independent: their
 * total is shown so the user sees when it is not 100%, and whoever applies the
 * values is expected to normalize them.
 */
export class DistributionPanel {
  private sliders = {} as Record<BrushKind, HTMLInputElement>;
  private readouts = {} as Record<BrushKind, HTMLElement>;
  private segments = {} as Record<TerrainKind, HTMLElement>;
  private total: HTMLElement;

  constructor(container: HTMLElement) {
    const split = document.createElement('div');
    split.className = 'share-bar';
    container.append(split);

    for (const kind of TERRAIN_KINDS) {
      const segment = document.createElement('span');
      segment.style.background = TERRAIN_COLOR[kind];
      segment.title = LABEL[kind];
      split.append(segment);
      this.segments[kind] = segment;
      container.append(this.row(kind, LABEL[kind]));
    }

    this.total = document.createElement('p');
    this.total.className = 'slider-total';
    container.append(this.total);

    const snowNote = document.createElement('p');
    snowNote.className = 'slider-note';
    snowNote.textContent = 'A neve cobre montanhas, florestas e planícies. Nunca pântano nem deserto.';
    container.append(this.row('snow', 'Cobertura de neve'), snowNote);

    this.refresh();
  }

  /** The values as set, as fractions of the land. The terrain shares may not add up to 1. */
  get values(): TerrainDistribution {
    const shares = {} as TerrainShares;
    for (const kind of TERRAIN_KINDS) shares[kind] = Number(this.sliders[kind].value) / 100;
    return { shares, snow: Number(this.sliders.snow.value) / 100 };
  }

  /** Shows the given distribution (fractions of the land). */
  show({ shares, snow }: TerrainDistribution): void {
    for (const kind of TERRAIN_KINDS) this.sliders[kind].value = String(Math.round(shares[kind] * 100));
    this.sliders.snow.value = String(Math.round(snow * 100));
    this.refresh();
  }

  private row(kind: BrushKind, label: string): HTMLElement {
    const row = document.createElement('label');
    row.className = 'slider-row';
    row.style.setProperty('--color', TERRAIN_COLOR[kind]);

    const swatch = document.createElement('span');
    swatch.className = 'swatch';
    const name = document.createElement('span');
    name.className = 'name';
    name.textContent = label;
    const readout = document.createElement('span');
    readout.className = 'readout';
    const slider = document.createElement('input');
    slider.type = 'range';
    slider.className = 'slider';
    slider.min = '0';
    slider.max = '100';
    slider.step = '1';
    slider.addEventListener('input', () => this.refresh());

    row.append(swatch, name, readout, slider);
    this.sliders[kind] = slider;
    this.readouts[kind] = readout;
    return row;
  }

  private refresh(): void {
    const show = (kind: BrushKind) => {
      const value = Number(this.sliders[kind].value);
      this.readouts[kind].textContent = `${value}%`;
      // Drives the filled part of the track in CSS.
      this.sliders[kind].style.setProperty('--value', String(value / 100));
      return value;
    };
    show('snow');
    let sum = 0;
    for (const kind of TERRAIN_KINDS) {
      const value = show(kind);
      sum += value;
      // Segments share the bar in proportion, which is how the values get normalized on apply.
      this.segments[kind].style.flexGrow = String(value);
    }
    // Rounded shares of a real map can add up to 99 or 101; that is not worth a warning.
    const off = Math.abs(sum - 100) > 1;
    this.total.textContent = off ? `Total: ${sum}% — será ajustado para 100%` : `Total: ${sum}%`;
    this.total.classList.toggle('off', off);
  }
}
