import React from 'react';

const AbandonedCartsTable = ({ carts, onViewDetails }) => {
  const safeCarts = Array.isArray(carts) ? carts : [];

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed':
      case 'processing':
        return 'bg-green-100 text-green-800';
      case 'failed':
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      case 'pending':
      case 'on-hold':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-blue-100 text-blue-800';
    }
  };

  const getLastUpdated = (cart) => {
    if (cart.last_activity) {
      // last_activity may be a string or Date
      return new Date(cart.last_activity).toLocaleString();
    }
    if (cart.timestamp) {
      return new Date(cart.timestamp * 1000).toLocaleString();
    }
    return '-';
  };

  const calculateCartValue = (cart) => {
    if (!cart || !cart.cart || !Array.isArray(cart.cart)) return 0;
    // Debug: log cart items
    console.log('Cart items for cart', cart.id, cart.cart);
    return cart.cart.reduce((sum, item) => {
      let priceStr = item.price || item.unit_price || item.total || '0';
      if (typeof priceStr === 'string') priceStr = priceStr.replace(/\$/g, '').replace(/[^\d.]/g, '');
      const price = parseFloat(priceStr) || 0;
      const qty = parseInt(item.quantity || item.qty || 1);
      return sum + (price * qty);
    }, 0);
  };

  const getCartItems = (cart) => {
    if (!cart || !Array.isArray(cart)) return [];
    return cart;
  };

  const formatTotal = (total) => {
    const num = typeof total === 'string' ? parseFloat(total) : total;
    return `$${(num || 0).toFixed(2)}`;
  };

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="p-4 border-b">
        <h3 className="text-lg font-semibold">Recent Abandonments</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50">
              <th className="text-left p-4 font-medium text-gray-500">Customer</th>
              <th className="text-left p-4 font-medium text-gray-500">Last Updated</th>
              <th className="text-left p-4 font-medium text-gray-500">Status</th>
              <th className="text-left p-4 font-medium text-gray-500">Items</th>
              <th className="text-left p-4 font-medium text-gray-500">Cart Value</th>
              <th className="text-left p-4 font-medium text-gray-500">Action</th>
            </tr>
          </thead>
          <tbody>
            {safeCarts.length === 0 ? (
              <tr>
                <td colSpan="6" className="p-4 text-center text-gray-500">
                  No abandoned carts found
                </td>
              </tr>
            ) : (
              safeCarts.map((cart) => (
                <tr key={cart.cart_id || cart.id} className="border-t">
                  <td className="p-4">
                    {cart.customer_name || 'Guest'}
                    {cart.customer_email && (
                      <div className="text-sm text-gray-500">{cart.customer_email}</div>
                    )}
                  </td>
                  <td className="p-4">
                    {getLastUpdated(cart)}
                  </td>
                  <td className="p-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      cart.status === 'abandoned' 
                        ? 'bg-red-100 text-red-800'
                        : 'bg-green-100 text-green-800'
                    }`}>
                      {cart.status}
                    </span>
                  </td>
                  <td className="p-4">
                    {cart.cart?.length || 0} items
                  </td>
                  <td className="p-4">
                    ${calculateCartValue(cart).toFixed(2)}
                  </td>
                  <td className="p-4">
                    <button
                      onClick={() => onViewDetails(cart)}
                      className="text-blue-600 hover:text-blue-800"
                    >
                      View Details
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <div className="p-4 border-t">
        <button 
          onClick={() => window.location.href = '/carts'}
          className="text-blue-600 hover:text-blue-800 font-medium"
        >
          View All Carts
        </button>
      </div>
    </div>
  );
};

export default AbandonedCartsTable; 