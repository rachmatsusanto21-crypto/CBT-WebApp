import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import { GoogleGenAI, Type } from "@google/genai";
import { initialExams, initialStudents, initialSchoolSettings } from "./src/initialData";
import { Exam, Student, SchoolSettings, MonitoringStudent, ExamResult, Question } from "./src/types";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "10mb" }));

// In-Memory Database
let exams: Exam[] = [...initialExams];
let students: Student[] = [...initialStudents];
let schoolSettings: SchoolSettings = { ...initialSchoolSettings };
let monitoringList: Map<string, MonitoringStudent> = new Map();
let examResults: ExamResult[] = [];

// Initialize AI Client
const apiKey = process.env.GEMINI_API_KEY;
const ai = new GoogleGenAI({
  apiKey: apiKey,
  httpOptions: {
    headers: {
      "User-Agent": "aistudio-build",
    },
  },
});

// Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Initial state
app.get("/api/initial-state", (req, res) => {
  res.json({
    exams,
    students,
    schoolSettings,
    monitoring: Array.from(monitoringList.values()),
    results: examResults,
  });
});

// Update school settings
app.put("/api/settings", (req, res) => {
  try {
    const updated = req.body;
    schoolSettings = { ...schoolSettings, ...updated };
    res.json({ success: true, schoolSettings });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Add student
app.post("/api/students", (req, res) => {
  try {
    const { name, nisn, className } = req.body;
    if (!name) {
      return res.status(400).json({ error: "Nama siswa wajib diisi" });
    }
    const newStudent: Student = {
      id: "std-" + Date.now(),
      name,
      nisn: nisn || "00" + Math.floor(10000000 + Math.random() * 90000000),
      class: className || "X-MIPA 1",
    };
    students.push(newStudent);
    res.json({ success: true, student: newStudent });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Create exam
app.post("/api/exams", (req, res) => {
  try {
    const newExam: Exam = req.body;
    if (!newExam.code || !newExam.token || !newExam.title) {
      return res.status(400).json({ error: "Kode soal, token, dan judul wajib diisi" });
    }
    newExam.id = "exam-" + Date.now();
    newExam.createdAt = new Date().toISOString();
    newExam.isActive = true;
    exams.unshift(newExam);
    res.json({ success: true, exam: newExam });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Real-time monitoring ping
app.post("/api/monitoring/ping", (req, res) => {
  try {
    const { studentName, examCode, progress, answeredCount, totalQuestions, status } = req.body;
    const key = `${studentName}_${examCode}`;
    const existing = monitoringList.get(key);

    const updated: MonitoringStudent = {
      studentName,
      examCode,
      progress: typeof progress === "number" ? Math.min(100, Math.max(0, Math.round(progress))) : 0,
      answeredCount: answeredCount || 0,
      totalQuestions: totalQuestions || 0,
      status: status || (existing?.status === "Terdiskualifikasi" ? "Terdiskualifikasi" : "Mengerjakan"),
      tabSwitches: existing ? existing.tabSwitches : 0,
      lastPing: new Date().toLocaleTimeString("id-ID"),
      violationsLog: existing ? existing.violationsLog : [],
    };

    monitoringList.set(key, updated);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Anti-Cheat: Record violation
app.post("/api/monitoring/violation", (req, res) => {
  try {
    const { studentName, examCode, violationType, detail } = req.body;
    const key = `${studentName}_${examCode}`;
    let student = monitoringList.get(key);

    const now = new Date();
    const timeStr = now.toLocaleTimeString("id-ID");

    const violation = {
      id: "v-" + Date.now(),
      timestamp: timeStr,
      type: violationType || "Keluar Tab",
      detail: detail || "Terdeteksi beralih dari jendela/tab ujian CBT",
    };

    if (student) {
      student.tabSwitches += 1;
      student.status = "Terdeteksi Keluar Tab";
      student.lastPing = timeStr;
      student.violationsLog.unshift(violation);
    } else {
      student = {
        studentName,
        examCode,
        progress: 0,
        answeredCount: 0,
        totalQuestions: 0,
        status: "Terdeteksi Keluar Tab",
        tabSwitches: 1,
        lastPing: timeStr,
        violationsLog: [violation],
      };
      monitoringList.set(key, student);
    }

    res.json({ success: true, tabSwitches: student.tabSwitches, violation });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Admin reset or clear monitoring
app.post("/api/monitoring/reset", (req, res) => {
  try {
    const { studentName, examCode } = req.body;
    const key = `${studentName}_${examCode}`;
    const student = monitoringList.get(key);
    if (student) {
      student.status = "Mengerjakan";
      res.json({ success: true, student });
    } else {
      res.status(404).json({ error: "Siswa tidak ditemukan dalam monitoring" });
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Get active monitoring
app.get("/api/monitoring", (req, res) => {
  res.json({
    students: Array.from(monitoringList.values()),
    timestamp: new Date().toISOString(),
  });
});

// Submit Exam & Remedial Recommendation (Gemini AI)
app.post("/api/submit-exam", async (req, res) => {
  try {
    const {
      studentName,
      nisn,
      className,
      examCode,
      examTitle,
      score,
      totalQuestions,
      correctCount,
      wrongCount,
      percentage,
      wrongAnswers,
      tabSwitches,
    } = req.body;

    let remedialReport = "";

    // Generate AI Remedial Analysis if there are wrong answers and API key exists
    if (wrongAnswers && wrongAnswers.length > 0 && apiKey) {
      try {
        const wrongListText = wrongAnswers
          .map(
            (w: any, idx: number) =>
              `${idx + 1}. Soal: "${w.question}" | Jawaban Siswa: "${w.studentAnswer}" | Jawaban Benar: "${w.correctAnswer}" | Konsep: "${w.explanation || ''}"`
          )
          .join("\n");

        const prompt = `Sebagai Guru & Pakar Evaluasi Pendidikan Indonesia, buatlah analisis remedial dan pengayaan yang mendalam, edukatif, dan menyemangati untuk siswa berikut:
Nama Siswa: ${studentName}
Mata Pelajaran / Ujian: ${examTitle} (${examCode})
Skor: ${score} / 100 (${correctCount} benar dari ${totalQuestions} soal)

Daftar Soal yang Salah Dijawab oleh Siswa:
${wrongListText}

Berikan respon terstruktur dengan format Markdown yang rapi dalam Bahasa Indonesia:
### 1. 🔍 Diagnosa Kelemahan Konsep
(Analisis letak miskonsepsi atau materi yang belum dikuasai)

### 2. 📖 Rangkuman Materi Kunci & Trik Pemahaman
(Jelaskan secara ringkas konsep esensial dan rumus/cara pengerjaan yang benar agar siswa mengerti mengapa jawaban aslinya keliru)

### 3. ✍️ 2 Contoh Soal Remedial Mandiri + Kunci & Pembahasan Singkat
(Buatkan 2 soal baru yang setara untuk latihan pemulihan mandiri)

### 4. 🌟 Pesan Motivasi Guru
(Kalimat apresiasi atas usaha siswa dan motivasi positif untuk terus belajar)`;

        const geminiRes = await ai.models.generateContent({
          model: "gemini-3.8-flash",
          contents: prompt,
        });

        remedialReport = geminiRes.text || "Analisis remedial telah disiapkan.";
      } catch (aiErr: any) {
        console.error("Gemini Remedial error:", aiErr);
        remedialReport = `Catatan Guru: Siswa perlu mengulang konsep pada ${wrongAnswers.length} soal yang belum tepat, khususnya materi dasar dan ketelitian pengerjaan.`;
      }
    } else if (wrongAnswers && wrongAnswers.length === 0) {
      remedialReport = `🎉 Selamat ${studentName}! Nilai Anda sempurna (100). Pertahankan prestasi ini dan silakan pelajari materi pengayaan tingkat lanjut untuk memperluas wawasan!`;
    }

    const result: ExamResult = {
      id: "res-" + Date.now(),
      timestamp: new Date().toLocaleString("id-ID"),
      studentName,
      nisn: nisn || "-",
      className: className || "-",
      examCode,
      examTitle,
      score,
      totalQuestions,
      correctCount,
      wrongCount,
      percentage: percentage || `${Math.round((correctCount / totalQuestions) * 100)}%`,
      wrongAnswers: wrongAnswers || [],
      remedialReport,
      tabSwitches: tabSwitches || 0,
    };

    examResults.unshift(result);

    // Update monitoring status to 'Selesai'
    const key = `${studentName}_${examCode}`;
    const mon = monitoringList.get(key);
    if (mon) {
      mon.status = "Selesai";
      mon.progress = 100;
      mon.answeredCount = totalQuestions;
    }

    res.json({ success: true, result });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Get Exam Results
app.get("/api/results", (req, res) => {
  res.json({ results: examResults });
});

// Gemini AI: Generate Exam Questions
app.post("/api/gemini/generate-questions", async (req, res) => {
  try {
    const { topic, grade, subject, count = 5, difficulty = "Sedang" } = req.body;

    if (!topic) {
      return res.status(400).json({ error: "Topik atau kisi-kisi soal wajib diisi" });
    }

    if (!apiKey) {
      return res.status(500).json({ error: "GEMINI_API_KEY tidak ditemukan di environment" });
    }

    const prompt = `Anda adalah pembuat soal ujian profesional standar Kurikulum Merdeka / Nasional Indonesia.
Buatkan ${count} butir soal pilihan ganda (opsi a, b, c, d) berkualitas tinggi untuk:
- Mata Pelajaran: ${subject || 'Umum'}
- Jenjang / Kelas: ${grade || 'SMA/SMK'}
- Topik / Materi: ${topic}
- Tingkat Kesulitan: ${difficulty}

Pastikan soal memiliki satu jawaban benar yang pasti, pengecoh (distractor) yang logis, dan pembahasan lengkap.
Kembalikan HANYA JSON array sesuai skema yang ditentukan.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              question: {
                type: Type.STRING,
                description: "Teks pertanyaan lengkap dan jelas",
              },
              options: {
                type: Type.OBJECT,
                properties: {
                  a: { type: Type.STRING, description: "Opsi A" },
                  b: { type: Type.STRING, description: "Opsi B" },
                  c: { type: Type.STRING, description: "Opsi C" },
                  d: { type: Type.STRING, description: "Opsi D" },
                },
                required: ["a", "b", "c", "d"],
              },
              correctAnswer: {
                type: Type.STRING,
                description: "Kunci jawaban: a, b, c, atau d",
              },
              explanation: {
                type: Type.STRING,
                description: "Pembahasan konsep penyelesaian yang benar",
              },
              category: {
                type: Type.STRING,
                description: "Subtopik atau kompetensi dasar",
              },
            },
            required: ["question", "options", "correctAnswer", "explanation"],
          },
        },
      },
    });

    const rawText = response.text || "[]";
    let questionsRaw: any[] = [];
    try {
      questionsRaw = JSON.parse(rawText);
    } catch {
      // Fallback regex parse if needed
      const match = rawText.match(/\[[\s\S]*\]/);
      if (match) {
        questionsRaw = JSON.parse(match[0]);
      }
    }

    const formattedQuestions: Question[] = questionsRaw.map((q, idx) => ({
      id: "q-gen-" + Date.now() + "-" + idx,
      number: idx + 1,
      question: q.question,
      options: {
        a: q.options?.a || "",
        b: q.options?.b || "",
        c: q.options?.c || "",
        d: q.options?.d || "",
      },
      correctAnswer: (q.correctAnswer || "a").toLowerCase() as "a" | "b" | "c" | "d",
      explanation: q.explanation || "",
      category: q.category || topic,
    }));

    res.json({ success: true, questions: formattedQuestions });
  } catch (err: any) {
    console.error("Gemini Question Generator error:", err);
    res.status(500).json({ error: err.message || "Gagal membuat soal dengan AI" });
  }
});

// Vite middleware for development & static fallback for production
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`CBT Web App Sekolah running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
