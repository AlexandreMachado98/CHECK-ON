'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Building2, Save, CreditCard, Shield, Settings2, Download, CheckCircle2, AlertTriangle } from 'lucide-react';
import api from '@/lib/api';

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState('company');
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [companyData, setCompanyData] = useState({
    companyName: 'CHECK-ON Logística & Transportes',
    cnpj: '12.345.678/0001-99',
    address: 'Av. Paulista, 1000 - São Paulo, SP',
    contactEmail: 'admin@checkon.com',
    phone: '(11) 4002-8922',
  });
  const [preferences, setPreferences] = useState({
    ncNotifications: true,
    autoBlockVehicle: false,
  });
  const [vehicleCount, setVehicleCount] = useState(0);

  useEffect(() => {
    // Load stored user & tenant info if available
    const storedUser = localStorage.getItem('checkon_user');
    if (storedUser) {
      try {
        const u = JSON.parse(storedUser);
        setCompanyData(prev => ({
          ...prev,
          contactEmail: u.email || prev.contactEmail,
          companyName: u.tenantName || prev.companyName,
        }));
      } catch (e) {
        console.error(e);
      }
    }

    // Load saved preferences
    const savedPrefs = localStorage.getItem('checkon_preferences');
    if (savedPrefs) {
      try {
        setPreferences(JSON.parse(savedPrefs));
      } catch (e) {
        console.error(e);
      }
    }

    // Fetch vehicle count
    api.get('/vehicles').then(res => {
      if (Array.isArray(res.data)) {
        setVehicleCount(res.data.length);
      }
    }).catch(() => {});
  }, []);

  const handleSaveCompany = (e: React.FormEvent) => {
    e.preventDefault();
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  const handleTogglePreference = (key: 'ncNotifications' | 'autoBlockVehicle') => {
    const updated = { ...preferences, [key]: !preferences[key] };
    setPreferences(updated);
    localStorage.setItem('checkon_preferences', JSON.stringify(updated));
  };

  return (
    <>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Configurações</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Gerencie os dados da sua empresa, faturamento e preferências do sistema.
          </p>
        </div>
        {savedSuccess && (
          <div className="flex items-center gap-2 text-sm bg-emerald-50 text-emerald-700 px-3.5 py-1.5 rounded-lg border border-emerald-200 animate-in fade-in">
            <CheckCircle2 className="h-4 w-4" />
            Configurações salvas com sucesso!
          </div>
        )}
      </div>

      <div className="flex flex-col md:flex-row gap-6">
        {/* Navigation Sidebar */}
        <div className="w-full md:w-64 shrink-0">
          <nav className="flex md:flex-col gap-1 overflow-x-auto pb-2 md:pb-0 custom-scrollbar">
            <button
              onClick={() => setActiveTab('company')}
              className={`flex items-center text-sm font-medium px-4 py-2.5 rounded-lg whitespace-nowrap transition-colors ${
                activeTab === 'company'
                  ? 'bg-primary/10 text-primary font-semibold'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <Building2 className="mr-2 h-4 w-4" /> Dados da Empresa
            </button>
            <button
              onClick={() => setActiveTab('preferences')}
              className={`flex items-center text-sm font-medium px-4 py-2.5 rounded-lg whitespace-nowrap transition-colors ${
                activeTab === 'preferences'
                  ? 'bg-primary/10 text-primary font-semibold'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <Settings2 className="mr-2 h-4 w-4" /> Preferências
            </button>
            <button
              onClick={() => setActiveTab('billing')}
              className={`flex items-center text-sm font-medium px-4 py-2.5 rounded-lg whitespace-nowrap transition-colors ${
                activeTab === 'billing'
                  ? 'bg-primary/10 text-primary font-semibold'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <CreditCard className="mr-2 h-4 w-4" /> Assinatura & Fatura
            </button>
            <button
              onClick={() => setActiveTab('security')}
              className={`flex items-center text-sm font-medium px-4 py-2.5 rounded-lg whitespace-nowrap transition-colors ${
                activeTab === 'security'
                  ? 'bg-primary/10 text-primary font-semibold'
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
              <form onSubmit={handleSaveCompany}>
                <CardHeader className="border-b border-slate-100 pb-4">
                  <CardTitle className="text-lg text-slate-800">Perfil da Empresa (Tenant)</CardTitle>
                  <CardDescription>Atualize os dados cadastrais que aparecem nos relatórios em PDF.</CardDescription>
                </CardHeader>
                <CardContent className="pt-6 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="companyName">Razão Social</Label>
                      <Input
                        id="companyName"
                        value={companyData.companyName}
                        onChange={e => setCompanyData({ ...companyData, companyName: e.target.value })}
                        className="bg-slate-50"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="cnpj">CNPJ</Label>
                      <Input
                        id="cnpj"
                        value={companyData.cnpj}
                        onChange={e => setCompanyData({ ...companyData, cnpj: e.target.value })}
                        className="bg-slate-50"
                        required
                      />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="address">Endereço Principal</Label>
                      <Input
                        id="address"
                        value={companyData.address}
                        onChange={e => setCompanyData({ ...companyData, address: e.target.value })}
                        className="bg-slate-50"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="contactEmail">E-mail de Contato</Label>
                      <Input
                        id="contactEmail"
                        type="email"
                        value={companyData.contactEmail}
                        onChange={e => setCompanyData({ ...companyData, contactEmail: e.target.value })}
                        className="bg-slate-50"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phone">Telefone</Label>
                      <Input
                        id="phone"
                        value={companyData.phone}
                        onChange={e => setCompanyData({ ...companyData, phone: e.target.value })}
                        className="bg-slate-50"
                      />
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="border-t border-slate-100 pt-4 bg-slate-50/50 flex justify-end">
                  <Button type="submit" className="shadow-sm">
                    <Save className="h-4 w-4 mr-2" /> Salvar Alterações
                  </Button>
                </CardFooter>
              </form>
            </Card>
          )}

          {activeTab === 'billing' && (
            <div className="space-y-6">
              <Card className="border-slate-200 shadow-sm border-primary/20">
                <CardHeader className="pb-4 border-b border-slate-100 bg-slate-50/50">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-lg text-slate-800">Plano Enterprise Pro</CardTitle>
                      <CardDescription className="mt-1">Assinatura corporativa ativa com suporte 24/7.</CardDescription>
                    </div>
                    <div className="px-3 py-1 bg-emerald-100 text-emerald-800 font-semibold text-xs rounded-full">
                      ATIVO
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-6">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <p className="text-sm text-slate-500 font-medium">Veículos Cadastrados</p>
                      <p className="text-xl font-bold text-slate-900 mt-1">{vehicleCount} ativos</p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-500 font-medium">Colaboradores</p>
                      <p className="text-xl font-bold text-slate-900 mt-1">Ilimitado</p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-500 font-medium">Checklists Executados</p>
                      <p className="text-xl font-bold text-slate-900 mt-1">Sem limite</p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-500 font-medium">Status da Conta</p>
                      <p className="text-xl font-bold text-emerald-600 mt-1">Regular</p>
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="border-t border-slate-100 pt-4 bg-slate-50/50 flex justify-between">
                  <Button
                    variant="outline"
                    className="text-slate-600 hover:bg-slate-100"
                    onClick={() => alert('Para gerenciar seu faturamento ou solicitar alteração de plano, contate suporte@checkon.com')}
                  >
                    Gerenciar Plano
                  </Button>
                  <Button
                    variant="outline"
                    className="shadow-sm"
                    onClick={() => alert('Informações de cobrança atualizadas via gateway de pagamento seguro.')}
                  >
                    Dados de Cobrança
                  </Button>
                </CardFooter>
              </Card>

              <Card className="border-slate-200 shadow-sm">
                <CardHeader className="border-b border-slate-100 pb-4">
                  <CardTitle className="text-base text-slate-800">Faturas Recentes</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="divide-y divide-slate-100">
                    {[
                      { date: '01/10/2026', status: 'Processado', amount: 'R$ 890,00' },
                      { date: '01/09/2026', status: 'Processado', amount: 'R$ 890,00' },
                      { date: '01/08/2026', status: 'Processado', amount: 'R$ 890,00' },
                    ].map((inv, i) => (
                      <div key={i} className="flex justify-between items-center p-4 hover:bg-slate-50 transition-colors">
                        <div className="flex items-center gap-4">
                          <div className="h-10 w-10 bg-slate-100 rounded-lg flex items-center justify-center">
                            <CreditCard className="h-5 w-5 text-slate-400" />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-slate-800">Mensalidade {inv.date}</p>
                            <p className="text-xs text-emerald-600 font-medium mt-0.5">{inv.status}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <p className="text-sm font-medium text-slate-700">{inv.amount}</p>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-slate-400 hover:text-primary"
                            onClick={() => alert(`Download do comprovante fiscal referente a ${inv.date} iniciado.`)}
                          >
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
                <CardTitle className="text-lg text-slate-800">Preferências Operacionais</CardTitle>
                <CardDescription>Ajustes de notificações e regras de bloqueio de conformidade.</CardDescription>
              </CardHeader>
              <CardContent className="pt-6 space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-semibold text-slate-800">Notificações de NCs Críticas</h4>
                    <p className="text-xs text-slate-500 mt-1">Enviar alerta operacional em tempo real ao identificar falha de segurança.</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      className="sr-only peer"
                      checked={preferences.ncNotifications}
                      onChange={() => handleTogglePreference('ncNotifications')}
                    />
                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                  </label>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-semibold text-slate-800">Bloqueio Automático de Veículo</h4>
                    <p className="text-xs text-slate-500 mt-1">Mudar status da frota para &quot;MANUTENÇÃO&quot; se uma NC crítica não for resolvida.</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      className="sr-only peer"
                      checked={preferences.autoBlockVehicle}
                      onChange={() => handleTogglePreference('autoBlockVehicle')}
                    />
                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                  </label>
                </div>
              </CardContent>
            </Card>
          )}

          {activeTab === 'security' && (
            <Card className="border-slate-200 shadow-sm border-rose-200">
              <CardHeader className="border-b border-rose-100 bg-rose-50/30 pb-4">
                <CardTitle className="text-lg text-rose-800 flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-rose-600" />
                  Zona de Segurança Operacional
                </CardTitle>
                <CardDescription>Ações restritas para administradores do Tenant.</CardDescription>
              </CardHeader>
              <CardContent className="pt-6">
                <p className="text-sm text-slate-600 mb-4">
                  Para reiniciar tokens de API ou revogar acessos de todos os colaboradores simultaneamente, utilize a opção abaixo.
                </p>
                <Button
                  variant="outline"
                  className="border-rose-300 text-rose-700 hover:bg-rose-50"
                  onClick={() => {
                    if (confirm('Deseja realmente revogar todas as sessões ativas? Todos os usuários precisarão fazer login novamente.')) {
                      alert('Todas as sessões de operadores foram revogadas com sucesso.');
                    }
                  }}
                >
                  Revogar Todas as Sessões Ativas
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}

