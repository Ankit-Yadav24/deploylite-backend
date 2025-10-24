import { NextRequest, NextResponse } from 'next/server';
import ConnectDb from '../../../../middleware/connectdb';
import TempPayment from '../../../../models/TempPayment';
import Wallet from '../../../../models/Wallet';
import User from '../../../../models/User';
import CheckAuth from '@/actions/CheckAuth';
import mongoose from 'mongoose';
import crypto from 'crypto';

export const POST = async (req: NextRequest) => {
  console.log('🎉 Payment success handler called at:', new Date().toISOString());
  
  try {
    await ConnectDb();
    
    const data = await req.json();
    const { 
      razorpay_order_id, 
      razorpay_payment_id, 
      razorpay_signature,
      order_amount
    } = data;

    console.log('💳 Payment success data:', {
      order_id: razorpay_order_id,
      payment_id: razorpay_payment_id,
      signature_present: !!razorpay_signature,
      amount: order_amount
    });

    // Verify authentication
    const result = await CheckAuth();
    if (!result.result) {
      return NextResponse.json({
        success: false,
        message: "Authentication required"
      }, { status: 401 });
    }

    // Verify Razorpay signature
    const key_secret = process.env.NEXT_PUBLIC_KEY_SECRET;
    if (!key_secret) {
      console.error('❌ Razorpay key secret not found');
      return NextResponse.json({
        success: false,
        message: "Payment configuration error"
      }, { status: 500 });
    }

    const hmac = crypto.createHmac('sha256', key_secret);
    hmac.update(razorpay_order_id + "|" + razorpay_payment_id);
    const generated_signature = hmac.digest('hex');

    const signatureValid = generated_signature === razorpay_signature;
    console.log('🔐 Signature verification:', {
      valid: signatureValid,
      generated: generated_signature.substring(0, 10) + '...',
      received: razorpay_signature?.substring(0, 10) + '...'
    });

    if (!signatureValid) {
      console.error('❌ Invalid payment signature');
      return NextResponse.json({
        success: false,
        message: "Payment verification failed"
      }, { status: 400 });
    }

    // Start database transaction
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Find temp payment
      let tempPayment = await TempPayment.findOne({ 
        orderId: razorpay_order_id,
        email: result.email,
        status: 'pending'
      }).session(session);

      if (!tempPayment) {
        console.error('❌ No matching temp payment found');
        await session.abortTransaction();
        return NextResponse.json({
          success: false,
          message: "Payment record not found"
        }, { status: 404 });
      }

      console.log('✅ Found temp payment:', {
        id: tempPayment._id,
        amount: tempPayment.amount,
        email: tempPayment.email
      });

      // Find user
      const user = await User.findOne({ email: result.email }).session(session);
      if (!user) {
        console.error('❌ User not found');
        await session.abortTransaction();
        return NextResponse.json({
          success: false,
          message: "User not found"
        }, { status: 404 });
      }

      // Find or create wallet
      let wallet = await Wallet.findOne({ userid: user._id }).session(session);
      if (!wallet) {
        console.log('💳 Creating new wallet');
        wallet = new Wallet({
          userid: user._id,
          balance: 0,
          transactions: []
        });
        await wallet.save({ session });
      }

      // Calculate new balance
      const oldBalance = Number(wallet.balance) || 0;
      const addAmount = Number(tempPayment.amount);
      const newBalance = oldBalance + addAmount;

      console.log('💰 Balance update:', {
        oldBalance,
        addAmount,
        newBalance
      });

      // Create transaction record
      const newTransaction = {
        amount: addAmount,
        description: `Payment via Razorpay - Order: ${razorpay_order_id} - Payment: ${razorpay_payment_id}`,
        type: "credit",
        date: new Date()
      };

      // Update wallet
      const updateResult = await Wallet.findOneAndUpdate(
        { userid: user._id },
        {
          $set: { balance: newBalance },
          $push: { transactions: newTransaction }
        },
        { 
          new: true,
          runValidators: true,
          session
        }
      );

      if (!updateResult) {
        console.error('❌ Failed to update wallet');
        await session.abortTransaction();
        return NextResponse.json({
          success: false,
          message: "Failed to update wallet"
        }, { status: 500 });
      }

      // Mark temp payment as completed
      await TempPayment.findByIdAndUpdate(
        tempPayment._id,
        {
          status: 'completed',
          razorpayPaymentId: razorpay_payment_id,
          completedAt: new Date()
        },
        { session }
      );

      // Commit transaction
      await session.commitTransaction();
      
      console.log('✅ Payment processed successfully:', {
        newBalance: updateResult.balance,
        transactionCount: updateResult.transactions.length
      });

      // Clean up completed temp payment (outside transaction)
      setTimeout(async () => {
        try {
          await TempPayment.deleteOne({ _id: tempPayment._id });
        } catch (cleanupError) {
          console.warn('⚠️ Cleanup warning:', cleanupError);
        }
      }, 5000); // Delete after 5 seconds

      return NextResponse.json({
        success: true,
        message: "Payment processed successfully",
        data: {
          newBalance: updateResult.balance,
          transactionId: newTransaction,
          paymentId: razorpay_payment_id,
          orderId: razorpay_order_id
        }
      });

    } catch (transactionError: any) {
      console.error('💥 Transaction error:', transactionError);
      await session.abortTransaction();
      throw transactionError;
    } finally {
      session.endSession();
    }

  } catch (error: any) {
    console.error('💥 Payment success handler error:', error);
    return NextResponse.json({
      success: false,
      message: "Payment processing failed",
      error: error.message
    }, { status: 500 });
  }
};