import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  // The scripts are run by hand with Node, not built or shipped.
  { ignores: ['dist', 'scripts'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  prettier,
);
