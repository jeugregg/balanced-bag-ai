const CORS_PROXY = 'https://corsproxy.io/?' // Free CORS proxy service

const isLocalDevelopment = import.meta.env.DEV;

export async function fetchWithProxy(url: string, options: RequestInit = {}): Promise<Response> {
  try {
    if (isLocalDevelopment) {
      // Local development: use Vite proxy
      const localUrl = url.replace('https://api.coingecko.com', '/coingecko');
      return await fetch(localUrl, options);
    } else {
      // Production: use CORS proxy
      const proxyUrl = `${CORS_PROXY}${encodeURIComponent(url)}`;
      return await fetch(proxyUrl, options);
    }
  } catch (error) {
    console.error('Fetch error:', error);
    throw error;
  }
}
