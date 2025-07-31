require('dotenv').config();
const { sendZohoEmail } = require('./utils/mailer');

console.log('🧪 Testing Email Sending Functionality...\n');

async function testEmailSending() {
  try {
    console.log('📧 Attempting to send test email...');
    
    const testEmail = {
      to: 'test@example.com', // Change this to your email for testing
      subject: '🧪 CartResQ Email Scheduler Test',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 20px auto; background: #ffffff; padding: 30px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <h2 style="color: #333333; margin-bottom: 20px;">🎉 Email Scheduler Test Successful!</h2>
          <p style="color: #666666; font-size: 16px; line-height: 1.5; margin-bottom: 20px;">
            This is a test email from your CartResQ email scheduling system.
          </p>
          <p style="color: #666666; font-size: 16px; line-height: 1.5; margin-bottom: 20px;">
            If you received this email, it means:
          </p>
          <ul style="color: #666666; font-size: 16px; line-height: 1.5; margin-bottom: 20px;">
            <li>✅ Zoho Mail configuration is working</li>
            <li>✅ Email scheduler can send emails</li>
            <li>✅ Your abandoned cart reminders will be delivered</li>
          </ul>
          <div style="background: #f8f9fa; border-radius: 6px; padding: 20px; margin: 20px 0;">
            <p style="margin: 0; color: #666666; font-size: 14px;">
              <strong>Test Details:</strong><br>
              Sent at: ${new Date().toISOString()}<br>
              From: ${process.env.ZOHO_EMAIL_USER}<br>
              To: test@example.com
            </p>
          </div>
          <p style="color: #666666; font-size: 14px; margin-top: 30px;">
            This is an automated test email. Please ignore if you received it by mistake.
          </p>
        </div>
      `,
      fromEmail: process.env.ZOHO_EMAIL_USER,
      fromName: 'CartResQ Test'
    };

    console.log('📤 Sending email via Zoho Mail...');
    const result = await sendZohoEmail(testEmail);
    
    console.log('✅ Email sent successfully!');
    console.log('📊 Email Details:');
    console.log(`   Message ID: ${result.messageId}`);
    console.log(`   From: ${testEmail.fromEmail}`);
    console.log(`   To: ${testEmail.to}`);
    console.log(`   Subject: ${testEmail.subject}`);
    
    return true;
    
  } catch (error) {
    console.error('❌ Email sending failed:', error.message);
    console.error('Full error:', error);
    return false;
  }
}

async function testEmailConfiguration() {
  console.log('🔍 Testing Email Configuration...');
  
  const config = {
    ZOHO_EMAIL_USER: process.env.ZOHO_EMAIL_USER,
    ZOHO_EMAIL: process.env.ZOHO_EMAIL,
    ZOHO_EMAIL_PASSWORD: process.env.ZOHO_EMAIL_PASSWORD ? 'SET' : 'NOT SET'
  };
  
  console.log('📋 Current Configuration:');
  Object.entries(config).forEach(([key, value]) => {
    console.log(`   ${key}: ${value}`);
  });
  
  if (!config.ZOHO_EMAIL_USER || !config.ZOHO_EMAIL_PASSWORD) {
    console.log('❌ Email configuration incomplete');
    return false;
  }
  
  console.log('✅ Email configuration looks good');
  return true;
}

async function runEmailTest() {
  console.log('🚀 Starting Email Test...\n');
  
  // Test configuration first
  const configOk = await testEmailConfiguration();
  if (!configOk) {
    console.log('\n❌ Email configuration test failed. Please check your .env file.');
    return;
  }
  
  console.log('\n' + '='.repeat(50));
  
  // Test email sending
  const emailSent = await testEmailSending();
  
  console.log('\n' + '='.repeat(50));
  if (emailSent) {
    console.log('🎉 Email test completed successfully!');
    console.log('✅ Your email scheduling system is ready to send abandoned cart reminders.');
    console.log('\n📝 Next steps:');
    console.log('1. Change the test email address in this script to your email');
    console.log('2. Run the test again to receive a test email');
    console.log('3. Start your server with: npm run dev');
    console.log('4. The scheduler will automatically send reminders for abandoned carts');
  } else {
    console.log('❌ Email test failed.');
    console.log('📝 Troubleshooting:');
    console.log('1. Check your Zoho Mail credentials in .env file');
    console.log('2. Verify your Zoho Mail SMTP settings');
    console.log('3. Check if your Zoho Mail account has SMTP enabled');
    console.log('4. Try using an app-specific password instead of your main password');
  }
  console.log('='.repeat(50));
}

// Run the test
runEmailTest().catch(console.error); 