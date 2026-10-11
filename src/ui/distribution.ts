import type { TerrainDistribution } from '../generator/distribution.ts';
import { TERRAIN_KINDS, type TerrainKind } from '../generator/hints.ts';
import { TERRAIN_COLOR } from '../render/hints.ts';

const LABEL: Record<TerrainKind, string> = {
  mountains: 'Montanha',
  forest: 'Floresta',
  desert: 'Deserto',
  swamp: 'Pântano',
  tundra: 'Neve',
  plains: 'Planície',
};

/**
 * One slider per terrain, in percent of the land, under a bar that shows how
 * the shares split the land. The sliders are independent; the total is shown
 * so the user sees when it is not 100%, and whoever applies the values is
 * expected to normalize them.
 */
export class DistributionPanel {
  private sliders = {} as Record<TerrainKind, HTMLInputElement>;
  private readouts = {} as Record<TerrainKind, HTMLElement>;
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

      const row = document.createElement('label');
      row.className = 'slider-row';
      row.style.setProperty('--color', TERRAIN_COLOR[kind]);

      const swatch = document.createElement('span');
      swatch.className = 'swatch';
      const name = document.createElement('span');
      name.className = 'name';
      name.textContent = LABEL[kind];
      const readout = document.createElement('span');
      readout.className = 'readout';
      const slider = document.createElement('input');
      slider.type = 'range';
      slider.min = '0';
      slider.max = '100';
      slider.step = '1';
      slider.addEventListener('input', () => this.refresh());

      row.append(swatch, name, readout, slider);
      container.append(row);
      this.sliders[kind] = slider;
      this.readouts[kind] = readout;
    }
    this.total = document.createElement('p');
    this.total.className = 'slider-total';
    container.append(this.total);
    this.refresh();
  }

  /** Slider values in percent, exactly as set (they may not add up to 100). */
  get values(): TerrainDistribution {
    const values = {} as TerrainDistribution;
    for (const kind of TERRAIN_KINDS) values[kind] = Number(this.sliders[kind].value);
    return values;
  }

  /** Shows the given shares (fractions of the land, adding up to 1). */
  show(shares: TerrainDistribution): void {
    for (const kind of TERRAIN_KINDS) this.sliders[kind].value = String(Math.round(shares[kind] * 100));
    this.refresh();
  }

  private refresh(): void {
    let sum = 0;
    for (const kind of TERRAIN_KINDS) {
      const value = Number(this.sliders[kind].value);
      sum += value;
      this.readouts[kind].textContent = `${value}%`;
      // Drives the filled part of the track in CSS.
      this.sliders[kind].style.setProperty('--value', String(value / 100));
      // Segments share the bar in proportion, which is how the values get normalized on apply.
      this.segments[kind].style.flexGrow = String(value);
    }
    // Rounded shares of a real map can add up to 99 or 101; that is not worth a warning.
    const off = Math.abs(sum - 100) > 1;
    this.total.textContent = off ? `Total: ${sum}% — será ajustado para 100%` : `Total: ${sum}%`;
    this.total.classList.toggle('off', off);
  }
}
