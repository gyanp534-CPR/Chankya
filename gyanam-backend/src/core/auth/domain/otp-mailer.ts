import nodemailer from "nodemailer";

export type SignupOtpMailInput = {
  email: string;
  otp: string;
  expiresInMinutes: number;
};

export type OtpMailer = {
  sendSignupOtp(input: SignupOtpMailInput): Promise<void>;
};

export type SmtpOtpMailerOptions = {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  from: string;
};

export class SmtpOtpMailer implements OtpMailer {
  private readonly transporter;

  public constructor(private readonly options: SmtpOtpMailerOptions) {
    this.transporter = nodemailer.createTransport({
      host: options.host,
      port: options.port,
      secure: options.secure,
      auth: {
        user: options.user,
        pass: options.pass,
      },
    });
  }

  public async sendSignupOtp(input: SignupOtpMailInput): Promise<void> {
    await this.transporter.sendMail({
      from: this.options.from,
      to: input.email,
      subject: "Your Gyanam signup OTP",
      text: `Your OTP is ${input.otp}. It expires in ${input.expiresInMinutes} minutes.`,
      html: `<p>Your OTP is <strong>${input.otp}</strong>.</p><p>It expires in ${input.expiresInMinutes} minutes.</p>`,
    });
  }
}

export class DevConsoleOtpMailer implements OtpMailer {
  public async sendSignupOtp(input: SignupOtpMailInput): Promise<void> {
    // Useful in local/dev when SMTP is not configured.
    // Do not rely on this in production.
    console.log(`[DEV OTP] email=${input.email} otp=${input.otp} expiresInMinutes=${input.expiresInMinutes}`);
  }
}

