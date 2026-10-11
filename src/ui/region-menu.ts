export interface RegionMenuActions {
  onRename: (name: string) => void;
  /** Asks for another suggested name for the region being renamed. */
  suggest: () => string;
  /** The user wants this region left without a name on the map. */
  onRemove: () => void;
}

/**
 * The small box shown when a region's name is clicked: type a new name, ask
 * for another suggestion, or take the name off the map.
 */
export class RegionMenu {
  private root: HTMLElement;
  private actions: RegionMenuActions;

  constructor(root: HTMLElement, actions: RegionMenuActions) {
    this.root = root;
    this.actions = actions;
  }

  get isOpen(): boolean {
    return !this.root.hidden;
  }

  open(name: string): void {
    const title = document.createElement('strong');
    title.textContent = 'Nome da região';

    const input = document.createElement('input');
    input.type = 'text';
    input.value = name;
    input.spellcheck = false;
    const confirm = () => {
      const chosen = input.value.trim();
      if (chosen) this.actions.onRename(chosen);
    };
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') confirm();
    });

    const button = (label: string, onClick: () => void, className = '') => {
      const element = document.createElement('button');
      element.textContent = label;
      element.className = className;
      element.addEventListener('click', onClick);
      return element;
    };

    this.root.replaceChildren(
      title,
      input,
      button('Confirmar', confirm, 'primary'),
      button('Sugerir outro', () => {
        input.value = this.actions.suggest();
        input.focus();
      }),
      button('Excluir nome', () => this.actions.onRemove(), 'danger'),
    );
    this.root.hidden = false;
    // The menu opens on a press of the mouse button, and the browser moves the
    // focus to whatever was pressed right after: take it back once that is done.
    setTimeout(() => {
      input.focus();
      input.select();
    });
  }

  close(): void {
    this.root.hidden = true;
    this.root.replaceChildren();
  }
}
