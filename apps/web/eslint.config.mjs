import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';

// Next 16: o `next lint` saiu; o ESLint 9 usa a configuração "flat" que o eslint-config-next exporta.
const config = [
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // Estado regravado dentro de efeito causa renderização em cascata (tela piscando, busca dupla).
      // As telas foram migradas (dados em .then, valores derivados na renderização, useSyncExternalStore
      // para o navegador): agora é erro, para não voltar. Exceção legítima vai comentada na linha.
      'react-hooks/set-state-in-effect': 'error',
      // As fotos já chegam redimensionadas pela API (?w=320 / ?w=900, ver lib/photo-url): o <Image>
      // do Next otimizaria de novo, com custo na Vercel e configuração de domínio. <img> é de propósito.
      '@next/next/no-img-element': 'off',
    },
  },
  { ignores: ['.next/**', 'node_modules/**', 'next-env.d.ts'] },
];

export default config;
