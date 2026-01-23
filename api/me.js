
import { parse } from 'cookie';
import jwt from 'jsonwebtoken';

export default async function handler(req, res) {
  const { AUTH_SECRET } = process.env;
  const cookies = parse(req.headers.cookie || '');
  const token = cookies.auth;

  if (!token) {
    return res.status(401).json({ role: null });
  }

  try {
    const decoded = jwt.verify(token, AUTH_SECRET);
    return res.status(200).json({ role: decoded.role });
  } catch (err) {
    return res.status(401).json({ role: null });
  }
}
