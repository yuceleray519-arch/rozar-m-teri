export function isValidTC(tc: string): boolean {
  if (!/^[1-9]\d{10}$/.test(tc)) return false;
  const arr = tc.split('').map(Number);
  
  let d10 = ((arr[0] + arr[2] + arr[4] + arr[6] + arr[8]) * 7 - (arr[1] + arr[3] + arr[5] + arr[7])) % 10;
  if (d10 < 0) d10 += 10;
  
  if (d10 !== arr[9]) return false;
  
  const d11 = arr.slice(0, 10).reduce((a, b) => a + b, 0) % 10;
  if (d11 !== arr[10]) return false;
  
  return true;
}
