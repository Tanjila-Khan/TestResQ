const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
require('dotenv').config();

async function setupStripeProducts() {
  console.log('🔧 Setting up Stripe Products and Prices for CartResQ\n');

  try {
    // Check if products already exist
    const existingProducts = await stripe.products.list({ limit: 100 });
    const cartresqProducts = existingProducts.data.filter(p => p.name.includes('CartResQ'));

    console.log('📋 Existing CartResQ products:');
    cartresqProducts.forEach(product => {
      console.log(`   - ${product.name} (ID: ${product.id})`);
    });

    // Create or update products
    const products = [
      {
        name: 'CartResQ Starter',
        description: 'Perfect for growing stores focused on email-based recovery',
        price: 1900, // $19.00 in cents
        interval: 'month'
      },
      {
        name: 'CartResQ Growth',
        description: 'Ideal for multi-store businesses scaling cart recovery with automation',
        price: 4900, // $49.00 in cents
        interval: 'month'
      }
    ];

    for (const productData of products) {
      console.log(`\n🔄 Setting up ${productData.name}...`);
      
      // Check if product exists
      let product = cartresqProducts.find(p => p.name === productData.name);
      
      if (!product) {
        console.log(`   Creating new product: ${productData.name}`);
        product = await stripe.products.create({
          name: productData.name,
          description: productData.description,
          metadata: {
            plan: productData.name.toLowerCase().replace('cartresq ', '')
          }
        });
      } else {
        console.log(`   Product already exists: ${product.id}`);
      }

      // Check if price exists
      const existingPrices = await stripe.prices.list({
        product: product.id,
        active: true
      });

      let price = existingPrices.data.find(p => p.unit_amount === productData.price);

      if (!price) {
        console.log(`   Creating new price: $${(productData.price / 100).toFixed(2)}/${productData.interval}`);
        price = await stripe.prices.create({
          product: product.id,
          unit_amount: productData.price,
          currency: 'usd',
          recurring: {
            interval: productData.interval
          },
          metadata: {
            plan: productData.name.toLowerCase().replace('cartresq ', '')
          }
        });
      } else {
        console.log(`   Price already exists: ${price.id}`);
      }

      // Set environment variable
      const planKey = productData.name.toLowerCase().replace('cartresq ', '');
      const envVarName = `STRIPE_${planKey.toUpperCase()}_PRICE_ID`;
      
      console.log(`   ✅ ${envVarName}: ${price.id}`);
      console.log(`   Add this to your .env file: ${envVarName}=${price.id}`);
    }

    // Create yearly prices (optional - for 20% discount)
    console.log('\n📅 Setting up yearly prices (20% discount)...');
    
    for (const productData of products) {
      const planKey = productData.name.toLowerCase().replace('cartresq ', '');
      const yearlyPrice = Math.round(productData.price * 12 * 0.8); // 20% discount
      
      console.log(`   ${productData.name} yearly: $${(yearlyPrice / 100).toFixed(2)}/year (20% off)`);
      
      // You can create yearly prices here if needed
      // const yearlyPriceObj = await stripe.prices.create({
      //   product: product.id,
      //   unit_amount: yearlyPrice,
      //   currency: 'usd',
      //   recurring: {
      //     interval: 'year'
      //   }
      // });
    }

    console.log('\n✅ Stripe setup completed!');
    console.log('\n📝 Next steps:');
    console.log('1. Add the price IDs to your .env file');
    console.log('2. Test the checkout flow with test cards');
    console.log('3. Set up webhook endpoints in Stripe Dashboard');

  } catch (error) {
    console.error('❌ Error setting up Stripe products:', error);
  }
}

// Run the setup
setupStripeProducts(); 