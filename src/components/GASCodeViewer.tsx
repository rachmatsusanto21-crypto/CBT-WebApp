import React, { useState } from 'react';
import { FileCode2, Copy, Check, ExternalLink, FolderGit2, Sparkles, BookOpen } from 'lucide-react';

export const GASCodeViewer: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'Backend.gs' | 'Code.gs' | 'SiswaUI.html' | 'GeminiAI.gs' | 'AdminUI.html'>('Backend.gs');
  const [copied, setCopied] = useState<boolean>(false);

  const scripts = {
    'Backend.gs': `/**
 * Backend.gs - Arsitektur Google Drive & Database Spreadsheet
 * Dijalankan pada Google Apps Script (script.google.com)
 */
const NAMA_APP = "CBT Web App Sekolah";

// Jalankan fungsi ini SEKALI untuk membuat struktur otomatis di Google Drive
function setupDriveDanDatabase() {
  let driveApp = DriveApp;
  let mainFolder = driveApp.createFolder(NAMA_APP + " - Backup");
  
  let folderSoal = mainFolder.createFolder("Data Soal");
  let folderAnalisis = mainFolder.createFolder("Analisis");
  let folderNilai = mainFolder.createFolder("Data Nilai");
  
  // Buat Master Spreadsheet
  let masterSheet = SpreadsheetApp.create("Master Data " + NAMA_APP);
  let file = driveApp.getFileById(masterSheet.getId());
  file.moveTo(mainFolder);
  
  // Setup Sheet di Master
  masterSheet.insertSheet("Data_Siswa");
  masterSheet.insertSheet("Data_Token");
  masterSheet.insertSheet("Log_Monitoring");
  
  // Inisialisasi Header Data Siswa
  let sheetSiswa = masterSheet.getSheetByName("Data_Siswa");
  sheetSiswa.appendRow(["NISN", "Nama Siswa", "Kelas"]);
  sheetSiswa.appendRow(["0071829101", "Ahmad Fauzi Pratama", "X-MIPA 1"]);
  sheetSiswa.appendRow(["0071829102", "Siti Nurhaliza Putri", "X-MIPA 1"]);
  sheetSiswa.appendRow(["0071829103", "Budi Santoso", "X-MIPA 1"]);

  // Simpan ID Folder dan Master Sheet ke Properties
  Logger.log("Setup Selesai. ID Master Sheet: " + masterSheet.getId());
  PropertiesService.getScriptProperties().setProperty("MASTER_SHEET_ID", masterSheet.getId());
  PropertiesService.getScriptProperties().setProperty("FOLDER_NILAI_ID", folderNilai.getId());
}

// Buat Ujian Baru & Spreadsheet Otomatis Sesuai Kode Soal
function buatUjianBaru(kodeSoal, token) {
  let folderNilaiId = PropertiesService.getScriptProperties().getProperty("FOLDER_NILAI_ID");
  let folder = DriveApp.getFolderById(folderNilaiId);
  
  // Buat Sheet Baru khusus ujian ini
  let newSheet = SpreadsheetApp.create("Hasil Ujian - " + kodeSoal);
  let file = DriveApp.getFileById(newSheet.getId());
  file.moveTo(folder);
  
  let sheet = newSheet.getActiveSheet();
  sheet.appendRow(["Timestamp", "Nama Siswa", "Nilai", "Persentase", "Saran Pengayaan / Remedial"]);
  
  // Simpan relasi Kode Soal dan ID Sheet di Master Sheet
  let masterId = PropertiesService.getScriptProperties().getProperty("MASTER_SHEET_ID");
  let masterSheet = SpreadsheetApp.openById(masterId).getSheetByName("Data_Token");
  masterSheet.appendRow([kodeSoal, token, newSheet.getId()]);
  
  return "Berhasil membuat ujian: " + kodeSoal;
}

// Rekam Log Pelanggaran Siswa (Anti-Cheat)
function catatPelanggaran(namaSiswa, jenisPelanggaran) {
  let masterId = PropertiesService.getScriptProperties().getProperty("MASTER_SHEET_ID");
  let sheet = SpreadsheetApp.openById(masterId).getSheetByName("Log_Monitoring");
  sheet.appendRow([new Date(), namaSiswa, jenisPelanggaran, "Terdeteksi oleh Sistem"]);
}

// Update Monitoring Real-Time
function updateMonitoring(namaSiswa, progress, status) {
  let masterId = PropertiesService.getScriptProperties().getProperty("MASTER_SHEET_ID");
  let sheet = SpreadsheetApp.openById(masterId).getSheetByName("Log_Monitoring");
  sheet.appendRow([new Date(), namaSiswa, "Ping Progress: " + progress + "%", status]);
}

// Submit Ujian Siswa dan Simpan Rekomendasi Remedial
function submitUjianSiswa(nama, kodeSoal, nilai, daftarSalah) {
  // 1. Panggil Gemini untuk dapatkan saran remedial
  let saranAI = analisisHasilDanRemedial(nama, daftarSalah);
  
  // 2. Cari ID Spreadsheet untuk Kode Soal tersebut dari Master Sheet
  let masterId = PropertiesService.getScriptProperties().getProperty("MASTER_SHEET_ID");
  let tokenSheet = SpreadsheetApp.openById(masterId).getSheetByName("Data_Token");
  let data = tokenSheet.getDataRange().getValues();
  let sheetId = "";
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === kodeSoal) {
      sheetId = data[i][2];
      break;
    }
  }
  
  // 3. Masukkan data ke Sheet khusus di subfolder "Data Nilai"
  if (sheetId) {
    let sheetTujuan = SpreadsheetApp.openById(sheetId).getActiveSheet();
    sheetTujuan.appendRow([new Date(), nama, nilai, "100%", saranAI]);
  }
  
  // 4. Kembalikan saran AI ke frontend siswa untuk ditampilkan
  return saranAI;
}`,
    'Code.gs': `/**
 * Code.gs - Routing Web App (Mode Admin & Mode Siswa)
 */
function doGet(e) {
  let mode = e.parameter.mode;
  
  if (mode === 'siswa') {
    let template = HtmlService.createTemplateFromFile('SiswaUI');
    // Inject data siswa untuk Dropdown
    template.dataSiswa = ambilDataSiswa(); 
    return template.evaluate()
      .setTitle('Ujian Online - Mode Siswa')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
      .addMetaTag('viewport', 'width=device-width, initial-scale=1');
  } else {
    // Default: Admin Dashboard
    return HtmlService.createHtmlOutputFromFile('AdminUI')
      .setTitle('Admin Dashboard - CBT Web App')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
      .addMetaTag('viewport', 'width=device-width, initial-scale=1');
  }
}

function ambilDataSiswa() {
  let id = PropertiesService.getScriptProperties().getProperty("MASTER_SHEET_ID");
  if (!id) return [["001", "Contoh Siswa", "X-1"]];
  let sheet = SpreadsheetApp.openById(id).getSheetByName("Data_Siswa");
  return sheet.getDataRange().getValues(); // Mengambil data untuk dropdown login
}`,
    'SiswaUI.html': `<!DOCTYPE html>
<html>
<head>
  <base target="_top">
  <title>Ujian Siswa - CBT</title>
  <style>
    body { font-family: system-ui, sans-serif; padding: 20px; background: #0f172a; color: white; }
    .card { background: #1e293b; padding: 24px; border-radius: 12px; max-width: 500px; margin: auto; }
    select, input, button { width: 100%; padding: 12px; margin-top: 10px; border-radius: 8px; border: 1px solid #334155; }
    button { background: #2563eb; color: white; font-weight: bold; cursor: pointer; }
    button:hover { background: #1d4ed8; }
  </style>
</head>
<body>
  <div id="login-section" class="card">
    <h2>Login Ujian Siswa</h2>
    <select id="namaSiswa">
      <option value="">Pilih Nama Anda...</option>
      <!-- Data siswa diinject dari GAS -->
      <? for (var i = 1; i < dataSiswa.length; i++) { ?>
        <option value="<?= dataSiswa[i][1] ?>"><?= dataSiswa[i][1] ?> (<?= dataSiswa[i][2] ?>)</option>
      <? } ?>
    </select>
    <input type="text" id="tokenSoal" placeholder="Masukkan Token Soal (Contoh: CBT2026)">
    <button onclick="mulaiUjian()">Mulai Ujian</button>
  </div>

  <div id="ujian-section" class="card" style="display:none; max-width: 800px;">
    <h3>Ujian Sedang Berlangsung</h3>
    <div id="soal-container"></div>
    <button onclick="selesaiUjian()" style="background:#16a34a;">Submit Ujian</button>
  </div>

  <script>
    let namaSiswaAktif = "";
    
    function mulaiUjian() {
      namaSiswaAktif = document.getElementById("namaSiswa").value;
      if (!namaSiswaAktif) {
        alert("Silakan pilih nama Anda.");
        return;
      }
      document.getElementById("login-section").style.display = "none";
      document.getElementById("ujian-section").style.display = "block";
    }

    // ANTI-CHEAT: Deteksi pindah tab
    document.addEventListener("visibilitychange", function() {
      if (document.hidden && namaSiswaAktif !== "") {
        alert("PERINGATAN ANTI-CHEAT: Anda terdeteksi keluar dari tab ujian!");
        // Kirim log pelanggaran ke backend Google Apps Script
        google.script.run.catatPelanggaran(namaSiswaAktif, "Keluar Tab Browser");
      }
    });

    // Update Monitoring Progress tiap 30 detik
    setInterval(() => {
      if (namaSiswaAktif !== "") {
        let progress = 50; // Rasio soal terjawab
        google.script.run.updateMonitoring(namaSiswaAktif, progress, "Mengerjakan");
      }
    }, 30000);

    function selesaiUjian() {
      let dummySalah = ["Konsep Hukum Newton II", "Perhitungan Gaya Gesek"];
      google.script.run.withSuccessHandler(function(saranAI) {
        alert("Hasil Ujian Diserahkan!\\n\\nSaran Remedial AI:\\n" + saranAI);
      }).submitUjianSiswa(namaSiswaAktif, "MTK101", 80, dummySalah);
    }
  </script>
</body>
</html>`,
    'GeminiAI.gs': `/**
 * GeminiAI.gs - Integrasi Gemini AI API
 * Digunakan untuk:
 * 1. Generate Butir Soal Pilihan Ganda Otomatis
 * 2. Analisis Butir Soal yang Salah & Rekomendasi Remedial
 */
const GEMINI_API_KEY = PropertiesService.getScriptProperties().getProperty("GEMINI_API_KEY") || "MASUKKAN_API_KEY_ANDA_DISINI";

function generateSoalDenganAI(promptTopik, jumlahSoal) {
  let url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=" + GEMINI_API_KEY;
  
  let payload = {
    "contents": [{
      "parts": [{
        "text": "Buat " + jumlahSoal + " butir soal pilihan ganda tentang " + promptTopik + " dalam format JSON array yang berisi properti: pertanyaan, opsi (a, b, c, d), kunci_jawaban, dan penjelasan."
      }]
    }]
  };

  let options = {
    "method": "post",
    "contentType": "application/json",
    "payload": JSON.stringify(payload)
  };

  let response = UrlFetchApp.fetch(url, options);
  let data = JSON.parse(response.getContentText());
  return data.candidates[0].content.parts[0].text; 
}

// Analisis Butir Soal Salah untuk Saran Remedial (Dipanggil saat submit)
function analisisHasilDanRemedial(dataSiswa, soalSalah) {
  let url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=" + GEMINI_API_KEY;
  
  let promptText = "Siswa bernama " + dataSiswa + " salah menjawab konsep berikut: " + soalSalah.join(", ") + ". " +
    "Berikan analisis diagnosa kelemahan konsep, ringkasan materi remedial, dan 2 soal latihan mandiri singkat.";
  
  let payload = {
    "contents": [{
      "parts": [{"text": promptText}]
    }]
  };
  
  let options = {
    "method": "post",
    "contentType": "application/json",
    "payload": JSON.stringify(payload)
  };
  
  let response = UrlFetchApp.fetch(url, options);
  let data = JSON.parse(response.getContentText());
  return data.candidates[0].content.parts[0].text;
}`,
    'AdminUI.html': `<!DOCTYPE html>
<html>
<head>
  <base target="_top">
  <title>Admin Dashboard & Cetak Soal - CBT</title>
  <style>
    body { font-family: system-ui, sans-serif; padding: 20px; background: #f8fafc; }
    
    /* Sembunyikan Kop di layar, Tampilkan di Kertas Cetak */
    .kop-surat { display: none; }
    
    @media print {
      body { font-family: 'Times New Roman', Times, serif; background: white; }
      .no-print { display: none; } /* Sembunyikan tombol saat cetak */
      .kop-surat {
        display: flex;
        align-items: center;
        justify-content: space-between;
        border-bottom: 3px double black;
        padding-bottom: 10px;
        margin-bottom: 20px;
      }
      .kop-teks { text-align: center; width: 100%; }
      .kop-teks h2 { margin: 0; font-size: 14pt; }
      .kop-teks h1 { margin: 2px 0; font-size: 16pt; font-weight: bold; }
      .kop-teks p { margin: 0; font-size: 10pt; }
    }
  </style>
</head>
<body>
  <div class="no-print">
    <h2>Admin Dashboard CBT</h2>
    <p>Gunakan tombol cetak di bawah untuk menghasilkan soal dengan kop surat otomatis.</p>
    <button onclick="window.print()" style="padding: 10px 18px; background: #059669; color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: bold;">
      🖨️ Cetak Soal (Kop Surat Otomatis)
    </button>
  </div>

  <!-- KOP SURAT RESMI -->
  <div class="kop-surat">
    <div class="kop-teks">
      <h2>PEMERINTAH PROVINSI DAERAH KHUSUS IBUKOTA JAKARTA</h2>
      <h3>DINAS PENDIDIKAN DAN KEBUDAYAAN</h3>
      <h1>SMA NEGERI 1 TELADAN JAKARTA</h1>
      <p>Jl. Budi Utomo No. 7, Pasar Baru, Sawah Besar, Jakarta Pusat 10710</p>
    </div>
  </div>

  <div class="soal-container">
    <h3>Naskah Soal Penilaian Harian (Matematika)</h3>
    <ol>
      <li>Himpunan penyelesaian dari sistem persamaan linear dua variabel 2x + 3y = 8 dan x - 2y = -3 adalah...</li>
      <li>Nilai x yang memenuhi pertidaksamaan linear |2x - 5| < 7 adalah...</li>
    </ol>
  </div>
</body>
</html>`,
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(scripts[activeTab]);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center space-x-2">
            <FileCode2 className="w-6 h-6 text-orange-600" />
            <span>Kode Google Apps Script (GAS) & Arsitektur Drive</span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Salin langsung seluruh file kode Google Apps Script untuk di-deploy ke script.google.com dengan Google Drive & Spreadsheet.
          </p>
        </div>

        <button
          onClick={handleCopy}
          className="flex items-center space-x-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs sm:text-sm font-semibold px-4 py-2 rounded-xl shadow transition-all"
        >
          {copied ? (
            <>
              <Check className="w-4 h-4 text-emerald-400" />
              <span>Tersalin ke Clipboard!</span>
            </>
          ) : (
            <>
              <Copy className="w-4 h-4" />
              <span>Salin File {activeTab}</span>
            </>
          )}
        </button>
      </div>

      {/* Guide Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-1">
          <p className="font-bold text-slate-900 flex items-center space-x-1.5">
            <FolderGit2 className="w-4 h-4 text-blue-600" />
            <span>1. Inisialisasi Drive</span>
          </p>
          <p className="text-slate-500">
            Jalankan <code className="bg-slate-100 px-1 py-0.5 rounded font-mono text-blue-700">setupDriveDanDatabase()</code> sekali untuk otomatis membuat folder Backup, Data Soal, dan Master Sheet di Google Drive.
          </p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-1">
          <p className="font-bold text-slate-900 flex items-center space-x-1.5">
            <BookOpen className="w-4 h-4 text-purple-600" />
            <span>2. Routing Dual Mode</span>
          </p>
          <p className="text-slate-500">
            Gunakan URL Web App standar untuk Guru/Admin, dan tambahkan parameter <code className="bg-slate-100 px-1 py-0.5 rounded font-mono text-purple-700">?mode=siswa</code> untuk portal login siswa.
          </p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-1">
          <p className="font-bold text-slate-900 flex items-center space-x-1.5">
            <Sparkles className="w-4 h-4 text-amber-600" />
            <span>3. Anti-Cheat & Remedial AI</span>
          </p>
          <p className="text-slate-500">
            JavaScript mendeteksi <code className="bg-slate-100 px-1 py-0.5 rounded font-mono text-amber-700">visibilitychange</code> seketika saat keluar tab, dan Gemini AI membuatkan rangkuman remedial pasca-submit.
          </p>
        </div>
      </div>

      {/* Code Viewer Box */}
      <div className="bg-slate-900 rounded-2xl border border-slate-800 shadow-xl overflow-hidden">
        {/* Tabs Bar */}
        <div className="flex overflow-x-auto border-b border-slate-800 bg-slate-950/60 p-2 space-x-2">
          {(['Backend.gs', 'Code.gs', 'SiswaUI.html', 'GeminiAI.gs', 'AdminUI.html'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition-all ${
                activeTab === tab
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Code Content */}
        <pre className="p-5 text-xs font-mono text-slate-200 overflow-x-auto max-h-[500px] leading-relaxed select-all">
          <code>{scripts[activeTab]}</code>
        </pre>
      </div>
    </div>
  );
};
