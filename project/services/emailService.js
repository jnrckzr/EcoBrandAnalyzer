// services/emailService.js

import nodemailer from 'nodemailer';

// ***************************************************************
// ⚠️ KINAKAILANGAN NG PAGBABAGO: Palitan ang placeholders ng iyong credentials
// Gumamit ng Google "App Password", hindi ang iyong regular password!
// ***************************************************************
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'EcoBrandAnalyzer@gmail.com', // ⬅️ PALITAN MO ITO
        pass: 'xtiy shiw yopg mrbi'  // ⬅️ PALITAN MO ITO
    },
});

/**
 * Nagpapadala ng OTP email sa recipient gamit ang HTML template.
 * @param {string} to - Email address ng recipient.
 * @param {string} subject - Subject ng email.
 * @param {string} otpCode - Ang 6-digit OTP code.
 * @param {number} expiryMinutes - Bilang ng minuto bago mag-expire ang code.
 * @returns {Promise<boolean>} True kung successful ang pagpapadala, False kung nag-fail.
 */
export async function sendEmail(to, subject, otpCode, expiryMinutes = 10) {
    
    // Malinis at propesyonal na HTML template
    const htmlBody = `
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body { font-family: Arial, sans-serif; background-color: #f4f4f4; margin: 0; padding: 0; }
                .container { max-width: 600px; margin: 20px auto; background-color: #ffffff; padding: 20px; border-radius: 8px; box-shadow: 0 0 10px rgba(0, 0, 0, 0.1); }
                .header { text-align: center; padding-bottom: 20px; border-bottom: 1px solid #eeeeee; }
                .header h1 { color: #2ecc71; margin: 0; font-size: 24px; } /* Assuming EcoBrand's color is green */
                .content { padding: 20px 0; text-align: center; }
                .otp-box { 
                    background-color: #ecf0f1; 
                    color: #34495e; 
                    padding: 15px 25px; 
                    border-radius: 6px; 
                    font-size: 28px; 
                    font-weight: bold; 
                    display: inline-block; 
                    letter-spacing: 5px; 
                    margin: 20px 0; 
                }
                .footer { text-align: center; font-size: 12px; color: #7f8c8d; margin-top: 20px; padding-top: 10px; border-top: 1px solid #eeeeee; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>EcoBrand Password Reset</h1>
                </div>
                <div class="content">
                    <p>Humingi ka ng password reset para sa iyong EcoBrand account. Gamitin ang One-Time Password (OTP) sa ibaba para kumpirmahin ang iyong identity:</p>
                    
                    <div class="otp-box">${otpCode}</div>

                    <p>Ang code na ito ay mag-e-expire sa loob ng **${expiryMinutes} minuto**. Huwag itong ibigay kanino man.</p>
                    <p>Kung hindi ikaw ang humingi nito, maaari mo itong balewalain.</p>
                </div>
                <div class="footer">
                    &copy; ${new Date().getFullYear()} EcoBrand. All rights reserved.
                </div>
            </div>
        </body>
        </html>
    `;

    const mailOptions = {
        from: `EcoBrand Password Reset <${transporter.options.auth.user}>`, // Gamitin ang configured user
        to: to,
        subject: subject,
        // Plain text fallback para sa mga hindi naglo-load ng HTML
        text: `Ang iyong OTP ay: ${otpCode}. Ito ay valid sa loob ng ${expiryMinutes} minuto.`, 
        // Ang pangunahing body ng email
        html: htmlBody, 
    };

    try {
        const info = await transporter.sendMail(mailOptions);
        console.log('✅ Email sent successfully: %s', info.messageId);
        return true;
    } catch (error) {
        console.error('❌ Error sending email:', error);
        return false;
    }
}