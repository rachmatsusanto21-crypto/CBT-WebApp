export interface ApiResponse<T = any> {
  ok: boolean;
  status: number;
  data?: T;
  error?: string;
}

/**
 * Safely fetches and parses JSON from the server, preventing
 * "Unexpected token 'T', 'The page c'... is not valid JSON" errors
 * when a proxy, Cloud Run, or server restarts and returns an HTML error page.
 */
export async function safeFetchJson<T = any>(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<ApiResponse<T>> {
  try {
    const res = await fetch(input, init);
    const contentType = res.headers.get('content-type') || '';

    // Check if the response is JSON
    if (contentType.includes('application/json')) {
      try {
        const json = await res.json();
        if (!res.ok) {
          const errMsg = json?.error || json?.message || `Permintaan gagal (Status ${res.status})`;
          return { ok: false, status: res.status, error: errMsg, data: json };
        }
        return { ok: true, status: res.status, data: json };
      } catch (jsonErr: any) {
        return {
          ok: false,
          status: res.status,
          error: `Format data server tidak valid (${jsonErr.message})`,
        };
      }
    }

    // If not JSON, read text safely (e.g. HTML error page from proxy, nginx, or Cloud Run)
    const text = await res.text();
    let friendlyError = `Server merespon dengan status ${res.status}`;
    const lowerText = text.toLowerCase();
    if (lowerText.includes('the page cannot') || lowerText.includes('the page could not') || lowerText.includes('<html')) {
      friendlyError = 'Server sedang memuat atau memproses permintaan. Silakan tunggu beberapa detik dan coba kembali.';
    } else if (res.status === 504 || res.status === 502) {
      friendlyError = 'Waktu permintaan habis (Gateway Timeout). Silakan kurangi jumlah butir soal atau coba lagi.';
    } else if (res.status === 404) {
      friendlyError = 'Layanan API tidak ditemukan (404).';
    }

    return {
      ok: false,
      status: res.status,
      error: friendlyError,
    };
  } catch (netErr: any) {
    return {
      ok: false,
      status: 0,
      error: netErr.message || 'Koneksi jaringan terputus. Periksa sambungan internet Anda.',
    };
  }
}
