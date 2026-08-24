const nodemailer = require('nodemailer');

async function testEmail() {
  const transporter = nodemailer.createTransport({
    host: 'smtp.office365.com',
    port: 587,
    secure: false,
    auth: {
      user: 'support_svc@velocyverse.com',
      pass: 'Cool@kal1',
    },
  });

  try {
    const result = await transporter.sendMail({
      from: 'support_svc@velocyverse.com',
      to: 'suseenataraj@gmail.com',
      subject: 'Test Email from Velocyverse',
      html: '<p>This is a test email to verify SMTP configuration.</p>',
    });
    console.log('Email sent successfully!');
    console.log('Message ID:', result.messageId);
    console.log('Response:', result.response);
  } catch (error) {
    console.error('Email send failed:', error);
  }
}

testEmail();
