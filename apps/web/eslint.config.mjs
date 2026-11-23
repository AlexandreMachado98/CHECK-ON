import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';

// Next 16: o `next lint` saiu; o ESLint 9 usa a configuração "flat" que o eslint-config-next exporta.
const config = [
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // Regra nova do React 19 (eslint-plugin-react-hooks 6): aponta o padrão "carrega os dados no
      // useEffect e guarda no estado", usado nas telas do portal. Funciona; fica como aviso até as
      // telas migrarem para outro jeito de buscar dados.
      'react-hooks/set-state-in-effect': 'warn',
    },
  },
  { ignores: ['.next/**', 'node_modules/**', 'next-env.d.ts'] },
];

export default config;
