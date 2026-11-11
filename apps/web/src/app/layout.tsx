import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'CHECK-ON Plataforma',
  description: 'Gestão de Frota e Checklists',
  // O painel já é em português. Se o Chrome traduzir a página, o tradutor troca os textos por
  // elementos dele e o React quebra ao atualizar a tela ("Application error").
  other: { google: 'notranslate' },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" translate="no" className="notranslate">
      <body className="font-sans">
        {children}
      </body>
    </html>
  );
}

