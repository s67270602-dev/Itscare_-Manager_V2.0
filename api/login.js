
import { serialize } from 'cookie';
import jwt from 'jsonwebtoken';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  // Defensive body parsing
  const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  const { pin } = body;
  
  const { OWNER_PIN, ENGINEER_PIN, AUTH_SECRET } = process.env;

  // 1. Check Server Configuration
  if (!AUTH_SECRET || !OWNER_PIN || !ENGINEER_PIN) {
    console.error('Missing Environment Variables');
    return res.status(500).json({ message: '서버 오류: 환경변수(PIN/SECRET)가 설정되지 않았습니다. Vercel 설정을 확인하세요.' });
  }

  // 2. Validate Input (Trim whitespace and ensure string comparison)
  const inputPin = String(pin || '').trim();
  const ownerPin = String(OWNER_PIN).trim();
  const engineerPin = String(ENGINEER_PIN).trim();

  let role = null;

  if (inputPin === ownerPin) {
    role = 'owner';
  } else if (inputPin === engineerPin) {
    role = 'engineer';
  } else {
    return res.status(401).json({ message: 'PIN 번호가 일치하지 않습니다.' });
  }

  // 3. Issue Token
  try {
    const token = jwt.sign({ role }, AUTH_SECRET, { expiresIn: '12h' });

    // maxAge 제거: 브라우저 닫으면 세션 종료 (Session Cookie)
    const cookie = serialize('auth', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
    });

    res.setHeader('Set-Cookie', cookie);
    return res.status(200).json({ role });
  } catch (error) {
    console.error('Token generation failed', error);
    return res.status(500).json({ message: '로그인 처리 중 오류가 발생했습니다.' });
  }
}
