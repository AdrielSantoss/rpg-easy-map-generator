async function digest(text: string): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)));
}

/**
 * Whether the password someone typed is the one configured for the tool.
 *
 * With no password configured the tool is closed to everyone, rather than open:
 * a deployment that forgot the secret must not hand out the image quota.
 * The two are compared through their hashes, byte by byte without stopping
 * early, so how long the check takes says nothing about how close a guess was.
 */
export async function passwordMatches(given: string, expected: string | undefined): Promise<boolean> {
  if (!expected) return false;
  const [a, b] = await Promise.all([digest(given), digest(expected)]);
  let difference = 0;
  for (let i = 0; i < a.length; i++) difference |= a[i] ^ b[i];
  return difference === 0;
}
