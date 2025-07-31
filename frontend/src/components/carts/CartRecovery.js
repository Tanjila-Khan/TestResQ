import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../../utils/api';
import config from '../../config';

const CartRecovery = () => {
  const [searchParams] = useSearchParams();
  const [cart, setCart] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [restored, setRestored] = useState(false);

  useEffect(() => {
    const cartId = searchParams.get('cart_id');
    if (!cartId) {
      setError('No cart ID provided.');
      setLoading(false);
      return;
    }
    api.get(`/api/carts/${cartId}`)
      .then(res => {
        setCart(res.data);
        setLoading(false);
      })
      .catch(() => {
        setError('Cart not found or expired.');
        setLoading(false);
      });
  }, [searchParams]);

  const handleRestore = () => {
    if (cart && cart.items) {
      // Store items in localStorage (or context, depending on your cart system)
      localStorage.setItem('cart_items', JSON.stringify(cart.items));
      setRestored(true);
    }
  };

  if (loading) return <div style={{padding:40, textAlign:'center'}}>Loading your cart...</div>;
  if (error) return <div style={{padding:40, textAlign:'center', color:'red'}}>{error}</div>;

  return (
    <div style={{maxWidth:600, margin:'40px auto', background:'#fff', border:'1px solid #eee', borderRadius:8, padding:32}}>
      <h2 style={{color:'#333'}}>Restore Your Cart</h2>
      <p style={{color:'#555'}}>We found your cart with the following items:</p>
      <table style={{width:'100%', borderCollapse:'collapse', marginBottom:24}}>
        <thead>
          <tr style={{background:'#f9f9f9'}}>
            <th style={{padding:8, border:'1px solid #eee', textAlign:'left'}}>Product</th>
            <th style={{padding:8, border:'1px solid #eee', textAlign:'left'}}>Qty</th>
            <th style={{padding:8, border:'1px solid #eee', textAlign:'left'}}>Price</th>
            <th style={{padding:8, border:'1px solid #eee', textAlign:'left'}}>Total</th>
          </tr>
        </thead>
        <tbody>
          {cart.items && cart.items.length > 0 ? cart.items.map((item, idx) => (
            <tr key={idx}>
              <td style={{padding:8, border:'1px solid #eee'}}>{item.name}</td>
              <td style={{padding:8, border:'1px solid #eee'}}>{item.quantity}</td>
              <td style={{padding:8, border:'1px solid #eee'}}>${item.price}</td>
              <td style={{padding:8, border:'1px solid #eee'}}>${(item.price * item.quantity).toFixed(2)}</td>
            </tr>
          )) : (
            <tr><td colSpan={4} style={{padding:8, textAlign:'center'}}>No items found in your cart.</td></tr>
          )}
        </tbody>
      </table>
      {!restored ? (
        <button onClick={handleRestore} style={{padding:'12px 24px', background:'#007bff', color:'#fff', border:'none', borderRadius:4, fontWeight:'bold', cursor:'pointer'}}>Restore Cart</button>
      ) : (
        <div style={{color:'green', marginTop:16}}>Cart restored! You can now continue shopping or checkout.</div>
      )}
    </div>
  );
};

export default CartRecovery; 