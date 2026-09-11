import React from 'react';
import { ShieldAlert, BookOpen, GraduationCap, Users, Sparkles, Printer, FileCode2, BarChart2, Archive, UserCheck, Key } from 'lucide-react';

interface NavbarProps {
  currentMode: 'siswa' | 'admin';
  setMode: (mode: 'siswa' | 'admin') => void;
  adminTab: 'monitoring' | 'bank-soal' | 'riwayat-soal' | 'data-siswa' | 'cetak' | 'rekap' | 'gas' | 'settings';
  setAdminTab: (tab: 'monitoring' | 'bank-soal' | 'riwayat-soal' | 'data-siswa' | 'cetak' | 'rekap' | 'gas' | 'settings') => void;
  schoolName: string;
  activeViolationsCount?: number;
  savedPackagesCount?: number;
  studentsCount?: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentMode,
  setMode,
  adminTab,
  setAdminTab,
  schoolName,
  activeViolationsCount = 0,
  savedPackagesCount = 0,
  studentsCount = 0,
}) => {
  return (
    <header className="no-print bg-slate-900 text-white shadow-md border-b border-slate-800 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo and Brand */}
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center shadow-inner">
              <GraduationCap className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-bold text-base tracking-tight text-white">CBT Web App</span>
                <span className="text-[10px] uppercase font-semibold tracking-wider bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded border border-blue-400/30">
                  AI & Anti-Cheat
                </span>
              </div>
              <p className="text-xs text-slate-400 truncate max-w-[220px] sm:max-w-xs">{schoolName}</p>
            </div>
          </div>

          {/* Mode Switcher */}
          <div className="flex items-center space-x-2 sm:space-x-4">
            <div className="bg-slate-800/90 p-1 rounded-xl border border-slate-700 flex items-center">
              <button
                onClick={() => {
                  setMode('siswa');
                  const url = new URL(window.location.href);
                  url.searchParams.set('mode', 'siswa');
                  window.history.pushState({}, '', url.toString());
                }}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  currentMode === 'siswa'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-300 hover:text-white hover:bg-slate-700/60'
                }`}
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>Mode Siswa</span>
              </button>

              <button
                onClick={() => {
                  setMode('admin');
                  const url = new URL(window.location.href);
                  url.searchParams.delete('mode');
                  window.history.pushState({}, '', url.toString());
                }}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  currentMode === 'admin'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-300 hover:text-white hover:bg-slate-700/60'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>Mode Guru / Admin</span>
              </button>
            </div>
          </div>
        </div>

        {/* Secondary Navigation for Admin Mode */}
        {currentMode === 'admin' && (
          <div className="flex overflow-x-auto space-x-1 py-2 border-t border-slate-800 text-xs scrollbar-none">
            <button
              onClick={() => setAdminTab('monitoring')}
              className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors font-medium ${
                adminTab === 'monitoring'
                  ? 'bg-slate-800 text-blue-400 border border-slate-700'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
              <span>Monitoring Real-Time</span>
              {activeViolationsCount > 0 && (
                <span className="ml-1 px-1.5 py-0.2 text-[10px] font-bold bg-rose-500/20 text-rose-300 rounded-full border border-rose-500/30 animate-pulse">
                  {activeViolationsCount}
                </span>
              )}
            </button>

            <button
              onClick={() => setAdminTab('bank-soal')}
              className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors font-medium ${
                adminTab === 'bank-soal'
                  ? 'bg-slate-800 text-blue-400 border border-slate-700'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-purple-400" />
              <span>Bank Soal & AI Generator</span>
            </button>

            <button
              onClick={() => setAdminTab('riwayat-soal')}
              className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors font-medium ${
                adminTab === 'riwayat-soal'
                  ? 'bg-slate-800 text-blue-400 border border-slate-700'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <Archive className="w-3.5 h-3.5 text-indigo-400" />
              <span>Riwayat & Deploy Soal</span>
              {savedPackagesCount > 0 && (
                <span className="ml-1 px-1.5 py-0.2 text-[10px] font-bold bg-indigo-500/20 text-indigo-300 rounded-full border border-indigo-500/30">
                  {savedPackagesCount}
                </span>
              )}
            </button>

            <button
              onClick={() => setAdminTab('data-siswa')}
              className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors font-medium ${
                adminTab === 'data-siswa'
                  ? 'bg-slate-800 text-blue-400 border border-slate-700'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <UserCheck className="w-3.5 h-3.5 text-cyan-400" />
              <span>Data Siswa</span>
              {studentsCount > 0 && (
                <span className="ml-1 px-1.5 py-0.2 text-[10px] font-bold bg-cyan-500/20 text-cyan-300 rounded-full border border-cyan-500/30">
                  {studentsCount}
                </span>
              )}
            </button>

            <button
              onClick={() => setAdminTab('cetak')}
              className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors font-medium ${
                adminTab === 'cetak'
                  ? 'bg-slate-800 text-blue-400 border border-slate-700'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <Printer className="w-3.5 h-3.5 text-emerald-400" />
              <span>Cetak Soal Kop Surat</span>
            </button>

            <button
              onClick={() => setAdminTab('rekap')}
              className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors font-medium ${
                adminTab === 'rekap'
                  ? 'bg-slate-800 text-blue-400 border border-slate-700'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <BarChart2 className="w-3.5 h-3.5 text-blue-400" />
              <span>Rekap Nilai & Remedial</span>
            </button>

            <button
              onClick={() => setAdminTab('gas')}
              className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors font-medium ${
                adminTab === 'gas'
                  ? 'bg-slate-800 text-blue-400 border border-slate-700'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <FileCode2 className="w-3.5 h-3.5 text-orange-400" />
              <span>Kode GAS</span>
            </button>

            <button
              onClick={() => setAdminTab('settings')}
              className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors font-medium ${
                adminTab === 'settings'
                  ? 'bg-slate-800 text-amber-400 border border-slate-700 font-semibold'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <Key className="w-3.5 h-3.5 text-amber-400" />
              <span>Pengaturan & API Key</span>
            </button>
          </div>
        )}
      </div>
    </header>
  );
};

