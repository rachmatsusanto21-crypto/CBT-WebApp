import { GoogleGenAI } from '@google/genai';

export default async function handler(req: any, res: any) {
  // Allow CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, x-gemini-api-key'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    const customKey =
      (req.headers['x-gemini-api-key'] as string) ||
      req.body?.apiKey ||
      (req.query?.apiKey as string);

    const activeKey = customKey || process.env.GEMINI_API_KEY;

    if (!activeKey) {
      return res.status(200).json({
        active: false,
        source: 'none',
        hasServerKey: false,
        message: 'GEMINI_API_KEY belum dikonfigurasi di environment Vercel maupun browser.',
      });
    }

    const testClient = new GoogleGenAI({
      apiKey: activeKey,
      httpOptions: {
        headers: { 'User-Agent': 'aistudio-build-vercel' },
      },
    });

    const startTime = Date.now();
    const modelsToTest = ['gemini-3.8-flash', 'gemini-3.1-flash-lite', 'gemini-flash-latest'];
    let workingModel = '';
    let lastError: any = null;

    for (const m of modelsToTest) {
      try {
        const ping = await testClient.models.generateContent({
          model: m,
          contents: 'Ping test. Reply: OK',
        });
        if (ping.text) {
          workingModel = m;
          break;
        }
      } catch (err: any) {
        lastError = err;
      }
    }

    const latencyMs = Date.now() - startTime;

    if (workingModel) {
      return res.status(200).json({
        active: true,
        source: customKey ? 'custom' : 'server',
        model: workingModel,
        latencyMs,
        hasServerKey: Boolean(process.env.GEMINI_API_KEY),
        message: `Koneksi Gemini AI Aktif di Vercel! Model ${workingModel} berhasil terhubung (Latensi ${latencyMs}ms).`,
      });
    } else {
      const errMsg = lastError?.message || String(lastError || 'Kunci API tidak valid');
      return res.status(200).json({
        active: false,
        source: customKey ? 'custom' : 'server',
        hasServerKey: Boolean(process.env.GEMINI_API_KEY),
        error: errMsg,
        message: `Kunci API tidak valid: ${errMsg}`,
      });
    }
  } catch (err: any) {
    return res.status(500).json({
      active: false,
      error: err.message,
      message: `Gagal memverifikasi status API: ${err.message}`,
    });
  }
}
