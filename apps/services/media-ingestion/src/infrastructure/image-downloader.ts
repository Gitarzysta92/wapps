import fetch from 'node-fetch';

/**
 * Downloads an image from a URL and returns its contents as a Buffer.
 * @param url - The HTTP(S) URL of the image to download.
 * @returns The image binary data.
 * @throws Error when the HTTP response is not ok.
 */
export async function downloadImageFromUrl(url: string): Promise<Buffer> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch image: ${response.statusText}`);
  }
  return Buffer.from(await response.arrayBuffer());
}
