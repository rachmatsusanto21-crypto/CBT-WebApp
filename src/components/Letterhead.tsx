import React from 'react';
import { SchoolSettings } from '../types';

interface LetterheadProps {
  settings: SchoolSettings;
  subTitle?: string;
  documentTitle?: string;
  examInfo?: {
    mataPelajaran: string;
    kelas: string;
    alokasiWaktu: string;
    hariTanggal: string;
    tahunAjaran: string;
  };
}

export const Letterhead: React.FC<LetterheadProps> = ({
  settings,
  subTitle,
  documentTitle,
  examInfo,
}) => {
  return (
    <div className="w-full text-black">
      {/* Kop Surat Header */}
      <div className="flex items-center justify-between pb-3 border-b-2 border-black">
        {/* Logo Kiri: Logo Pemda / Garuda */}
        <div className="w-20 h-20 flex-shrink-0 flex items-center justify-center">
          <svg viewBox="0 0 100 100" className="w-18 h-18 text-amber-600 fill-current">
            <polygon points="50,5 95,35 75,90 25,90 5,35" fill="none" stroke="currentColor" strokeWidth="4" />
            <circle cx="50" cy="50" r="28" fill="none" stroke="currentColor" strokeWidth="3" />
            <path d="M50,22 L50,78 M22,50 L78,50 M32,32 L68,68 M32,68 L68,32" stroke="currentColor" strokeWidth="2.5" />
            <circle cx="50" cy="50" r="10" fill="currentColor" />
          </svg>
        </div>

        {/* Kop Teks Tengah */}
        <div className="flex-1 text-center px-4">
          <h3 className="text-xs sm:text-sm font-semibold tracking-wider uppercase font-serif">
            {settings.namaPemerintah}
          </h3>
          <h2 className="text-xs sm:text-base font-bold tracking-wide uppercase font-serif">
            {settings.namaDinas}
          </h2>
          <h1 className="text-base sm:text-xl font-black tracking-widest uppercase font-serif text-gray-900 mt-0.5">
            {settings.namaSekolah}
          </h1>
          <p className="text-[11px] sm:text-xs text-gray-700 font-sans mt-1">
            {settings.alamatSekolah}
          </p>
          <p className="text-[10px] sm:text-[11px] text-gray-600 font-sans">
            {settings.teleponEmail}
          </p>
        </div>

        {/* Logo Kanan: Tut Wuri Handayani / Logo Sekolah */}
        <div className="w-20 h-20 flex-shrink-0 flex items-center justify-center">
          <svg viewBox="0 0 100 100" className="w-18 h-18 text-blue-800 fill-current">
            <circle cx="50" cy="50" r="44" fill="none" stroke="currentColor" strokeWidth="4" />
            <polygon points="50,15 85,75 15,75" fill="none" stroke="currentColor" strokeWidth="3.5" />
            <path d="M50,30 L50,65" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" />
            <circle cx="50" cy="40" r="6" fill="currentColor" />
            <path d="M35,62 Q50,72 65,62" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
          </svg>
        </div>
      </div>

      {/* Garis Ganda Khas Surat Resmi Kedinasan */}
      <div className="border-b-[3px] border-black mt-[1.5px]"></div>
      <div className="border-b-[1px] border-black mt-[2px] mb-4"></div>

      {/* Judul Dokumen */}
      {documentTitle && (
        <div className="text-center my-3">
          <h2 className="text-sm sm:text-base font-bold uppercase tracking-wide underline font-serif">
            {documentTitle}
          </h2>
          {subTitle && (
            <p className="text-xs font-semibold text-gray-800 mt-0.5 font-serif">
              {subTitle}
            </p>
          )}
        </div>
      )}

      {/* Info Ujian (Jika ada) */}
      {examInfo && (
        <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs sm:text-[13px] bg-gray-50 border border-gray-300 p-2.5 rounded mb-4 font-sans print:bg-transparent print:p-1.5 print:border-gray-800">
          <div className="flex">
            <span className="w-32 font-semibold">Mata Pelajaran</span>
            <span>: {examInfo.mataPelajaran}</span>
          </div>
          <div className="flex">
            <span className="w-32 font-semibold">Hari / Tanggal</span>
            <span>: {examInfo.hariTanggal || new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</span>
          </div>
          <div className="flex">
            <span className="w-32 font-semibold">Kelas / Jenjang</span>
            <span>: {examInfo.kelas}</span>
          </div>
          <div className="flex">
            <span className="w-32 font-semibold">Alokasi Waktu</span>
            <span>: {examInfo.alokasiWaktu}</span>
          </div>
          <div className="flex">
            <span className="w-32 font-semibold">Tahun Pelajaran</span>
            <span>: {examInfo.tahunAjaran || settings.tahunAjaran}</span>
          </div>
          <div className="flex">
            <span className="w-32 font-semibold">Bentuk Soal</span>
            <span>: Pilihan Ganda (Opsi A - D)</span>
          </div>
        </div>
      )}
    </div>
  );
};
