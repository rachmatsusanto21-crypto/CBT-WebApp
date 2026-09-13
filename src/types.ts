export type QuestionType =
  | 'pilihan_ganda'
  | 'pilihan_ganda_kompleks'
  | 'benar_salah'
  | 'isian_singkat'
  | 'uraian';

export type ExamType =
  | 'Penilaian Akhir Bab'
  | 'Penilaian Tengah Semester'
  | 'Asesmen Akhir Semester'
  | 'Ulangan Harian';

export interface Question {
  id: string;
  number: number;
  question: string;
  questionType?: QuestionType;
  imageUrl?: string;
  options: {
    a: string;
    b: string;
    c: string;
    d: string;
    e?: string;
  };
  correctAnswer: string; // 'a'|'b'|'c'|'d' or 'benar'|'salah' or short answer
  correctAnswers?: string[]; // For pilihan_ganda_kompleks: e.g. ['a', 'c']
  explanation: string;
  category?: string;
  // Taksonomi Bloom & Anderson & Penskoran
  cognitiveLevel?: 'C1' | 'C2' | 'C3' | 'C4' | 'C5' | 'C6' | string;
  cognitiveDescription?: string; // Contoh: "C2 - Memahami / Menjelaskan konsep"
  scoreWeight?: number; // Bobot skor maksimal butir soal (misal PG: 1, Isian: 2, Uraian: 4)
  keywords?: string[]; // Kata kunci penilaian otomatis isian singkat dan uraian yang digenerate AI
  competencyIndicator?: string; // Indikator Capaian Pembelajaran untuk Kisi-Kisi
  rubricGuide?: string; // Pedoman penskoran / rubrik penilaian
}

export interface Exam {
  id: string;
  code: string; // e.g. "MTK101"
  title: string;
  subject: string;
  grade: string;
  examType?: ExamType;
  token: string;
  durationMinutes: number;
  questions: Question[];
  isActive: boolean;
  createdAt: string;
}

export interface SavedQuestionPackage {
  id: string;
  title: string;
  subject: string;
  grade: string;
  examType: ExamType;
  topic: string;
  difficulty: string;
  questionCount: number;
  questionType: QuestionType | 'campuran';
  questions: Question[];
  savedAt: string;
  isDeployed?: boolean;
  deployedExamCode?: string;
}

export interface Student {
  id: string;
  nisn: string;
  name: string;
  class: string;
  noAbsen?: number;
  gender?: 'L' | 'P';
  status?: 'Aktif' | 'Non-Aktif';
}

export interface ViolationLog {
  id: string;
  timestamp: string;
  type: string;
  detail: string;
}

export interface MonitoringStudent {
  studentName: string;
  examCode: string;
  className?: string;
  deviceInfo?: string;
  currentQuestion?: number;
  progress: number;
  answeredCount: number;
  totalQuestions: number;
  status: 'Mengerjakan' | 'Selesai' | 'Terdeteksi Keluar Tab' | 'Terdiskualifikasi';
  tabSwitches: number;
  lastPing: string;
  lastPingTimestamp?: number;
  isOnline?: boolean;
  score?: number;
  activeWarning?: string | null;
  pendingCommand?: string | null;
  violationsLog: ViolationLog[];
}

export interface WrongAnswerDetail {
  questionNumber: number;
  question: string;
  studentAnswer: string;
  correctAnswer: string;
  explanation: string;
}

export interface ExamResult {
  id: string;
  timestamp: string;
  studentName: string;
  nisn?: string;
  className?: string;
  examCode: string;
  examTitle: string;
  score: number;
  totalQuestions: number;
  correctCount: number;
  wrongCount: number;
  percentage: string;
  wrongAnswers: WrongAnswerDetail[];
  remedialReport: string;
  tabSwitches: number;
}

export interface SchoolSettings {
  namaPemerintah: string;
  namaDinas: string;
  namaSekolah: string;
  alamatSekolah: string;
  teleponEmail: string;
  kepalaSekolah: string;
  nipKepalaSekolah: string;
  guruPengampu?: string;
  nipGuruPengampu?: string;
  tahunAjaran: string;
  semester: string;
  logoPemdaUrl?: string; // Logo Pemerintah Daerah / Provinsi / Tut Wuri Handayani (Kiri)
  logoSekolahUrl?: string; // Logo Satuan Pendidikan / Sekolah (Kanan)
}

