import { STRUCTURE_KINDS, type StructureKind } from '../structures/model.ts';

const KIND_LABEL: Record<StructureKind, string> = {
  kingdom: 'Reino',
  city: 'Cidade',
  village: 'Vila',
  tower: 'Torre',
  port: 'Porto',
  ruins: 'Ruínas',
  dungeon: 'Masmorra',
};

export interface StructureMenuActions {
  /** The user wants to link this structure to another by road. */
  onRoad: () => void;
  onRename: (name: string) => void;
  onRetype: (kind: StructureKind) => void;
  onRemove: () => void;
}

/**
 * The small menu shown next to a selected structure: build a road from it,
 * rename it, change what it is, or remove it. Renaming and changing type open
 * a second step inside the same menu.
 */
export class StructureMenu {
  private root: HTMLElement;
  private actions: StructureMenuActions;
  private name = '';
  private kind: StructureKind = 'village';

  constructor(root: HTMLElement, actions: StructureMenuActions) {
    this.root = root;
    this.actions = actions;
  }

  get isOpen(): boolean {
    return !this.root.hidden;
  }

  /** Shows the menu for a structure with this name and kind. */
  open(name: string, kind: StructureKind): void {
    this.name = name;
    this.kind = kind;
    this.root.hidden = false;
    this.showActions();
  }

  close(): void {
    this.root.hidden = true;
    this.root.replaceChildren();
  }

  private button(label: string, onClick: () => void, className = ''): HTMLButtonElement {
    const button = document.createElement('button');
    button.textContent = label;
    button.className = className;
    button.addEventListener('click', onClick);
    return button;
  }

  private title(text: string): HTMLElement {
    const title = document.createElement('strong');
    title.textContent = text;
    return title;
  }

  private showActions(): void {
    this.root.replaceChildren(
      this.title(this.name),
      this.button('Estrada até…', () => this.actions.onRoad()),
      this.button('Renomear', () => this.showRename()),
      this.button('Mudar tipo', () => this.showKinds()),
      this.button('Remover', () => this.actions.onRemove(), 'danger'),
    );
  }

  private showRename(): void {
    const input = document.createElement('input');
    input.type = 'text';
    input.value = this.name;
    input.spellcheck = false;
    const confirm = () => {
      const name = input.value.trim();
      if (name) this.actions.onRename(name);
      else this.showActions();
    };
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') confirm();
      if (e.key === 'Escape') {
        // Back to the actions, without also deselecting the structure.
        e.stopPropagation();
        this.showActions();
      }
    });
    this.root.replaceChildren(
      this.title('Novo nome'),
      input,
      this.button('Confirmar', confirm, 'primary'),
      this.button('Voltar', () => this.showActions()),
    );
    input.focus();
    input.select();
  }

  private showKinds(): void {
    this.root.replaceChildren(
      this.title('Mudar para'),
      ...STRUCTURE_KINDS.map((kind) =>
        this.button(KIND_LABEL[kind], () => this.actions.onRetype(kind), kind === this.kind ? 'active' : ''),
      ),
      this.button('Voltar', () => this.showActions()),
    );
  }
}
