import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  try {
    const data =
      typeof req.body === 'string'
        ? JSON.parse(req.body)
        : req.body;

    const result = await resend.emails.send({
      from: 'onboarding@resend.dev',
      to: 'itscare.clean@gmail.com',
      subject: '홈페이지 저장 데이터',
      html: `
        <h3>저장된 JSON 데이터</h3>
        <pre style="white-space: pre-wrap;">
${JSON.stringify(data, null, 2)}
        </pre>
      `,
    });

    return res.status(200).json({ success: true, result });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, error });
  }
}
