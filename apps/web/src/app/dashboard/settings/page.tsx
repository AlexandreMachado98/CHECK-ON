'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Building2, Save, CreditCard, Shield, Settings2, Download } from 'lucide-react';

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState('company');

  return (
    <>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Configurações</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Gerencie os dados da sua empresa, faturamento e preferências do sistema.
          </p>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-6">
        {/* Navigation Sidebar */}
        <div className="w-full md:w-64 shrink-0">
          <nav className="flex md:flex-col gap-1 overflow-x-auto pb-2 md:pb-0 custom-scrollbar">
            <button
              onClick={() => setActiveTab('company')}
              className={`flex items-center text-sm font-medium px-4 py-2.5 rounded-lg whitespace-nowrap transition-colors ${
                activeTab === 'company'
                  ? 'bg-primary/10 text-primary'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <Building2 className="mr-2 h-4 w-4" /> Dados da Empresa
            </button>
            <button
              onClick={() => setActiveTab('preferences')}
              className={`flex items-center text-sm font-medium px-4 py-2.5 rounded-lg whitespace-nowrap transition-colors ${
                activeTab === 'preferences'
                  ? 'bg-primary/10 text-primary'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <Settings2 className="mr-2 h-4 w-4" /> Preferências
            </button>
            <button
              onClick={() => setActiveTab('billing')}
              className={`flex items-center text-sm font-medium px-4 py-2.5 rounded-lg whitespace-nowrap transition-colors ${
                activeTab === 'billing'
                  ? 'bg-primary/10 text-primary'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <CreditCard className="mr-2 h-4 w-4" /> Assinatura & Fatura
            </button>
            <button
              onClick={() => setActiveTab('security')}
              className={`flex items-center text-sm font-medium px-4 py-2.5 rounded-lg whitespace-nowrap transition-colors ${
                activeTab === 'security'
                  ? 'bg-primary/10 text-primary'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <Shield className="mr-2 h-4 w-4" /> Segurança
            </button>
          </nav>
        </div>

        {/* Content Area */}
        <div className="flex-1">
          {activeTab === 'company' && (
            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="border-b border-slate-100 pb-4">
                <CardTitle className="text-lg text-slate-800">Perfil da Empresa (Tenant)</CardTitle>
                <CardDescription>Atualize os dados cadastrais que aparecem nos relatórios em PDF.</CardDescription>
              </CardHeader>
              <CardContent className="pt-6 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="companyName">Razão Social</Label>
                    <Input id="companyName" defaultValue="TransLogística S/A" className="bg-slate-50" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cnpj">CNPJ</Label>
                    <Input id="cnpj" defaultValue="12.345.678/0001-99" className="bg-slate-50" />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="address">Endereço Principal</Label>
                    <Input id="address" defaultValue="Av. Paulista, 1000 - São Paulo, SP" className="bg-slate-50" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="contactEmail">E-mail de Contato</Label>
                    <Input id="contactEmail" defaultValue="contato@translogistica.com" className="bg-slate-50" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Telefone</Label>
                    <Input id="phone" defaultValue="(11) 4002-8922" className="bg-slate-50" />
                  </div>
                </div>
              </CardContent>
              <CardFooter className="border-t border-slate-100 pt-4 bg-slate-50/50 flex justify-end">
                <Button className="shadow-sm">
                  <Save className="h-4 w-4 mr-2" /> Salvar Alterações
                </Button>
              </CardFooter>
            </Card>
          )}

          {activeTab === 'billing' && (
            <div className="space-y-6">
              <Card className="border-slate-200 shadow-sm border-primary/20">
                <CardHeader className="pb-4 border-b border-slate-100 bg-slate-50/50">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-lg text-slate-800">Plano Enterprise</CardTitle>
                      <CardDescription className="mt-1">Assinatura ativa. Renovação em 15/12/2026.</CardDescription>
                    </div>
                    <div className="px-3 py-1 bg-emerald-100 text-emerald-800 font-semibold text-xs rounded-full">
                      ATIVO
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-6">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <p className="text-sm text-slate-500 font-medium">Veículos na Frota</p>
                      <p className="text-xl font-bold text-slate-900 mt-1">142 / 500</p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-500 font-medium">Motoristas</p>
                      <p className="text-xl font-bold text-slate-900 mt-1">89 / Ilimitado</p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-500 font-medium">Armazenamento</p>
                      <p className="text-xl font-bold text-slate-900 mt-1">2.4 GB / 50 GB</p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-500 font-medium">Valor Mensal</p>
                      <p className="text-xl font-bold text-slate-900 mt-1">R$ 1.250,00</p>
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="border-t border-slate-100 pt-4 bg-slate-50/50 flex justify-between">
                  <Button variant="outline" className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 border-rose-200">Cancelar Assinatura</Button>
                  <Button variant="outline" className="shadow-sm">Alterar Cartão</Button>
                </CardFooter>
              </Card>

              <Card className="border-slate-200 shadow-sm">
                <CardHeader className="border-b border-slate-100 pb-4">
                  <CardTitle className="text-base text-slate-800">Histórico de Faturas</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="divide-y divide-slate-100">
                    {[
                      { date: '15/11/2026', status: 'Pago', amount: 'R$ 1.250,00' },
                      { date: '15/10/2026', status: 'Pago', amount: 'R$ 1.250,00' },
                      { date: '15/09/2026', status: 'Pago', amount: 'R$ 1.250,00' },
                    ].map((inv, i) => (
                      <div key={i} className="flex justify-between items-center p-4 hover:bg-slate-50 transition-colors">
                        <div className="flex items-center gap-4">
                          <div className="h-10 w-10 bg-slate-100 rounded-lg flex items-center justify-center">
                            <CreditCard className="h-5 w-5 text-slate-400" />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-slate-800">Fatura {inv.date}</p>
                            <p className="text-xs text-emerald-600 font-medium mt-0.5">{inv.status}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <p className="text-sm font-medium text-slate-700">{inv.amount}</p>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-primary">
                            <Download className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {activeTab === 'preferences' && (
            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="border-b border-slate-100 pb-4">
                <CardTitle className="text-lg text-slate-800">Preferências do Sistema</CardTitle>
                <CardDescription>Ajustes de fuso horário, notificações e regras operacionais.</CardDescription>
              </CardHeader>
              <CardContent className="pt-6 space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-semibold text-slate-800">Notificações de NCs Críticas</h4>
                    <p className="text-xs text-slate-500 mt-1">Enviar e-mail para gestores ao identificar falha grave.</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only peer" defaultChecked />
                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                  </label>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-semibold text-slate-800">Bloqueio Automático de Veículo</h4>
                    <p className="text-xs text-slate-500 mt-1">Mudar status da frota se uma NC crítica não for resolvida em 24h.</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only peer" />
                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                  </label>
                </div>
              </CardContent>
            </Card>
          )}

          {activeTab === 'security' && (
            <Card className="border-slate-200 shadow-sm border-rose-200">
              <CardHeader className="border-b border-rose-100 bg-rose-50/30 pb-4">
                <CardTitle className="text-lg text-rose-800">Zona de Perigo</CardTitle>
                <CardDescription>Ações destrutivas que afetam todos os dados da empresa.</CardDescription>
              </CardHeader>
              <CardContent className="pt-6">
                <p className="text-sm text-slate-600 mb-4">
                  Ao excluir a conta da empresa, todos os veículos, checklists, colaboradores e histórico de inspeções serão permanentemente apagados. Esta ação não pode ser desfeita.
                </p>
                <Button variant="destructive" className="shadow-sm">
                  Encerrar Conta e Excluir Dados
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
