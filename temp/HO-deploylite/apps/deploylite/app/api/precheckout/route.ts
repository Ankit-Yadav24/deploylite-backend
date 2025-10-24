import Razorpay from 'razorpay';
import { NextRequest, NextResponse } from "next/server";
import ConnectDb from '../../../../middleware/connectdb';
import CheckAuth from '@/actions/CheckAuth';
import TempPayment from '../../../../models/TempPayment';
import mongoose from 'mongoose';

export const POST = async (req: NextRequest) => {
  console.log('🚀 PreCheckout API called at:', new Date().toISOString());
  
  try {
    const data = await req.json();
    console.log('📝 PreCheckout request data:', { 
      amount: data.amount, 
      email: data.email,
      name: data.name 
    });

    await ConnectDb();
    console.log('✅ Database connected for PreCheckout');

    // Check authentication
    let result = await CheckAuth();
    if (!result.result) {
      console.error('❌ Authentication failed in PreCheckout');
      return NextResponse.json({
        message: "You are not authenticated. Please login to continue",
        success: false,
        login: false
      });
    }

    console.log('👤 User authenticated:', result.email);

    // Validate amount
    if (!data.amount || data.amount <= 0 || data.amount > 50000) {
      console.error('❌ Invalid amount:', data.amount);
      return NextResponse.json({
        message: "Invalid amount. Amount must be between ₹1 and ₹50,000",
        success: false
      });
    }

    // Validate Razorpay configuration
    if (!process.env.NEXT_PUBLIC_KEY_ID || !process.env.NEXT_PUBLIC_KEY_SECRET) {
      console.error('❌ Razorpay configuration missing');
      return NextResponse.json({
        message: "Payment configuration error",
        success: false
      });
    }

    // Start database session for transaction
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Clean up any existing pending payments for this user (within transaction)
      const deletedCount = await TempPayment.deleteMany(
        { email: result.email, status: 'pending' },
        { session }
      );
      console.log('🗑️ Cleaned up existing temp payments:', deletedCount.deletedCount);

      // Create Razorpay instance
      const razorpayInstance = new Razorpay({ 
        key_id: process.env.NEXT_PUBLIC_KEY_ID || "", 
        key_secret: process.env.NEXT_PUBLIC_KEY_SECRET || "" 
      });

      // Generate unique receipt ID
      const receiptId = `rcpt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const orderOptions = {
        amount: Math.round(data.amount * 100), 
        currency: "INR",
        receipt: receiptId,
        notes: {
          email: result.email,
          user_name: data.name || result.username || 'Unknown',
          timestamp: new Date().toISOString(),
          purpose: 'wallet_recharge'
        }
      };

      console.log('🏦 Creating Razorpay order with options:', {
        amount: orderOptions.amount,
        currency: orderOptions.currency,
        receipt: orderOptions.receipt,
        email: result.email
      });

      // Create Razorpay order
      const order = await new Promise((resolve, reject) => {
        razorpayInstance.orders.create(orderOptions, (err, order) => {
          if (err) {
            console.error('❌ Razorpay order creation failed:', err);
            reject(new Error(`Razorpay order creation failed: ${err.error?.description || 'Unknown error'}`));
          } else {
            console.log('✅ Razorpay order created successfully:', {
              id: order.id,
              amount: order.amount,
              status: order.status,
              receipt: order.receipt
            });
            resolve(order);
          }
        });
      });

      // Create temp payment record with order ID (within transaction)
      const tempPayment = new TempPayment({
        email: result.email,
        amount: data.amount, 
        orderId: (order as any).id,
        status: 'pending'
      });

      await tempPayment.save({ session });
      console.log('💾 Temp payment record created:', {
        id: tempPayment._id,
        email: tempPayment.email,
        amount: tempPayment.amount,
        orderId: tempPayment.orderId,
        status: tempPayment.status
      });

      // Commit transaction
      await session.commitTransaction();
      
      return NextResponse.json({ 
        order, 
        success: true,
        tempPaymentId: tempPayment._id,
        message: "Order created successfully - Direct success flow enabled",
        debug: {
          orderId: (order as any).id,
          amount: data.amount,
          email: result.email,
          flow: "direct_success" 
        }
      });

    } catch (transactionError) {
      // Rollback transaction
      await session.abortTransaction();
      throw transactionError;
    } finally {
      session.endSession();
    }

  } catch (err: any) {
    console.error('💥 PreCheckout API error:', {
      message: err.message,
      stack: err.stack,
      timestamp: new Date().toISOString()
    });
    
    return NextResponse.json({ 
      success: false, 
      message: "Order creation failed. Please try again.",
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    }, { status: 500 });
  }
};