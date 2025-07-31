const AbandonedCart = require('../models/AbandonedCart');

const getAbandonedCartCustomers = async (req, res) => {
  try {
    const { platform } = req.query;
    const match = { status: 'abandoned', customer_email: { $ne: null, $ne: '' } };
    if (platform) {
      match.platform = platform;
    }
    const customers = await AbandonedCart.aggregate([
      { $match: match },
      { $group: { _id: { $toLower: '$customer_email' }, name: { $first: '$customer' } } }
    ]);
    // Fallback: if name is missing, use email as name
    res.json(customers.map(c => ({
      email: c._id,
      name: c.name && c.name.trim() !== '' ? c.name : c._id
    })));
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch abandoned cart customers' });
  }
};

module.exports = { getAbandonedCartCustomers }; 