import Razorpay from 'razorpay';
import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import ConnectDb from '../../../../middleware/connectdb';
import TempPayment from '../../../../models/TempPayment';
import Wallet from '../../../../models/Wallet';
import User from '../../../../models/User';
import mongoose from 'mongoose';

export const POST = async (req: NextRequest) => {
  console.log('🔄 PostCheckout API called at:', new Date().toISOString());
  
  try {
    await ConnectDb();
    console.log('✅ Database connected successfully');
    
    // Parse form data from Razorpay callback
    const formData = await req.formData();
    const body = Object.fromEntries(formData.entries());
    
    console.log('📝 Razorpay callback data received:', {
      order_id: body.razorpay_order_id,
      payment_id: body.razorpay_payment_id,
      signature_present: !!body.razorpay_signature,
      timestamp: new Date().toISOString()
    });

    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = body;

    // Validate required parameters
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      console.error('❌ Missing required Razorpay parameters:', {
        order_id: !!razorpay_order_id,
        payment_id: !!razorpay_payment_id,
        signature: !!razorpay_signature
      });
      
      return NextResponse.redirect(
        new URL('/wallet?payment=error&message=Missing payment parameters', req.url)
      );
    }

    // Verify Razorpay signature
    const key_secret = process.env.NEXT_PUBLIC_KEY_SECRET;
    if (!key_secret) {
      console.error('❌ Razorpay key secret not found in environment');
      return NextResponse.redirect(
        new URL('/wallet?payment=error&message=Server configuration error', req.url)
      );
    }

    const hmac = crypto.createHmac('sha256', key_secret);
    hmac.update(razorpay_order_id + "|" + razorpay_payment_id);
    const generated_signature = hmac.digest('hex');

    const signatureValid = generated_signature === razorpay_signature.toString();
    console.log('🔐 Signature verification:', {
      valid: signatureValid,
      order_id: razorpay_order_id,
      payment_id: razorpay_payment_id,
      generated_signature: generated_signature.substring(0, 10) + '...',
      received_signature: razorpay_signature.toString().substring(0, 10) + '...'
    });

    if (!signatureValid) {
      console.error('❌ Payment signature verification failed');
      
      // Update any matching temp payment to failed status
      await TempPayment.updateMany(
        { orderId: razorpay_order_id.toString() },
        { status: 'failed' }
      );
      
      return NextResponse.redirect(
        new URL('/wallet?payment=failed&message=Invalid payment signature', req.url)
      );
    }

    console.log('✅ Payment signature verified successfully');

    // Start database transaction
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Find temp payment by order ID
      let tempPayment = await TempPayment.findOne({ 
        orderId: razorpay_order_id.toString(),
        status: 'pending'
      }).session(session);

      console.log('🔍 Temp payment search result:', {
        found: !!tempPayment,
        orderId: razorpay_order_id.toString(),
        tempPaymentData: tempPayment ? {
          id: tempPayment._id,
          email: tempPayment.email,
          amount: tempPayment.amount,
          status: tempPayment.status,
          createdAt: tempPayment.createdAt
        } : null
      });

      if (!tempPayment) {
        console.error('❌ No matching temp payment record found for order ID:', razorpay_order_id);
        
        // Check if there are any temp payments for debugging
        const allTempPayments = await TempPayment.find({}).limit(5).session(session);
        console.log('🔍 Recent temp payments for debugging:', allTempPayments.map(tp => ({
          id: tp._id,
          orderId: tp.orderId,
          email: tp.email,
          amount: tp.amount,
          status: tp.status,
          createdAt: tp.createdAt
        })));

        await session.abortTransaction();
        return NextResponse.redirect(
          new URL(`/wallet?payment=error&message=Payment record not found for order ${razorpay_order_id}`, req.url)
        );
      }

      console.log('📋 Processing temp payment:', {
        id: tempPayment._id,
        email: tempPayment.email,
        amount: tempPayment.amount,
        orderId: tempPayment.orderId,
        status: tempPayment.status
      });

      // Update temp payment status to processing
      await TempPayment.findByIdAndUpdate(
        tempPayment._id, 
        { status: 'processing' },
        { session }
      );
      console.log('🔄 Updated temp payment status to processing');

      // Find user
      const user = await User.findOne({ email: tempPayment.email }).session(session);
      if (!user) {
        console.error('❌ User not found for email:', tempPayment.email);
        
        await TempPayment.findByIdAndUpdate(
          tempPayment._id, 
          { status: 'failed' },
          { session }
        );
        
        await session.abortTransaction();
        return NextResponse.redirect(
          new URL('/wallet?payment=error&message=User not found', req.url)
        );
      }

      console.log('👤 User found:', {
        email: user.email,
        name: user.name,
        id: user._id
      });

      // Find or create wallet
      let wallet = await Wallet.findOne({ userid: user._id }).session(session);
      
      if (!wallet) {
        console.log('💳 Creating new wallet for user');
        wallet = new Wallet({
          userid: user._id,
          balance: 0,
          transactions: []
        });
        await wallet.save({ session });
        console.log('✅ New wallet created with ID:', wallet._id);
      }

      // Ensure balance is a number
      const oldBalance = Number(wallet.balance) || 0;
      const addAmount = Number(tempPayment.amount);
      const newBalance = oldBalance + addAmount;

      console.log('💰 Wallet update calculation:', {
        walletId: wallet._id,
        oldBalance,
        addAmount,
        newBalance,
        oldBalanceType: typeof oldBalance,
        addAmountType: typeof addAmount
      });

      // Create new transaction record
      const newTransaction = {
        amount: addAmount,
        description: `Payment via Razorpay - Order: ${razorpay_order_id} - Payment: ${razorpay_payment_id}`,
        type: "credit",
        date: new Date()
      };

      console.log('📝 Creating transaction:', newTransaction);

      // Update wallet with new balance and transaction
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
        
        await TempPayment.findByIdAndUpdate(
          tempPayment._id, 
          { status: 'failed' },
          { session }
        );
        
        await session.abortTransaction();
        return NextResponse.redirect(
          new URL('/wallet?payment=error&message=Failed to update wallet', req.url)
        );
      }

      console.log('✅ Wallet updated successfully:', {
        walletId: updateResult._id,
        newBalance: updateResult.balance,
        transactionCount: updateResult.transactions.length,
        latestTransactionAmount: updateResult.transactions[updateResult.transactions.length - 1]?.amount
      });

      // Verify the update by checking the balance
      const verifyWallet = await Wallet.findOne({ userid: user._id }).session(session);
      console.log('🔍 Verification - wallet balance after update:', {
        balance: verifyWallet?.balance,
        balanceType: typeof verifyWallet?.balance,
        transactionCount: verifyWallet?.transactions?.length,
        userId: user._id.toString()
      });

      // Update temp payment status to completed
      await TempPayment.findByIdAndUpdate(
        tempPayment._id, 
        { 
          status: 'completed',
          completedAt: new Date()
        },
        { session }
      );
      console.log('✅ Updated temp payment status to completed');

      // Commit transaction
      await session.commitTransaction();
      console.log('✅ Database transaction committed successfully');

      // Clean up completed temp payment (outside transaction)
      try {
        const deleteResult = await TempPayment.deleteOne({ _id: tempPayment._id });
        console.log('🗑️ Temp payment cleanup:', {
          deleted: deleteResult.deletedCount,
          tempPaymentId: tempPayment._id
        });
      } catch (cleanupError) {
        console.warn('⚠️ Cleanup warning (non-critical):', cleanupError);
      }

      // Create success redirect URL
      const redirectUrl = new URL('/wallet', req.url);
      redirectUrl.searchParams.set('payment', 'success');
      redirectUrl.searchParams.set('amount', addAmount.toString());
      redirectUrl.searchParams.set('order_id', razorpay_order_id.toString());
      redirectUrl.searchParams.set('payment_id', razorpay_payment_id.toString());
      redirectUrl.searchParams.set('new_balance', newBalance.toString());
      
      console.log('🎉 Payment successful - redirecting to wallet with success parameters:', {
        url: redirectUrl.pathname + redirectUrl.search,
        amount: addAmount,
        newBalance: newBalance,
        orderId: razorpay_order_id,
        paymentId: razorpay_payment_id
      });

      return NextResponse.redirect(redirectUrl.toString());

    } catch (transactionError: any) {
      console.error('💥 Transaction error - rolling back:', {
        message: transactionError.message,
        stack: transactionError.stack
      });
      
      await session.abortTransaction();
      throw transactionError;
    } finally {
      session.endSession();
    }

  } catch (error: any) {
    console.error('💥 PostCheckout API error:', {
      message: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });
    
    return NextResponse.redirect(
      new URL('/wallet?payment=error&message=Payment processing failed. Please contact support if amount was deducted.', req.url)
    );
  }
};