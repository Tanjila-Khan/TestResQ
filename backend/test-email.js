const { sendZohoEmail } = require('./utils/mailer');
require('dotenv').config();

async function testEmail() {
  try {
    console.log('Testing Zoho Mail configuration...');
    console.log('Environment variables:');
    console.log('- ZOHO_EMAIL_USER:', process.env.ZOHO_EMAIL_USER || 'Not set');
    console.log('- ZOHO_EMAIL:', process.env.ZOHO_EMAIL || 'Not set');
    console.log('- ZOHO_EMAIL_PASSWORD:', process.env.ZOHO_EMAIL_PASSWORD ? 'Set' : 'Not set');
    
    const testEmail = process.env.TEST_EMAIL || 'test@example.com';
    
    const result = await sendZohoEmail({
      to: testEmail,
      subject: 'Test Email from CartResQ',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 20px auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px;">
          <h2 style="color: #333;">Test Email</h2>
          <p>This is a test email to verify that Zoho Mail is configured correctly in CartResQ.</p>
          <p>If you receive this email, your Zoho Mail setup is working properly!</p>
          <p>Sent at: ${new Date().toISOString()}</p>
        </div>
      `,
      fromName: 'CartResQ Test'
    });
    
    console.log('✅ Email sent successfully!');
    console.log('Message ID:', result.messageId);
    console.log('Response:', result);
    
  } catch (error) {
    console.error('❌ Email test failed:');
    console.error(error);
  }
}

// Run the test
testEmail(); 