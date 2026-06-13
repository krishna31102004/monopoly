const WORDS = [
  "LONDON", "DUBAI", "TOKYO", "PARIS", "DELHI",
  "ROME", "SYDNEY", "BERLIN", "MIAMI", "SEOUL",
];

export function generateRoomCode(): string {
  const word = WORDS[Math.floor(Math.random() * WORDS.length)];
  const num = String(Math.floor(Math.random() * 9000) + 1000);
  return `${word}-${num}`;
}

export function isValidRoomCodeFormat(code: string): boolean {
  return /^[A-Z]+-\d{4}$/.test(code.trim().toUpperCase());
}
