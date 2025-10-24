"use client";

declare global {
  interface Window {
    ethereum?: any;
    Razorpay?: any;
  }
}

import { toast } from "sonner";
import React from "react";
import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";
import { ethers } from "ethers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import {
  CreditCardIcon,
  SettingsIcon,
  AlertTriangleIcon,
  FileTextIcon,
  RefreshCwIcon,
  WalletIcon,
  TrendingUpIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  Loader2,
  Plus,
  Activity,
  Eye,
  EyeOff,
  Download,
  CopyIcon,
  Bug,
  CheckCircle,
  XCircle,
} from "lucide-react";

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  BarElement,
} from "chart.js";
import { Line } from "react-chartjs-2";
import { useAppSelector, useAppDispatch } from "@/lib/hook";
import { add as addWallet } from "@/lib/features/wallet/Wallet";
import { add as addUser } from "@/lib/features/user/User";
import { motion } from "framer-motion";

const DynamicToaster = dynamic(
  () => import("sonner").then((mod) => mod.Toaster),
  { 
    ssr: false,
    loading: () => null
  }
) as React.ComponentType<any>;

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend
);

interface Transaction {
  amount: number;
  description: string;
  type: 'credit' | 'debit';
  date: string;
  _id?: string;
}

interface WalletData {
  _id: string;
  userid: string;
  balance: number;
  transactions: Transaction[];
}

interface ProjectData {
  _id: string;
  name: string;
  planid: {
    name: string;
    pricephour: string;
    pricepmonth: string;
  };
  projectstatus: string;
  startdate: string;
  cpuusage?: string;
  memoryusage?: string;
}

interface DebugData {
  user: any;
  wallet: any;
  tempPayments: any;
  environment: any;
}

export default function WalletComponent() {
  const user = useAppSelector((state) => state.user.user);
  const dispatch = useAppDispatch();
  const router = useRouter();
  const searchParams = useSearchParams();

  // State
  const [walletData, setWalletData] = useState<WalletData | null>(null);
  const [projects, setProjects] = useState<ProjectData[]>([]);
  const [addFundsAmount, setAddFundsAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [balanceVisible, setBalanceVisible] = useState(true);
  const [cryptoConnected, setCryptoConnected] = useState(false);
  const [cryptoWalletAddress, setCryptoWalletAddress] = useState("");
  const [cryptoBalance, setCryptoBalance] = useState("0");
  const [cryptoAmount, setCryptoAmount] = useState("");
  
  // Debug state
  const [debugMode, setDebugMode] = useState(false);
  const [debugData, setDebugData] = useState<DebugData | null>(null);
  const [debugLoading, setDebugLoading] = useState(false);

  // Safe transaction sorting function
  const getSortedTransactions = (transactions: Transaction[]) => {
    if (!transactions || !Array.isArray(transactions)) {
      return [];
    }
    
    // Always create a copy before sorting
    return [...transactions].sort((a, b) => {
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      return dateB - dateA; // Most recent first
    });
  };

  // Enhanced payment status handling with better error reporting
  useEffect(() => {
    const paymentStatus = searchParams?.get('payment');
    const amount = searchParams?.get('amount');
    const newBalance = searchParams?.get('new_balance');
    const orderId = searchParams?.get('order_id');
    const paymentId = searchParams?.get('payment_id');
    const message = searchParams?.get('message');

    console.log('URL Parameters:', {
      paymentStatus,
      amount,
      newBalance,
      orderId,
      paymentId,
      message
    });

    if (paymentStatus === 'success' && amount) {
      toast.success(
        `Payment successful! ₹${amount} added to your wallet.${
          newBalance ? ` New balance: ₹${newBalance}` : ''
        }`
      );
      
      // Force refresh wallet data after successful payment
      setTimeout(() => {
        console.log('Refreshing wallet data after successful payment');
        fetchUserAndWalletData();
      }, 1000);
      
      // Clean up URL parameters after showing toast
      setTimeout(() => {
        cleanupUrlParams();
      }, 3000);
      
    } else if (paymentStatus === 'failed') {
      const errorMsg = message || 'Payment verification failed. Please try again.';
      toast.error(errorMsg);
      cleanupUrlParams();
      
    } else if (paymentStatus === 'error') {
      const errorMessage = message || 'Payment processing error';
      toast.error(`Payment error: ${errorMessage}. Please contact support if amount was deducted.`);
      cleanupUrlParams();
    }
  }, [searchParams]);

  const cleanupUrlParams = () => {
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      ['payment', 'amount', 'order_id', 'payment_id', 'new_balance', 'message'].forEach(param => {
        url.searchParams.delete(param);
      });
      window.history.replaceState({}, '', url.toString());
      console.log('URL parameters cleaned up');
    }
  };

  // Initial data fetch
  useEffect(() => {
    const initializeData = async () => {
      setInitialLoading(true);
      try {
        console.log('Initializing wallet data...');
        await Promise.all([
          fetchUserAndWalletData(),
          fetchProjects()
        ]);
        console.log('Wallet initialization complete');
      } catch (error) {
        console.error('Error initializing data:', error);
        toast.error('Failed to load wallet data. Please refresh the page.');
      } finally {
        setInitialLoading(false);
      }
    };

    initializeData();
  }, []);

  // Enhanced fetch function with better error handling and immutable data
  const fetchUserAndWalletData = async () => {
    try {
      setRefreshing(true);
      console.log('🔄 Fetching wallet data...');
      
      const response = await fetch('/api/get/home', {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      const data = await response.json();
      console.log('📊 Home API Response:', data);
      
      if (data.success && data.user && data.wallet) {
        console.log('✅ Wallet data received:', {
          balance: data.wallet.balance,
          transactionCount: data.wallet.transactions?.length || 0,
          balanceType: typeof data.wallet.balance
        });
        
        // Ensure data is properly copied and not referenced
        const walletDataCopy = {
          ...data.wallet,
          balance: Number(data.wallet.balance) || 0,
          transactions: data.wallet.transactions ? [...data.wallet.transactions] : []
        };

        const userDataCopy = { ...data.user };
        
        // Update Redux store with fresh data
        dispatch(addUser(userDataCopy));
        dispatch(addWallet(walletDataCopy));
        setWalletData(walletDataCopy);
        
      } else {
        console.error('❌ Failed to fetch user/wallet data:', data);
        if (data.message && data.message.includes('Authentication')) {
          toast.error('Session expired. Please login again.');
          router.push('/login');
        } else {
          toast.error('Failed to load wallet data');
        }
      }
    } catch (error) {
      console.error('💥 Error fetching user/wallet data:', error);
      toast.error('Error loading data. Please refresh the page.');
    } finally {
      setRefreshing(false);
    }
  };

  // Fetch projects for analytics
  const fetchProjects = async () => {
    try {
      const [regularProjects, webbuilderProjects] = await Promise.all([
        fetch('/api/project/crud', { credentials: 'include' }),
        fetch('/api/project/wordpress', { credentials: 'include' })
      ]);

      const regularData = await regularProjects.json();
      const webbuilderData = await webbuilderProjects.json();

      const allProjects = [
        ...(regularData.success ? regularData.projectdata : []),
        ...(webbuilderData.success ? webbuilderData.projectdata : [])
      ];

      setProjects(allProjects);
      console.log('📈 Projects fetched:', allProjects.length);
    } catch (error) {
      console.error('Error fetching projects:', error);
    }
  };

  // Fetch debug data
  const fetchDebugData = async () => {
    try {
      setDebugLoading(true);
      console.log('🐛 Fetching debug data...');
      
      const response = await fetch('/api/debug/wallet', {
        method: 'GET',
        credentials: 'include',
      });
      
      const data = await response.json();
      console.log('🔍 Debug data received:', data);
      
      if (data.success) {
        setDebugData(data.debug);
      } else {
        console.error('Failed to fetch debug data:', data);
        toast.error('Failed to load debug information');
      }
    } catch (error) {
      console.error('Error fetching debug data:', error);
      toast.error('Error loading debug data');
    } finally {
      setDebugLoading(false);
    }
  };

  // Load Razorpay script
  const loadRazorpayScript = () => {
    return new Promise((resolve) => {
      if (window.Razorpay) {
        console.log('✅ Razorpay script already loaded');
        resolve(true);
        return;
      }
      
      console.log('📥 Loading Razorpay script...');
      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.onload = () => {
        console.log('✅ Razorpay script loaded successfully');
        resolve(true);
      };
      script.onerror = () => {
        console.error('❌ Failed to load Razorpay script');
        resolve(false);
      };
      document.body.appendChild(script);
    });
  };

  // Enhanced Razorpay payment handler with direct success flow
  const handleRazorpayPayment = async () => {
    if (!addFundsAmount || Number(addFundsAmount) <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }

    if (!user?.email) {
      toast.error("User not authenticated. Please login again.");
      return;
    }

    setLoading(true);

    try {
      const amount = Number(addFundsAmount);
      console.log('💳 Initiating payment:', {
        amount,
        userEmail: user.email,
        userName: user.name
      });
      
      const data = { amount, email: user.email, name: user.name };

      const response = await fetch('/api/precheckout', {
        method: "POST",
        credentials: 'include',
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      const result = await response.json();
      console.log('🏦 Precheckout response:', result);

      if (!result.success) {
        toast.error(result.message || "Payment initialization failed. Please try again.");
        return;
      }

      const scriptLoaded = await loadRazorpayScript();
      if (!scriptLoaded) {
        toast.error("Payment system failed to load. Please refresh the page and try again.");
        return;
      }

      const options = {
        key: process.env.NEXT_PUBLIC_KEY_ID,
        amount: result.order.amount,
        currency: "INR",
        name: "DeployLite",
        description: "Add funds to DeployLite Wallet",
        image: "/logo.png",
        order_id: result.order.id,
        prefill: { 
          name: user.name, 
          email: user.email 
        },
        notes: { 
          address: "DeployLite Corporate Office",
          user_id: user.email,
          amount: amount.toString()
        },
        theme: { color: "#8B5CF6" },
        
        // Direct success handler - no webhook dependency!
        handler: async function (response: any) {
          console.log('💰 Payment success response from Razorpay:', response);
          
          try {
            // Show immediate feedback
            toast.loading("Processing your payment...");
            
            // Call our direct success handler
            const successResponse = await fetch('/api/payment-success', {
              method: 'POST',
              credentials: 'include',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                order_amount: amount
              })
            });

            const successData = await successResponse.json();
            console.log('✅ Payment processing result:', successData);

            if (successData.success) {
              toast.dismiss();
              toast.success(`Payment successful! ₹${amount} added to your wallet!`);
              
              setAddFundsAmount("");
              
              // Update wallet data immediately with proper immutable handling
              setWalletData(prev => {
                if (!prev) return null;
                
                const newTransaction = {
                  amount: amount,
                  type: 'credit' as const,
                  description: `Payment via Razorpay - Payment: ${successData.data.paymentId}`,
                  date: new Date().toISOString(),
                  _id: successData.data.paymentId
                };

                return {
                  ...prev,
                  balance: successData.data.newBalance,
                  transactions: [...prev.transactions, newTransaction]
                };
              });
              
              // Also refresh from server to ensure consistency
              setTimeout(() => {
                fetchUserAndWalletData();
              }, 1000);
              
            } else {
              toast.dismiss();
              toast.error(successData.message || "Payment processing failed");
              console.error('❌ Payment processing failed:', successData);
            }
            
          } catch (processingError) {
            console.error('💥 Error processing payment success:', processingError);
            toast.dismiss();
            toast.error("Payment successful but processing failed. Please refresh the page.");
            
            setTimeout(() => {
              fetchUserAndWalletData();
            }, 2000);
          }
        },
        
        modal: {
          ondismiss: function() {
            console.log('🚫 Payment modal dismissed');
            toast.info("Payment cancelled");
          }
        }
      };

      console.log('🚀 Opening Razorpay checkout...');
      const rzp = new window.Razorpay(options);
      rzp.open();
      
    } catch (error) {
      console.error('💥 Payment error:', error);
      toast.error("Payment failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Debug functions
  const handleDebugAction = async (action: string, data?: any) => {
    try {
      setDebugLoading(true);
      console.log(`🔧 Executing debug action: ${action}`);
      
      const response = await fetch('/api/debug/wallet', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...data })
      });

      const result = await response.json();
      console.log(`🔧 Debug action result:`, result);
      
      if (result.success) {
        toast.success(result.message);
        await Promise.all([
          fetchUserAndWalletData(),
          fetchDebugData()
        ]);
      } else {
        toast.error(result.message || 'Debug action failed');
      }
    } catch (error) {
      console.error('Debug action error:', error);
      toast.error('Debug action failed');
    } finally {
      setDebugLoading(false);
    }
  };

  // Crypto wallet functions
  const handleConnectCryptoWallet = async () => {
    try {
      if (!window.ethereum) {
        toast.error("MetaMask not detected!");
        return;
      }
      
      const provider = new ethers.BrowserProvider(window.ethereum);
      const accounts = await provider.send("eth_requestAccounts", []);
      const account = accounts[0] || "";
      
      setCryptoWalletAddress(account);
      setCryptoConnected(true);

      const balanceWei = await provider.getBalance(account);
      const balanceEth = ethers.formatEther(balanceWei);
      setCryptoBalance(balanceEth);
      
      toast.success("MetaMask wallet connected successfully!");
    } catch (error) {
      console.error(error);
      toast.error("Failed to connect MetaMask wallet");
    }
  };

  const handleSendCryptoPayment = async () => {
    if (!cryptoConnected) {
      toast.error("Connect your MetaMask wallet first!");
      return;
    }

    if (!cryptoAmount || Number(cryptoAmount) <= 0) {
      toast.error("Enter a valid ETH amount!");
      return;
    }

    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();

      const tx = await signer.sendTransaction({
        to: "0xeDe6eC29Fb53e32310e0960D35099aE9428700ff",
        value: ethers.parseEther(cryptoAmount),
      });

      toast.success("Transaction sent! Waiting for confirmation...");
      await tx.wait();
      toast.success(`Transaction confirmed! Hash: ${tx.hash}`);
      setCryptoAmount("");
    } catch (error) {
      console.error(error);
      toast.error("Transaction failed!");
    }
  };

  // Manual refresh function
  const handleRefresh = async () => {
    await Promise.all([
      fetchUserAndWalletData(),
      fetchProjects(),
      debugMode ? fetchDebugData() : Promise.resolve()
    ]);
    toast.success("Data refreshed successfully!");
  };

  // Toggle debug mode
  const toggleDebugMode = () => {
    const newDebugMode = !debugMode;
    setDebugMode(newDebugMode);
    
    if (newDebugMode) {
      fetchDebugData();
    }
  };

  // Calculate statistics
  const calculateStats = () => {
    if (!walletData || !projects) return null;

    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();

    const monthlyTransactions = walletData.transactions.filter(tx => {
      const txDate = new Date(tx.date);
      return txDate.getMonth() === currentMonth && txDate.getFullYear() === currentYear;
    });

    const monthlySpent = monthlyTransactions
      .filter(tx => tx.type === 'debit')
      .reduce((sum, tx) => sum + tx.amount, 0);

    const monthlyAdded = monthlyTransactions
      .filter(tx => tx.type === 'credit')
      .reduce((sum, tx) => sum + tx.amount, 0);

    const activeProjects = projects.filter(p => p.projectstatus === 'live').length;
    
    const estimatedMonthlyCost = projects.reduce((sum, project) => {
      if (project.planid?.pricepmonth) {
        return sum + Number(project.planid.pricepmonth);
      }
      return sum;
    }, 0);

    return {
      monthlySpent,
      monthlyAdded,
      activeProjects,
      estimatedMonthlyCost,
      totalProjects: projects.length
    };
  };

  // Enhanced chart data generation with safety checks
  const generateChartData = () => {
    if (!walletData?.transactions || !Array.isArray(walletData.transactions)) {
      return null;
    }

    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - i);
      return date;
    }).reverse();

    const dailySpend = last7Days.map(date => {
      // Safe filtering with proper array checks
      const dayTransactions = walletData.transactions.filter(tx => {
        if (!tx || !tx.date || tx.type !== 'debit') return false;
        
        try {
          const txDate = new Date(tx.date);
          return txDate.toDateString() === date.toDateString();
        } catch {
          return false; // Invalid date
        }
      });
      
      return dayTransactions.reduce((sum, tx) => {
        const amount = Number(tx.amount) || 0;
        return sum + amount;
      }, 0);
    });

    return {
      labels: last7Days.map(date => date.toLocaleDateString('en-US', { weekday: 'short' })),
      datasets: [
        {
          label: 'Daily Spend (₹)',
          data: dailySpend,
          borderColor: '#8B5CF6',
          backgroundColor: 'rgba(139, 92, 246, 0.1)',
          tension: 0.4,
        },
      ],
    };
  };

  const stats = calculateStats();
  const chartData = generateChartData();

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: { 
        position: "top" as const,
        labels: { color: '#E5E7EB' }
      },
      title: { 
        display: true, 
        text: "Daily Spending Pattern",
        color: '#E5E7EB'
      },
    },
    scales: {
      x: {
        grid: { color: "rgba(139, 92, 246, 0.2)" },
        ticks: { color: '#E5E7EB' }
      },
      y: {
        beginAtZero: true,
        grid: { color: "rgba(139, 92, 246, 0.2)" },
        ticks: { color: '#E5E7EB' }
      },
    },
  };

  // Show loading screen while initial data is being fetched
  if (initialLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-black via-gray-900/50 to-black flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-purple-400 mx-auto mb-4" />
          <p className="text-gray-400 text-lg">Loading your wallet...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-gray-900/50 to-black">
      <DynamicToaster position="top-right" />
      
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="max-w-7xl mx-auto p-4 md:p-8"
      >
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
                Wallet
              </h1>
              <p className="text-gray-400 mt-2">Manage your DeployLite balance and transactions</p>
            </div>
            <div className="flex items-center gap-3">
              <Button
                onClick={toggleDebugMode}
                variant="outline"
                size="sm"
                className="border-yellow-500/30 hover:bg-yellow-500/10"
              >
                <Bug className="w-4 h-4 mr-2" />
                Debug {debugMode ? 'On' : 'Off'}
              </Button>
              <Button
                onClick={handleRefresh}
                disabled={refreshing}
                variant="outline"
                className="border-purple-500/30 hover:bg-purple-500/10"
              >
                {refreshing ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <RefreshCwIcon className="w-4 h-4 mr-2" />
                )}
                Refresh
              </Button>
            </div>
          </div>
        </motion.div>

        {/* Debug Panel */}
        {debugMode && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6"
          >
            <Card className="bg-gradient-to-br from-yellow-900/20 via-gray-900/90 to-black border border-yellow-500/30">
              <CardHeader>
                <CardTitle className="text-yellow-400 flex items-center gap-2">
                  <Bug className="w-5 h-5" />
                  Debug Panel
                </CardTitle>
                <CardDescription className="text-yellow-300/70">
                  Diagnostic tools and wallet troubleshooting
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    <Button
                      onClick={() => handleDebugAction('recalculate_balance')}
                      disabled={debugLoading}
                      size="sm"
                      className="bg-yellow-600 hover:bg-yellow-700 text-white"
                    >
                      {debugLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <RefreshCwIcon className="w-4 h-4 mr-2" />}
                      Recalculate Balance
                    </Button>
                    <Button
                      onClick={() => handleDebugAction('cleanup_temp_payments')}
                      disabled={debugLoading}
                      size="sm"
                      className="bg-red-600 hover:bg-red-700 text-white"
                    >
                      {debugLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <XCircle className="w-4 h-4 mr-2" />}
                      Cleanup Temp Payments
                    </Button>
                    <Button
                      onClick={() => handleDebugAction('create_test_transaction', { amount: 10 })}
                      disabled={debugLoading}
                      size="sm"
                      className="bg-green-600 hover:bg-green-700 text-white"
                    >
                      {debugLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle className="w-4 h-4 mr-2" />}
                      Add Test ₹10
                    </Button>
                    <Button
                      onClick={fetchDebugData}
                      disabled={debugLoading}
                      size="sm"
                      variant="outline"
                      className="border-yellow-500/30 hover:bg-yellow-500/10"
                    >
                      {debugLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <RefreshCwIcon className="w-4 h-4 mr-2" />}
                      Refresh Debug
                    </Button>
                  </div>

                  {debugData && (
                    <div className="mt-4">
                      <details className="bg-black/30 p-4 rounded-lg border border-yellow-500/20">
                        <summary className="cursor-pointer font-medium text-yellow-300 hover:text-yellow-200">
                          Debug Information (Click to expand)
                        </summary>
                        <div className="mt-3 space-y-3">
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                            <div className="bg-gray-800/50 p-3 rounded">
                              <h4 className="text-green-400 font-medium mb-2">Wallet Status</h4>
                              <p className="text-gray-300">Balance: ₹{debugData.wallet?.balance || 0}</p>
                              <p className="text-gray-300">Transactions: {debugData.wallet?.transactionCount || 0}</p>
                              <p className="text-gray-300">Type: {typeof debugData.wallet?.balance}</p>
                            </div>
                            <div className="bg-gray-800/50 p-3 rounded">
                              <h4 className="text-blue-400 font-medium mb-2">Temp Payments</h4>
                              <p className="text-gray-300">User Pending: {debugData.tempPayments?.userPayments?.length || 0}</p>
                              <p className="text-gray-300">All Recent: {debugData.tempPayments?.allRecentPayments?.length || 0}</p>
                            </div>
                            <div className="bg-gray-800/50 p-3 rounded">
                              <h4 className="text-purple-400 font-medium mb-2">Environment</h4>
                              <p className="text-gray-300">Mode: {debugData.environment?.nodeEnv}</p>
                              <p className="text-gray-300">Razorpay: {debugData.environment?.razorpayKeyId}</p>
                            </div>
                          </div>
                          <details className="bg-gray-900/50 p-3 rounded border border-gray-700">
                            <summary className="cursor-pointer text-gray-400 hover:text-gray-300">
                              Full Debug Data (JSON)
                            </summary>
                            <pre className="mt-2 text-xs overflow-x-auto text-gray-400">
                              {JSON.stringify(debugData, null, 2)}
                            </pre>
                          </details>
                        </div>
                      </details>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Main Balance Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card className="mb-8 bg-gradient-to-br from-black via-gray-900/90 to-black backdrop-blur-xl border border-purple-500/20 shadow-2xl">
            <div className="bg-gradient-to-br from-purple-900/20 to-blue-900/20 p-8">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-4 bg-gradient-to-r from-purple-500/20 to-blue-500/20 rounded-2xl">
                    <WalletIcon className="w-8 h-8 text-purple-400" />
                  </div>
                  <div>
                    <CardTitle className="text-2xl mb-2 text-gray-100">
                      DeployLite Balance
                    </CardTitle>
                    <CardDescription className="text-gray-400">
                      Available funds for deployments and services
                    </CardDescription>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setBalanceVisible(!balanceVisible)}
                  className="text-gray-400 hover:text-gray-200"
                >
                  {balanceVisible ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </Button>
              </div>
              
              <div className="mt-6 flex items-center gap-4">
                <div>
                  <p className="text-5xl font-bold text-purple-400">
                    {balanceVisible ? `₹${walletData?.balance?.toFixed(2) || '0.00'}` : '₹****'}
                  </p>
                  <p className="text-gray-400 mt-2">
                    Last updated: {new Date().toLocaleString()}
                  </p>
                </div>
                <div className="ml-4">
                  {walletData?.balance !== undefined ? (
                    <div className="flex items-center gap-2 text-green-400">
                      <CheckCircle className="w-4 h-4" />
                      <span className="text-sm">Verified</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-yellow-400">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span className="text-sm">Loading...</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </Card>
        </motion.div>

        {/* Stats Grid */}
        {stats && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8"
          >
            <Card className="bg-gradient-to-br from-black via-gray-900/90 to-black border border-purple-500/20">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-400 text-sm">Monthly Spent</p>
                    <p className="text-2xl font-bold text-red-400">₹{stats.monthlySpent}</p>
                  </div>
                  <ArrowDownIcon className="w-8 h-8 text-red-400" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-black via-gray-900/90 to-black border border-purple-500/20">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-400 text-sm">Monthly Added</p>
                    <p className="text-2xl font-bold text-green-400">₹{stats.monthlyAdded}</p>
                  </div>
                  <ArrowUpIcon className="w-8 h-8 text-green-400" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-black via-gray-900/90 to-black border border-purple-500/20">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-400 text-sm">Active Projects</p>
                    <p className="text-2xl font-bold text-blue-400">{stats.activeProjects}</p>
                  </div>
                  <Activity className="w-8 h-8 text-blue-400" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-black via-gray-900/90 to-black border border-purple-500/20">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-400 text-sm">Est. Monthly Cost</p>
                    <p className="text-2xl font-bold text-orange-400">₹{stats.estimatedMonthlyCost}</p>
                  </div>
                  <TrendingUpIcon className="w-8 h-8 text-orange-400" />
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Add Funds Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8"
        >
          <Card className="lg:col-span-2 bg-gradient-to-br from-black via-gray-900/90 to-black border border-purple-500/20">
            <CardHeader>
              <CardTitle className="text-gray-100 flex items-center gap-2">
                <Plus className="w-5 h-5 text-purple-400" />
                Add Funds - Direct Success Flow
              </CardTitle>
              <CardDescription className="text-gray-400">
                Add money instantly to your wallet with direct payment processing
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {[100, 500, 1000, 2000].map((amount) => (
                    <Button
                      key={amount}
                      variant="outline"
                      size="sm"
                      onClick={() => setAddFundsAmount(amount.toString())}
                      className="border-purple-500/30 hover:bg-purple-500/10"
                    >
                      ₹{amount}
                    </Button>
                  ))}
                </div>
                <div className="flex gap-4">
                  <Input
                    placeholder="Enter amount (min ₹1)"
                    value={addFundsAmount}
                    onChange={(e) => setAddFundsAmount(e.target.value)}
                    className="bg-black/50 border-gray-700 text-white"
                    type="number"
                    min="1"
                    max="50000"
                  />
                  <Button
                    onClick={handleRazorpayPayment}
                    disabled={loading || !addFundsAmount || Number(addFundsAmount) <= 0}
                    className="bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 min-w-[140px]"
                  >
                    {loading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <CreditCardIcon className="w-4 h-4 mr-2" />
                        Add Funds
                      </>
                    )}
                  </Button>
                </div>
                <div className="text-xs text-gray-500 space-y-1">
                  <p>✓ Instant wallet update on payment success</p>
                  <p>✓ No webhook dependency for faster processing</p>
                  <p>✓ Enhanced error handling and retry mechanism</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-black via-gray-900/90 to-black border border-purple-500/20">
            <CardHeader>
              <CardTitle className="text-gray-100">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button 
                variant="outline" 
                className="w-full border-purple-500/30 hover:bg-purple-500/10"
                onClick={() => router.push('/settings')}
              >
                <SettingsIcon className="w-4 h-4 mr-2" />
                Account Settings
              </Button>
              <Button 
                variant="outline" 
                className="w-full border-purple-500/30 hover:bg-purple-500/10"
              >
                <Download className="w-4 h-4 mr-2" />
                Download Statement
              </Button>
              <Button 
                variant="outline" 
                className="w-full border-purple-500/30 hover:bg-purple-500/10"
              >
                <AlertTriangleIcon className="w-4 h-4 mr-2" />
                Usage Alerts
              </Button>
            </CardContent>
          </Card>
        </motion.div>

        {/* Tabs Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <Tabs defaultValue="transactions" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="transactions" className="data-[state=active]:bg-purple-500/20">
                Transactions
              </TabsTrigger>
              <TabsTrigger value="analytics" className="data-[state=active]:bg-purple-500/20">
                Analytics
              </TabsTrigger>
              <TabsTrigger value="projects" className="data-[state=active]:bg-purple-500/20">
                Projects
              </TabsTrigger>
              <TabsTrigger value="crypto" className="data-[state=active]:bg-purple-500/20">
                Crypto
              </TabsTrigger>
            </TabsList>

            {/* Transactions Tab - FIXED SORTING */}
            <TabsContent value="transactions">
              <Card className="bg-gradient-to-br from-black via-gray-900/90 to-black border border-purple-500/20">
                <CardHeader>
                  <div className="flex justify-between items-center">
                    <div>
                      <CardTitle className="text-gray-100">Transaction History</CardTitle>
                      <CardDescription className="text-gray-400">
                        All your wallet transactions with enhanced details
                      </CardDescription>
                    </div>
                    <Button
                      onClick={fetchUserAndWalletData}
                      disabled={refreshing}
                      variant="outline"
                      size="sm"
                      className="border-purple-500/30 hover:bg-purple-500/10"
                    >
                      {refreshing ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <RefreshCwIcon className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {walletData?.transactions && walletData.transactions.length > 0 ? (
                    <div className="space-y-4 max-h-96 overflow-y-auto">
                      {/* FIXED: Use getSortedTransactions helper function */}
                      {getSortedTransactions(walletData.transactions).map((tx, index) => (
                        <div
                          key={tx._id || index}
                          className="flex items-center justify-between p-4 rounded-lg bg-gray-800/50 border border-gray-700/50 hover:bg-gray-800/70 transition-colors"
                        >
                          <div className="flex items-center gap-4">
                            <div className={`p-2 rounded-lg ${
                              tx.type === 'credit' 
                                ? 'bg-green-500/20 text-green-400' 
                                : 'bg-red-500/20 text-red-400'
                            }`}>
                              {tx.type === 'credit' ? 
                                <ArrowUpIcon className="w-4 h-4" /> : 
                                <ArrowDownIcon className="w-4 h-4" />
                              }
                            </div>
                            <div>
                              <p className="font-medium text-gray-200">{tx.description}</p>
                              <p className="text-sm text-gray-400">
                                {new Date(tx.date).toLocaleDateString()} at{' '}
                                {new Date(tx.date).toLocaleTimeString()}
                              </p>
                              {tx._id && (
                                <p className="text-xs text-gray-500 font-mono">
                                  ID: {tx._id.slice(-8)}
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="text-right">
                            <p className={`font-bold ${
                              tx.type === 'credit' ? 'text-green-400' : 'text-red-400'
                            }`}>
                              {tx.type === 'credit' ? '+' : '-'}₹{Number(tx.amount).toFixed(2)}
                            </p>
                            <p className="text-xs text-gray-500 capitalize">{tx.type}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <div className="w-16 h-16 bg-gray-700/50 rounded-full flex items-center justify-center mx-auto mb-4">
                        <FileTextIcon className="w-8 h-8 text-gray-500" />
                      </div>
                      <p className="text-gray-400 mb-2">No transactions found</p>
                      <p className="text-sm text-gray-500">Your transaction history will appear here</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Analytics Tab */}
            <TabsContent value="analytics">
              <Card className="bg-gradient-to-br from-black via-gray-900/90 to-black border border-purple-500/20">
                <CardHeader>
                  <CardTitle className="text-gray-100">Spending Analytics</CardTitle>
                  <CardDescription className="text-gray-400">
                    Your spending patterns over time
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {chartData ? (
                    <div className="h-80">
                      <Line data={chartData} options={chartOptions} />
                    </div>
                  ) : (
                    <div className="h-80 flex items-center justify-center">
                      <div className="text-center">
                        <TrendingUpIcon className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                        <p className="text-gray-400">No data available for chart</p>
                        <p className="text-sm text-gray-500 mt-2">Make some transactions to see analytics</p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Projects Tab */}
            <TabsContent value="projects">
              <Card className="bg-gradient-to-br from-black via-gray-900/90 to-black border border-purple-500/20">
                <CardHeader>
                  <CardTitle className="text-gray-100">Project Costs</CardTitle>
                  <CardDescription className="text-gray-400">
                    Monthly costs for your active projects
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {projects.length > 0 ? (
                    <div className="space-y-4">
                      {projects.map((project) => (
                        <div
                          key={project._id}
                          className="flex items-center justify-between p-4 rounded-lg bg-gray-800/50 border border-gray-700/50"
                        >
                          <div>
                            <p className="font-medium text-gray-200">{project.name}</p>
                            <p className="text-sm text-gray-400">
                              {project.planid?.name || 'Unknown Plan'} • Status: {project.projectstatus}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-purple-400">
                              ₹{project.planid?.pricepmonth || 0}/month
                            </p>
                            <p className="text-sm text-gray-400">
                              ₹{project.planid?.pricephour || 0}/hour
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <p className="text-gray-400">No projects found</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Crypto Tab */}
            <TabsContent value="crypto">
              <Card className="bg-gradient-to-br from-black via-gray-900/90 to-black border border-purple-500/20">
                <CardHeader>
                  <CardTitle className="text-gray-100 flex items-center gap-2">
                    <WalletIcon className="w-5 h-5 text-purple-400" />
                    Crypto Wallet
                  </CardTitle>
                  <CardDescription className="text-gray-400">
                    Connect your MetaMask wallet for crypto payments
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {cryptoConnected ? (
                    <div className="space-y-6">
                      <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/20">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
                          <span className="text-green-400 font-medium">Wallet Connected</span>
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-gray-300 text-sm">Address:</span>
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-xs text-gray-200">
                                {cryptoWalletAddress.slice(0, 6)}...{cryptoWalletAddress.slice(-4)}
                              </span>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  navigator.clipboard.writeText(cryptoWalletAddress);
                                  toast.success("Address copied to clipboard");
                                }}
                                className="h-6 w-6 p-0"
                              >
                                <CopyIcon className="w-3 h-3" />
                              </Button>
                            </div>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-gray-300 text-sm">Balance:</span>
                            <span className="text-purple-400 font-medium">
                              {Number(cryptoBalance).toFixed(4)} ETH
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <label htmlFor="cryptoAmount" className="text-gray-200 text-sm font-medium block">
                          Payment Amount (ETH)
                        </label>
                        <div className="flex gap-2">
                          <Input
                            id="cryptoAmount"
                            placeholder="0.001"
                            value={cryptoAmount}
                            onChange={(e) => setCryptoAmount(e.target.value)}
                            className="bg-black/50 border-gray-700 text-white"
                            type="number"
                            step="0.001"
                            min="0"
                          />
                          <Button
                            onClick={handleSendCryptoPayment}
                            disabled={!cryptoAmount || Number(cryptoAmount) <= 0}
                            className="bg-gradient-to-r from-orange-500 to-yellow-500 hover:from-orange-600 hover:to-yellow-600 min-w-[100px]"
                          >
                            Send ETH
                          </Button>
                        </div>
                        {cryptoAmount && Number(cryptoAmount) > 0 && (
                          <p className="text-sm text-gray-400">
                            ≈ ₹{(Number(cryptoAmount) * 150000).toFixed(2)} INR
                          </p>
                        )}
                      </div>

                      <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/20">
                        <div className="flex items-start gap-3">
                          <AlertTriangleIcon className="w-5 h-5 text-amber-400 mt-0.5 flex-shrink-0" />
                          <div>
                            <h4 className="text-amber-400 font-medium">Important Notice</h4>
                            <p className="text-amber-300/80 text-sm mt-1">
                              Crypto payments are sent directly to our wallet address. 
                              Please ensure you're sending from a compatible wallet and network.
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center space-y-4">
                      <div className="p-8">
                        <WalletIcon className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                        <h3 className="text-lg font-medium text-gray-200 mb-2">
                          Connect MetaMask Wallet
                        </h3>
                        <p className="text-gray-400 mb-6">
                          Connect your MetaMask wallet to make crypto payments for DeployLite services
                        </p>
                        <Button
                          onClick={handleConnectCryptoWallet}
                          className="bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600"
                        >
                          <WalletIcon className="w-4 h-4 mr-2" />
                          Connect MetaMask
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </motion.div>
      </motion.div>
    </div>
  );
}