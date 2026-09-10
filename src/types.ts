export interface Question {
  id: string;
  number: number;
  question: string;
  options: {
    a: string;
    b: string;
    c: string;
    d: string;
  };
  correctAnswer: 'a' | 'b' | 'c' | 'd';
  explanation: string;
  category?: string;
}

export interface Exam {
  id: string;
  code: string; // e.g. "MTK101"
  title: string;
  subject: string;
  grade: string;
  token: string;
  durationMinutes: number;
  questions: Question[];
  isActive: boolean;
  createdAt: string;
}

export interface Student {
  id: string;
  nisn: string;
  name: string;
  class: string;
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
  progress: number;
  answeredCount: number;
  totalQuestions: number;
  status: 'Mengerjakan' | 'Selesai' | 'Terdeteksi Keluar Tab' | 'Terdiskualifikasi';
  tabSwitches: number;
  lastPing: string;
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
  tahunAjaran: string;
  semester: string;
}
