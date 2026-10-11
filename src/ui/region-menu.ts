export interface RegionMenuActions {
  onRename: (name: string) => void;
  /** Asks for another suggested name for the region being renamed. */
  suggest: () => string;
}

/** The small box shown when a region's name is clicked: type a new name or ask for another suggestion. */
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
    );
    this.root.hidden = false;
    input.focus();
    input.select();
  }

  close(): void {
    this.root.hidden = true;
    this.root.replaceChildren();
  }
}
