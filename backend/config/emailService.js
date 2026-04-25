const nodemailer = require('nodemailer');

// Create transporter based on environment
const createTransporter = () => {
    if (process.env.NODE_ENV === 'production') {
        // Use SMTP for production
        return nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: process.env.SMTP_PORT,
            secure: true,
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASSWORD
            },
            from: process.env.SMTP_FROM || 'noreply@karankarchemicals.com'
        });
    } else {
        // Use ethereal (test email) for development
        return nodemailer.createTestAccount().then(testAccount => {
            return nodemailer.createTransport({
                host: 'smtp.ethereal.email',
                port: 587,
                secure: false,
                auth: {
                    user: testAccount.user,  // generated ethereal user
                    pass: testAccount.pass   // generated ethereal password
                }
            });
        }).catch(() => {
            // Fallback to console logging if ethereal fails
            console.log('Email service: Using console logging due to ethereal unavailable');
            return null;
        });
    }
};

let transporter = null;

const initializeEmailService = async () => {
    try {
        transporter = await createTransporter();
        if (transporter) {
            // Verify connection configuration
            await transporter.verify();
            console.log('Email service initialized successfully');
        }
    } catch (error) {
        console.error('Email service initialization error:', error.message);
        transporter = null;
    }
};

// Send email utility function
const sendEmail = async (to, subject, htmlContent, textContent = '') => {
    try {
        if (!transporter) {
            console.log('Email service not initialized, attempting to reinitialize...');
            await initializeEmailService();
        }

        if (!transporter) {
            console.log('[EMAIL LOG] To:', to);
            console.log('[EMAIL LOG] Subject:', subject);
            console.log('[EMAIL LOG] Content:', htmlContent);
            return { success: true, message: 'Email logged to console (no transporter)' };
        }

        const mailOptions = {
            from: process.env.SMTP_FROM || 'Karankar Chemicals <noreply@karankarchemicals.com>',
            to: to,
            subject: subject,
            html: htmlContent,
            text: textContent || stripHtml(htmlContent)
        };

        const info = await transporter.sendMail(mailOptions);

        // Log preview URL for ethereal in development
        if (process.env.NODE_ENV !== 'production' && info.response && info.response.includes('Preview')) {
            console.log('Email preview URL:', nodemailer.getTestMessageUrl(info));
        }

        console.log('Email sent successfully:', {
            to: to,
            subject: subject,
            messageId: info.messageId,
            timestamp: new Date().toISOString()
        });

        return { success: true, messageId: info.messageId };
    } catch (error) {
        console.error('Email sending error:', {
            to: to,
            subject: subject,
            error: error.message,
            timestamp: new Date().toISOString()
        });

        return { success: false, error: error.message };
    }
};

// Helper function to strip HTML tags
const stripHtml = (html) => {
    return html.replace(/<[^>]*>/g, '');
};

// Format currency
const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR'
    }).format(amount);
};

module.exports = {
    sendEmail,
    initializeEmailService,
    formatCurrency,
    stripHtml
};
