import React, { useState, useEffect } from 'react';
import {
  Key,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Eye,
  EyeOff,
  ExternalLink,
  Save,
  Trash2,
  Server,
  Cpu,
  Globe,
  HelpCircle,
  Zap,
} from 'lucide-react';
import {
  getStoredGeminiApiKey,
  saveStoredGeminiApiKey,
  clearStoredGeminiApiKey,
  verifyGeminiApiKey,
  ApiVerificationResult,
} from '../utils/geminiGenerator';

interface SettingsManagerProps {
  onApiKeyUpdated?: () => void;
}

export const SettingsManager: React.FC<SettingsManagerProps> = ({ onApiKeyUpdated }) => {
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [statusResult, setStatusResult] = useState<ApiVerificationResult | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  // Load existing key from localStorage or VITE env on mount
  useEffect(() => {
    const saved = getStoredGeminiApiKey();
    if (saved) {
      setApiKeyInput(saved);
    }
    // Auto-check status on initial load
    checkStatus(saved);
  }, []);

  const checkStatus = async (keyToTest?: string) => {
    setIsVerifying(true);
    try {
      const res = await verifyGeminiApiKey(keyToTest !== undefined ? keyToTest : apiKeyInput);
      setStatusResult(res);
    } catch (err: any) {
      setStatusResult({
        active: false,
        source: 'none',
        message: err.message || 'Gagal memeriksa status API',
        error: err.message,
      });
    } finally {
      setIsVerifying(false);
    }
  };

  const handleSaveKey = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanKey = apiKeyInput.trim();

    if (!cleanKey) {
      setFeedbackMessage({
        type: 'error',
        text: 'Silakan masukkan Gemini API Key sebelum menyimpan.',
      });
      return;
    }

    saveStoredGeminiApiKey(cleanKey);
    setFeedbackMessage({
      type: 'success',
      text: 'Gemini API Key kustom berhasil disimpan di peramban Anda!',
    });

    if (onApiKeyUpdated) onApiKeyUpdated();

    // Re-verify immediately
    await checkStatus(cleanKey);
  };

  const handleClearKey = async () => {
    clearStoredGeminiApiKey();
    setApiKeyInput('');
    setFeedbackMessage({
      type: 'info',
      text: 'Kunci kustom dihapus. Aplikasi kini menggunakan konfigurasi server bawaan.',
    });

    if (onApiKeyUpdated) onApiKeyUpdated();
    await checkStatus('');
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Header Banner */}
      <div className="bg-white rounded-2xl p-6 sm:p-8 shadow-sm border border-slate-200">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start space-x-4">
            <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 border border-blue-100 shadow-sm">
              <Key className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                Pengaturan API & Kunci Gemini AI
              </h1>
              <p className="text-sm text-slate-500 mt-1 leading-relaxed">
                Verifikasi kredensial Google Gemini AI, atur kunci API kustom, dan panduan mengatasi kendala deployment Vercel & GitHub.
              </p>
            </div>
          </div>

          <button
            onClick={() => checkStatus()}
            disabled={isVerifying}
            className="inline-flex items-center justify-center space-x-2 px-4 py-2.5 rounded-xl text-xs font-semibold bg-slate-900 text-white hover:bg-slate-800 transition-all disabled:opacity-50 shrink-0 shadow-sm"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isVerifying ? 'animate-spin' : ''}`} />
            <span>{isVerifying ? 'Memeriksa...' : 'Uji Koneksi API'}</span>
          </button>
        </div>
      </div>

      {/* Real-time Status Card */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Status Indicator */}
        <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm flex flex-col justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Status Layanan AI</span>
            <div className="mt-2 flex items-center space-x-2">
              {isVerifying ? (
                <>
                  <RefreshCw className="w-5 h-5 text-blue-500 animate-spin" />
                  <span className="text-sm font-bold text-slate-700">Memeriksa Koneksi...</span>
                </>
              ) : statusResult?.active ? (
                <>
                  <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                  <span className="text-sm font-bold text-emerald-700">Aktif & Siap Digunakan</span>
                </>
              ) : (
                <>
                  <AlertCircle className="w-5 h-5 text-rose-500 shrink-0" />
                  <span className="text-sm font-bold text-rose-700">Belum Terhubung / Tidak Aktif</span>
                </>
              )}
            </div>
          </div>
          <p className="text-xs text-slate-500 mt-3 pt-3 border-t border-slate-100">
            {statusResult?.message || 'Klik tombol "Uji Koneksi API" untuk memverifikasi kesiapan server.'}
          </p>
        </div>

        {/* Source of Key */}
        <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm flex flex-col justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Sumber Kunci Aktif</span>
            <div className="mt-2 flex items-center space-x-2">
              {statusResult?.source === 'custom' ? (
                <>
                  <Globe className="w-5 h-5 text-purple-600 shrink-0" />
                  <span className="text-sm font-bold text-slate-800">Kunci Kustom Peramban</span>
                </>
              ) : statusResult?.hasServerKey || statusResult?.source === 'server' ? (
                <>
                  <Server className="w-5 h-5 text-blue-600 shrink-0" />
                  <span className="text-sm font-bold text-slate-800">Server Backend (.env)</span>
                </>
              ) : (
                <>
                  <Cpu className="w-5 h-5 text-slate-400 shrink-0" />
                  <span className="text-sm font-bold text-slate-500">Tidak Ada Kunci Terpasang</span>
                </>
              )}
            </div>
          </div>
          <p className="text-xs text-slate-500 mt-3 pt-3 border-t border-slate-100">
            {statusResult?.source === 'custom'
              ? 'Tersimpan aman di peramban Anda (localStorage).'
              : statusResult?.hasServerKey
              ? 'Tersedia di backend container AI Studio.'
              : 'Perlu memasukkan API Key di bawah ini.'}
          </p>
        </div>

        {/* Model & Latency */}
        <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm flex flex-col justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Model & Kecepatan</span>
            <div className="mt-2 flex items-center space-x-2">
              <Zap className="w-5 h-5 text-amber-500 shrink-0" />
              <span className="text-sm font-bold text-slate-800">
                {statusResult?.model || 'gemini-3.8-flash'}
              </span>
            </div>
          </div>
          <div className="text-xs text-slate-500 mt-3 pt-3 border-t border-slate-100 flex items-center justify-between">
            <span>Latensi Tes:</span>
            <span className="font-semibold text-slate-700">
              {statusResult?.latencyMs ? `${statusResult.latencyMs} ms` : '-'}
            </span>
          </div>
        </div>
      </div>

      {/* Feedback Alert Banner */}
      {feedbackMessage && (
        <div
          className={`p-4 rounded-xl border flex items-center justify-between text-xs sm:text-sm ${
            feedbackMessage.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : feedbackMessage.type === 'error'
              ? 'bg-rose-50 border-rose-200 text-rose-800'
              : 'bg-blue-50 border-blue-200 text-blue-800'
          }`}
        >
          <div className="flex items-center space-x-2">
            {feedbackMessage.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
            {feedbackMessage.type === 'error' && <AlertCircle className="w-4 h-4 text-rose-600" />}
            {feedbackMessage.type === 'info' && <HelpCircle className="w-4 h-4 text-blue-600" />}
            <span>{feedbackMessage.text}</span>
          </div>
          <button
            onClick={() => setFeedbackMessage(null)}
            className="text-xs font-bold underline opacity-70 hover:opacity-100 ml-4"
          >
            Tutup
          </button>
        </div>
      )}

      {/* Custom Key Configuration Form */}
      <div className="bg-white rounded-2xl p-6 sm:p-8 shadow-sm border border-slate-200">
        <div className="max-w-2xl">
          <h2 className="text-base sm:text-lg font-bold text-slate-900 flex items-center space-x-2">
            <Key className="w-4 h-4 text-blue-600" />
            <span>Masukkan Gemini API Key Kustom</span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Jika Anda mengekspor aplikasi ini ke GitHub dan men-deploy di Vercel atau Netlify, masukkan kunci API Anda di sini agar fitur generate soal dan analisis remedial dapat berfungsi secara mandiri tanpa error 404.
          </p>

          <form onSubmit={handleSaveKey} className="mt-5 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Google Gemini API Key
              </label>
              <div className="relative">
                <input
                  type={showKey ? 'text' : 'password'}
                  value={apiKeyInput}
                  onChange={(e) => setApiKeyInput(e.target.value)}
                  placeholder="Contoh: AIzaSyB..."
                  className="w-full text-xs sm:text-sm px-3.5 py-2.5 pr-24 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 font-mono tracking-tight"
                />
                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center space-x-1">
                  <button
                    type="button"
                    onClick={() => setShowKey(!showKey)}
                    className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
                    title={showKey ? 'Sembunyikan' : 'Tampilkan'}
                  >
                    {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div className="flex items-center justify-between mt-2">
                <span className="text-[11px] text-slate-400">
                  Kunci tersimpan secara privat di localStorage peramban Anda.
                </span>
                <a
                  href="https://aistudio.google.com/app/apikey"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11px] text-blue-600 hover:text-blue-700 font-medium inline-flex items-center space-x-1 hover:underline"
                >
                  <span>Dapatkan API Key Gratis</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                type="submit"
                className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold bg-blue-600 text-white hover:bg-blue-700 transition-all shadow-sm"
              >
                <Save className="w-4 h-4" />
                <span>Simpan Kunci API</span>
              </button>

              {apiKeyInput && (
                <button
                  type="button"
                  onClick={handleClearKey}
                  className="inline-flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200 transition-all"
                >
                  <Trash2 className="w-4 h-4 text-rose-500" />
                  <span>Hapus Kunci</span>
                </button>
              )}
            </div>
          </form>
        </div>
      </div>

      {/* Vercel & GitHub Deployment Diagnostics Guide */}
      <div className="bg-slate-900 text-white rounded-2xl p-6 sm:p-8 shadow-sm border border-slate-800">
        <div className="flex items-start space-x-3">
          <div className="w-8 h-8 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center shrink-0 border border-blue-500/30">
            <HelpCircle className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-base sm:text-lg font-bold text-white tracking-tight">
              Panduan Mengatasi Error 404 Saat Deploy di Vercel & GitHub
            </h3>
            <p className="text-xs sm:text-sm text-slate-400 mt-1 leading-relaxed">
              Mengapa di Google AI Studio preview berjalan lancar tanpa error, namun saat di-deploy ke Vercel muncul error 404?
            </p>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs sm:text-sm">
          {/* Box 1: Penyebab */}
          <div className="bg-slate-800/80 rounded-xl p-4 border border-slate-700/60">
            <h4 className="font-semibold text-amber-300 flex items-center space-x-2">
              <span>1. Penyebab Teknis</span>
            </h4>
            <p className="text-slate-300 mt-2 leading-relaxed text-xs">
              Di Google AI Studio, container menjalankan server backend Express (<code className="bg-slate-900 px-1 py-0.5 rounded text-blue-300">server.ts</code>) pada port 3000. Saat di-push ke GitHub dan di-deploy ke Vercel dengan template standar Vite, Vercel hanya menyajikan file statis (<code className="bg-slate-900 px-1 py-0.5 rounded text-blue-300">dist/</code>) tanpa server backend aktif, sehingga pemanggilan ke <code className="bg-slate-900 px-1 py-0.5 rounded text-blue-300">/api/gemini/generate-questions</code> menghasilkan respon <strong>404 Not Found</strong>.
            </p>
          </div>

          {/* Box 2: Solusi Dual-Engine */}
          <div className="bg-slate-800/80 rounded-xl p-4 border border-slate-700/60">
            <h4 className="font-semibold text-emerald-300 flex items-center space-x-2">
              <span>2. Solusi Dual-Engine (Auto-Fallback)</span>
            </h4>
            <p className="text-slate-300 mt-2 leading-relaxed text-xs">
              Aplikasi ini telah diperbarui dengan fitur <strong>Dual-Engine Auto-Fallback</strong>:
              Jika rute server Vercel merespon 404, aplikasi akan <strong>otomatis beralih menggunakan Client-Side Generator langsung di peramban</strong> menggunakan API Key yang Anda simpan di atas atau variabel <code className="bg-slate-900 px-1 py-0.5 rounded text-emerald-300">VITE_GEMINI_API_KEY</code> di Vercel.
            </p>
          </div>
        </div>

        <div className="mt-4 p-4 rounded-xl bg-blue-950/40 border border-blue-800/40">
          <h5 className="text-xs font-bold text-blue-300 uppercase tracking-wider">
            2 Cara Mengaktifkan di Vercel:
          </h5>
          <ul className="mt-2 space-y-2 text-xs text-slate-300 list-disc list-inside leading-relaxed">
            <li>
              <strong>Cara 1 (Instan, Tanpa Redeploy):</strong> Buka halaman aplikasi Anda yang sudah di-deploy di Vercel, masuk ke menu <strong>Mode Guru / Admin &rarr; Pengaturan & API Key</strong>, lalu tempelkan Gemini API Key Anda dan klik <strong>Simpan Kunci API</strong>.
            </li>
            <li>
              <strong>Cara 2 (Permanen di Vercel Environment Variables):</strong> Buka Dashboard Vercel Proyek Anda &rarr; Masuk ke menu <strong>Settings</strong> &rarr; <strong>Environment Variables</strong> &rarr; Tambahkan:
              <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2 font-mono text-[11px]">
                <div className="bg-slate-900 p-2 rounded border border-slate-700 text-blue-300">
                  Key: <strong>GEMINI_API_KEY</strong><br />
                  Value: <em>[Kunci API Anda]</em>
                </div>
                <div className="bg-slate-900 p-2 rounded border border-slate-700 text-emerald-300">
                  Key: <strong>VITE_GEMINI_API_KEY</strong><br />
                  Value: <em>[Kunci API Anda]</em>
                </div>
              </div>
              Kemudian klik tombol <strong>Redeploy</strong> pada deployment terakhir Anda di Vercel.
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
};
