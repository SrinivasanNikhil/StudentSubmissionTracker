const nodemailer = require("nodemailer");

class EmailService {
	constructor() {
		this.transporter = nodemailer.createTransport({
			host: process.env.SMTP_HOST,
			port: process.env.SMTP_PORT,
			secure: process.env.SMTP_SECURE === "true",
			auth: {
				user: process.env.SMTP_USER,
				pass: process.env.SMTP_PASS,
			},
		});
	}

	async sendPasswordResetEmail(email, resetToken, userName) {
		const resetUrl = `${process.env.APP_URL}/auth/reset-password/${resetToken}`;

		// Use SMTP user as from address for Gmail to avoid domain mismatch issues
		const fromAddress =
			process.env.SMTP_HOST === "smtp.gmail.com"
				? process.env.SMTP_USER
				: process.env.SMTP_FROM;

		const mailOptions = {
			from: `"Student Submission Tracker" <${fromAddress}>`,
			to: email,
			subject: "Password Reset Request",
			html: `
				<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
					<h2 style="color: #007bff;">Password Reset Request</h2>
					<p>Hello ${userName || "there"},</p>
					<p>We received a request to reset your password for the Student Submission Tracker account.</p>
					<p>Click the button below to reset your password:</p>
					<div style="text-align: center; margin: 30px 0;">
						<a href="${resetUrl}" 
						   style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
							Reset Password
						</a>
					</div>
					<p>This link will expire in 1 hour for security reasons.</p>
					<p>If you didn't request this password reset, please ignore this email.</p>
					<p>Best regards,<br>Student Submission Tracker Team</p>
				</div>
			`,
		};

		console.log(
			`[EmailService] Attempting to send password reset email to: ${email}`
		);
		console.log(`[EmailService] Reset URL: ${resetUrl}`);

		try {
			const result = await this.transporter.sendMail(mailOptions);
			console.log(`[EmailService] Email sent successfully to ${email}`);
			console.log(`[EmailService] Message ID: ${result.messageId}`);
			console.log(`[EmailService] Accepted: ${result.accepted.join(", ")}`);
			if (result.rejected.length > 0) {
				console.log(`[EmailService] Rejected: ${result.rejected.join(", ")}`);
			}
			return true;
		} catch (error) {
			console.error(`[EmailService] Email sending error for ${email}:`, error);
			return false;
		}
	}
}

module.exports = new EmailService();
