import { describe, expect, it } from 'vitest';
import { parseProject, serializeProject, type Project } from './project.ts';

const project = (): Project => ({
  version: 1,
  seed: 'aldoria',
  generated: true,
  sketch: [
    { tool: 'pen', points: [10, 20, 30, 40, 50, 60] },
    { tool: 'eraser', points: [15, 25, 35, 45] },
  ],
  hints: [
    { kind: 'snow', x: 120, y: 80 },
    { kind: 'desert', x: 300.5, y: 250 },
  ],
  distribution: { shares: { mountains: 0.2, forest: 0.3, desert: 0.1, swamp: 0.1, plains: 0.3 }, snow: 0.25 },
  structures: [
    { kind: 'kingdom', x: 290, y: 228, name: 'Reino de Valdoria' },
    { kind: 'village', x: 350, y: 278, name: 'Ruínas "velhas" & cia' },
  ],
  roads: [[0, 1]],
  regionNames: [{ kind: 'forest', x: 180, y: 140, name: 'Bosque dos Sussurros' }],
  labels: [{ kind: 'sea', x: 90, y: 300, name: 'Baía das Sereias' }],
  showRegions: true,
});

/** The saved text with one thing changed, to check that it is rejected. */
const tampered = (change: (data: Record<string, unknown>) => void) => {
  const data = JSON.parse(serializeProject(project())) as Record<string, unknown>;
  change(data);
  return parseProject(JSON.stringify(data));
};

describe('saving and loading a project', () => {
  it('brings back exactly what was saved', () => {
    expect(parseProject(serializeProject(project()))).toEqual(project());
  });

  it('keeps a project with no distribution and nothing placed', () => {
    const empty: Project = {
      ...project(),
      generated: false,
      sketch: [],
      hints: [],
      distribution: null,
      structures: [],
      roads: [],
      regionNames: [],
      labels: [],
      showRegions: false,
    };
    expect(parseProject(serializeProject(empty))).toEqual(empty);
  });

  it('drops precision that makes no visible difference', () => {
    const fine = project();
    fine.sketch[0].points = [10.4, 20.6, 30.49, 40.51];
    fine.structures[0].x = 290.123456;
    const loaded = parseProject(serializeProject(fine))!;
    expect(loaded.sketch[0].points).toEqual([10, 21, 30, 41]);
    expect(loaded.structures[0].x).toBe(290.1);
  });
});

describe('parseProject', () => {
  it('rejects text that is not a project', () => {
    for (const text of ['', 'not json', '42', 'null', '[]', '{}', '{"version":1}']) {
      expect(parseProject(text)).toBeNull();
    }
  });

  it('rejects a project from an unknown version', () => {
    expect(tampered((d) => (d.version = 2))).toBeNull();
  });

  it('rejects unknown kinds of structure, terrain and region', () => {
    expect(tampered((d) => ((d.structures as { kind: string }[])[0].kind = 'spaceport'))).toBeNull();
    expect(tampered((d) => ((d.hints as { kind: string }[])[0].kind = 'lava'))).toBeNull();
    expect(tampered((d) => ((d.regionNames as { kind: string }[])[0].kind = 'galaxy'))).toBeNull();
    expect(tampered((d) => ((d.sketch as { tool: string }[])[0].tool = 'spray'))).toBeNull();
  });

  it('rejects positions that are not numbers', () => {
    expect(tampered((d) => ((d.structures as { x: unknown }[])[0].x = '290'))).toBeNull();
    expect(tampered((d) => ((d.hints as { y: unknown }[])[0].y = null))).toBeNull();
    expect(tampered((d) => ((d.sketch as { points: unknown[] }[])[0].points = [1, 2, 3]))).toBeNull();
    expect(tampered((d) => ((d.sketch as { points: unknown[] }[])[0].points = [1, 'a']))).toBeNull();
  });

  it('rejects roads that do not link two different existing structures', () => {
    expect(tampered((d) => (d.roads = [[0, 5]]))).toBeNull();
    expect(tampered((d) => (d.roads = [[1, 1]]))).toBeNull();
    expect(tampered((d) => (d.roads = [[0, 0.5]]))).toBeNull();
    expect(tampered((d) => (d.roads = [[0]]))).toBeNull();
  });

  it('rejects a broken distribution', () => {
    expect(tampered((d) => (d.distribution = { shares: { mountains: 1 }, snow: 0 }))).toBeNull();
    expect(tampered((d) => (d.distribution = 'lots of snow'))).toBeNull();
  });

  it('rejects names long enough to break the page', () => {
    expect(tampered((d) => ((d.structures as { name: string }[])[0].name = 'x'.repeat(500)))).toBeNull();
    expect(tampered((d) => (d.seed = 'x'.repeat(500)))).toBeNull();
  });

  it('opens a project saved before written labels existed', () => {
    expect(tampered((d) => delete d.labels)).toEqual({ ...project(), labels: [] });
  });

  it('rejects a written label of an unknown kind', () => {
    expect(tampered((d) => ((d.labels as { kind: string }[])[0].kind = 'nebula'))).toBeNull();
    expect(tampered((d) => (d.labels = 'none'))).toBeNull();
  });

  it('ignores fields it does not know', () => {
    expect(tampered((d) => (d.futureFeature = { anything: true }))).toEqual(project());
  });
});
