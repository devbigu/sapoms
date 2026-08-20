import { Resend } from "resend";

export async function sendLoginOtp(email: string, otp: string) {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.EMAIL_FROM?.trim();
  if (!apiKey || !from) throw new Error("Email delivery is not configured");

  const resend = new Resend(apiKey);
  return resend.emails.send({
    from,
    to: email,
    subject: "Your SAPOMS login code",
    html: `
      <p>Your SAPOMS login code is:</p>
      <h1>${otp}</h1>
      <p>This code expires in 5 minutes.</p>
    `,
  });
}