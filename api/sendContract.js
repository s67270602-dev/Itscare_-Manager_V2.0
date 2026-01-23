
import { Resend } from 'resend';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { contractData, filename, pin } = req.body;
  // OWNER_EMAIL 환경변수 대신 요청하신 특정 이메일 사용을 위해 변수 분리
  const { ENGINEER_PIN, RESEND_API_KEY } = process.env;

  // 1. Auth Check (Verify PIN from Body)
  // 기사님 PIN 번호와 일치하는지 확인 (환경변수 또는 하드코딩된 값과 비교)
  const validPin = ENGINEER_PIN || "15777672";
  
  if (String(pin).trim() !== String(validPin).trim()) {
    console.error("Auth failed: Invalid PIN");
    return res.status(401).json({ message: '인증 실패: PIN 번호가 올바르지 않습니다.' });
  }

  // 2. Validate Data
  if (!contractData || !filename) {
    return res.status(400).json({ message: 'Missing contract data' });
  }

  if (!RESEND_API_KEY) {
    console.error("Missing RESEND_API_KEY");
    return res.status(500).json({ message: 'Server misconfiguration: API Key missing' });
  }

  const resend = new Resend(RESEND_API_KEY);
  
  // ✅ 요청하신 수신 이메일 주소 고정
  const TARGET_EMAIL = 'itscare.clean@gmail.com';

  // 3. Send Email with Attachment
  try {
    const jsonString = JSON.stringify(contractData, null, 2);
    const buffer = Buffer.from(jsonString, 'utf-8');

    const { data, error } = await resend.emails.send({
      from: 'Itscare System <onboarding@resend.dev>', // Resend 기본 도메인 (또는 설정된 도메인)
      to: [TARGET_EMAIL],
      subject: `[계약제출] ${contractData.shopName || '매장명미상'} - ${contractData.ownerName || '고객'}`,
      html: `
        <h1>계약서 제출 알림</h1>
        <p>기사님이 현장에서 작성한 계약서 데이터가 도착했습니다.</p>
        <ul>
          <li><strong>매장명:</strong> ${contractData.shopName}</li>
          <li><strong>대표자:</strong> ${contractData.ownerName}</li>
          <li><strong>작성일:</strong> ${new Date().toLocaleString('ko-KR')}</li>
        </ul>
        <p>첨부된 JSON 파일을 다운로드하여 관리자 시스템에서 [파일 불러오기]를 하세요.</p>
      `,
      attachments: [
        {
          filename: filename,
          content: buffer,
        },
      ],
    });

    if (error) {
      console.error('Resend Error:', error);
      return res.status(500).json({ message: 'Email sending failed', error });
    }

    return res.status(200).json({ message: 'Contract sent successfully', id: data.id });

  } catch (err) {
    console.error('Server Error:', err);
    return res.status(500).json({ message: 'Internal Server Error' });
  }
}
