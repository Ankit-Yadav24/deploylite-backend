"use client"

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import DeployOnVultr from '@/utils/api-calls-vltr/deploy'
import Image from 'next/image'
import { 
  Cloud, 
  CreditCard, 
  DollarSign, 
  Server, 
  AlertCircle, 
  CheckCircle, 
  Loader2, 
  Globe, 
  Database, 
  Code,
  Bot,
  Shield,
  Zap,
  HardDrive,
  Activity,
  ExternalLink,
  Plus,
  Eye,
  EyeOff
} from 'lucide-react'
import { toast } from "sonner"
import { FaRobot, FaVuejs } from "react-icons/fa"

// Animation variants
const fadeIn = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.25, 0.4, 0.25, 1] } }
}

const stagger = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1 } }
}

const scaleIn = {
  hidden: { scale: 0.95, opacity: 0 },
  visible: { scale: 1, opacity: 1, transition: { duration: 0.3, ease: "easeOut" } }
}

const slideIn = {
  hidden: { opacity: 0, x: 20 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.3, ease: "easeOut" } }
}

interface VultrAccount {
  email: string
  name: string
  balance: number
  pending_charges: number
  last_payment_date: string
  last_payment_amount: number
  acls: string[]
}

export default function VultrPage() {
  const [isConnected, setIsConnected] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isVerifying, setIsVerifying] = useState(false)
  const [apiKey, setApiKey] = useState('')
  const [showApiKey, setShowApiKey] = useState(false)
  const [accountData, setAccountData] = useState<VultrAccount | null>(null)
  const [error, setError] = useState('')

  // Check if Vultr is already connected on component mount
  useEffect(() => {
    checkVultrConnection()
  }, [])

  const checkVultrConnection = async () => {
    try {
      setIsLoading(true)
      const response = await fetch('/api/vultr/account')
      const result = await response.json()
      
      if (result.status && result.data) {
        setIsConnected(true)
        setAccountData(result.data)
      }
    } catch (error) {
      console.error('Error checking Vultr connection:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleConnectVultr = async () => {
    if (!apiKey.trim()) {
      setError('Please enter a valid API key')
      return
    }

    setIsVerifying(true)
    setError('')

    try {
      if (apiKey.length < 10) {
        setError('API key appears to be too short. Please check your Vultr API key.')
        setIsVerifying(false)
        return
      }

      // Save to database
      const saveResponse = await fetch('/api/vultr/account', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          api_key: apiKey.trim(),
          account_data: accountData
        })
      })

      const result = await saveResponse.json()

      if (result.status) {
        setIsConnected(true)
        setAccountData(accountData)
        toast.success('Vultr account connected successfully!')
        toast.info('Note: This is a demo integration. In production, API key would be verified with Vultr servers.')
        setApiKey('')
      } else {
        setError(result.error || 'Failed to save Vultr account')
        toast.error('Failed to save Vultr account')
      }
    } catch (error) {
      console.error('Connection error:', error)
      setError('Network error. Please try again.')
      toast.error('Network error. Please try again.')
    } finally {
      setIsVerifying(false)
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount)
  }

  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A'
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-black via-gray-900/50 to-black flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-pink-400 mx-auto mb-4" />
          <p className="text-gray-300">Loading Vultr integration...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-gray-900/50 to-black">
      <motion.div
        initial="hidden"
        animate="visible"
        variants={stagger}
        className="max-w-7xl mx-auto p-6 space-y-8"
      >
        {/* Header */}
        <motion.div variants={fadeIn} className="text-center">
          <div className="flex items-center justify-center mb-6">
            <div className="p-4 bg-gradient-to-r from-pink-500/20 to-purple-500/20 rounded-2xl">
               <Image
              src="/vultr.png"
              alt="oops"
              height={60}
              width={60}
              />
            </div>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-pink-400 to-purple-400 bg-clip-text text-transparent mb-4">
            Vultr Integration
          </h1>
          <p className="text-lg text-gray-400 max-w-2xl mx-auto">
            Connect your Vultr account to manage and deploy infrastructure directly from DeployLite
          </p>
        </motion.div>

        <AnimatePresence mode="wait">
          {!isConnected ? (
            /* Connection Form */
            <motion.div
              key="connection-form"
              initial="hidden"
              animate="visible"
              exit="hidden"
              variants={slideIn}
            >
              <Card className="max-w-md mx-auto bg-gradient-to-br from-black via-gray-900/90 to-black backdrop-blur-xl border border-pink-500/20">
                <CardHeader className="text-center">
                  <CardTitle className="text-2xl font-bold text-gray-100 flex items-center justify-center gap-3">
                    <Shield className="w-6 h-6 text-pink-400" />
                    Connect Vultr Account
                  </CardTitle>
                  <CardDescription className="text-gray-400">
                    Enter your Vultr API key to get started
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="api-key" className="text-gray-300 font-medium">
                      Vultr API Key
                    </Label>
                    <div className="relative">
                      <Input
                        id="api-key"
                        type={showApiKey ? "text" : "password"}
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                        placeholder="Enter your Vultr API key"
                        className="bg-black/50 border-gray-700 text-white placeholder-gray-500 focus:border-pink-500/50 pr-10"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowApiKey(!showApiKey)}
                        className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 p-0 hover:bg-pink-500/10"
                      >
                        {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </Button>
                    </div>
                    {error && (
                      <p className="text-red-400 text-sm flex items-center gap-2">
                        <AlertCircle className="w-4 h-4" />
                        {error}
                      </p>
                    )}
                  </div>

                  <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <AlertCircle className="w-5 h-5 text-blue-400 mt-0.5" />
                      <div>
                        <h4 className="font-medium text-blue-400 mb-1">How to get your API key</h4>
                        <ol className="text-sm text-blue-300/80 space-y-1 list-decimal list-inside">
                          <li>Log in to your Vultr account</li>
                          <li>Navigate to Account → API</li>
                          <li>Click "Enable API"</li>
                          <li>Copy your API key</li>
                        </ol>
                      </div>
                    </div>
                  </div>

                  <Button
                    onClick={handleConnectVultr}
                    disabled={isVerifying || !apiKey.trim()}
                    className="w-full bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600 text-white border-0 h-12 text-lg font-semibold rounded-xl shadow-lg shadow-pink-500/25"
                  >
                    {isVerifying ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin mr-2" />
                        Verifying...
                      </>
                    ) : (
                      <>
                        <CheckCircle className="w-5 h-5 mr-2" />
                        Connect Account
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          ) : (
            /* Connected Dashboard */
            <motion.div
              key="connected-dashboard"
              initial="hidden"
              animate="visible"
              variants={stagger}
              className="space-y-8"
            >
              {/* Account Overview Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <motion.div variants={scaleIn}>
                  <Card className="bg-gradient-to-br from-black via-gray-900/90 to-black backdrop-blur-xl border border-pink-500/20 hover:border-pink-500/40 transition-all duration-300">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium text-gray-300">Account Balance</CardTitle>
                      <DollarSign className="h-4 w-4 text-green-400" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-green-400">
                        {formatCurrency(accountData?.balance || 0)}
                      </div>
                      <p className="text-xs text-gray-400 mt-1">
                        Available credit
                      </p>
                    </CardContent>
                  </Card>
                </motion.div>

                <motion.div variants={scaleIn}>
                  <Card className="bg-gradient-to-br from-black via-gray-900/90 to-black backdrop-blur-xl border border-pink-500/20 hover:border-pink-500/40 transition-all duration-300">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium text-gray-300">Pending Charges</CardTitle>
                      <CreditCard className="h-4 w-4 text-amber-400" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-amber-400">
                        {formatCurrency(accountData?.pending_charges || 0)}
                      </div>
                      <p className="text-xs text-gray-400 mt-1">
                        Current month usage
                      </p>
                    </CardContent>
                  </Card>
                </motion.div>

                <motion.div variants={scaleIn}>
                  <Card className="bg-gradient-to-br from-black via-gray-900/90 to-black backdrop-blur-xl border border-pink-500/20 hover:border-pink-500/40 transition-all duration-300">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium text-gray-300">Account Email</CardTitle>
                      <Activity className="h-4 w-4 text-blue-400" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-lg font-bold text-blue-400 truncate">
                        {accountData?.email || 'N/A'}
                      </div>
                      <p className="text-xs text-gray-400 mt-1">
                        Primary email
                      </p>
                    </CardContent>
                  </Card>
                </motion.div>

                <motion.div variants={scaleIn}>
                  <Card className="bg-gradient-to-br from-black via-gray-900/90 to-black backdrop-blur-xl border border-pink-500/20 hover:border-pink-500/40 transition-all duration-300">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium text-gray-300">Account Name</CardTitle>
                      <Server className="h-4 w-4 text-purple-400" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-lg font-bold text-purple-400">
                        {accountData?.name || 'N/A'}
                      </div>
                      <p className="text-xs text-gray-400 mt-1">
                        Account holder
                      </p>
                    </CardContent>
                  </Card>
                </motion.div>
              </div>

              {/* Deployment Options */}
              <motion.div variants={fadeIn}>
                <h2 className="text-2xl font-bold text-gray-100 mb-6 text-center">
                  Deploy with Vultr Infrastructure
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  {/* App Platform */}
                  <motion.div variants={scaleIn} whileHover={{ scale: 1.02, y: -5 }}>
                    <Card className="bg-gradient-to-br from-black via-gray-900/90 to-black backdrop-blur-xl border border-pink-500/20 hover:border-pink-500/40 transition-all duration-300 cursor-pointer group h-full">
                      <CardHeader className="text-center pb-4">
                        <div className="mx-auto p-4 bg-gradient-to-r from-pink-500/20 to-purple-500/20 rounded-2xl mb-4 group-hover:from-pink-500/30 group-hover:to-purple-500/30 transition-all duration-300">
                          <Code className="w-12 h-12 text-pink-400" />
                        </div>
                        <CardTitle className="text-xl font-bold text-gray-100 group-hover:text-pink-300 transition-colors">
                          App Platform
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="text-center">
                        <p className="text-gray-400 mb-4 text-sm">
                          Deploy web applications, APIs, and microservices
                        </p>
                        <div className="space-y-2 mb-6">
                          <Badge variant="outline" className="border-pink-500/30 text-pink-300 text-xs">
                            React, Next.js, Vue
                          </Badge>
                          <Badge variant="outline" className="border-purple-500/30 text-purple-300 text-xs">
                            Node.js, Python, Java
                          </Badge>
                        </div>
                        <Button 
                          className="w-full bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600 text-white border-0 rounded-xl font-medium shadow-lg shadow-pink-500/25"
                          onClick={async() =>{ 
                            let rand = Math.ceil(Math.random()*100);
                            await DeployOnVultr(`deploylite-container-appplatform${rand}`)
                            window.open('/project/app-platform', '_blank')
                          }}      
                        >
                          <Plus className="w-4 h-4 mr-2" />
                          Create App
                        </Button>
                      </CardContent>
                    </Card>
                  </motion.div>

                  {/* Web Builder */}
                  <motion.div variants={scaleIn} whileHover={{ scale: 1.02, y: -5 }}>
                    <Card className="bg-gradient-to-br from-black via-gray-900/90 to-black backdrop-blur-xl border border-pink-500/20 hover:border-pink-500/40 transition-all duration-300 cursor-pointer group h-full">
                      <CardHeader className="text-center pb-4">
                        <div className="mx-auto p-4 bg-gradient-to-r from-blue-500/20 to-cyan-500/20 rounded-2xl mb-4 group-hover:from-blue-500/30 group-hover:to-cyan-500/30 transition-all duration-300">
                          <Globe className="w-12 h-12 text-blue-400" />
                        </div>
                        <CardTitle className="text-xl font-bold text-gray-100 group-hover:text-blue-300 transition-colors">
                          Web Builder
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="text-center">
                        <p className="text-gray-400 mb-4 text-sm">
                          Create websites with WordPress and other CMS
                        </p>
                        <div className="space-y-2 mb-6">
                          <Badge variant="outline" className="border-blue-500/30 text-blue-300 text-xs">
                            WordPress
                          </Badge>
                          <Badge variant="outline" className="border-cyan-500/30 text-cyan-300 text-xs">
                            No-code solution
                          </Badge>
                        </div>
                        <Button 
                          className="w-full bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white border-0 rounded-xl font-medium shadow-lg shadow-blue-500/25"
                          onClick={async() => {
                             let rand = Math.ceil(Math.random()*100);
                            await DeployOnVultr(`deploylite-container-webbuilder${rand}`)
                            window.open('/project/webbuilder', '_blank')}}
                        >
                          <Plus className="w-4 h-4 mr-2" />
                          Create Website
                        </Button>
                      </CardContent>
                    </Card>
                  </motion.div>

                  {/* Database */}
                  <motion.div variants={scaleIn} whileHover={{ scale: 1.02, y: -5 }}>
                    <Card className="bg-gradient-to-br from-black via-gray-900/90 to-black backdrop-blur-xl border border-pink-500/20 hover:border-pink-500/40 transition-all duration-300 cursor-pointer group h-full">
                      <CardHeader className="text-center pb-4">
                        <div className="mx-auto p-4 bg-gradient-to-r from-green-500/20 to-emerald-500/20 rounded-2xl mb-4 group-hover:from-green-500/30 group-hover:to-emerald-500/30 transition-all duration-300">
                          <Database className="w-12 h-12 text-green-400" />
                        </div>
                        <CardTitle className="text-xl font-bold text-gray-100 group-hover:text-green-300 transition-colors">
                          Database
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="text-center">
                        <p className="text-gray-400 mb-4 text-sm">
                          Deploy managed databases with high availability
                        </p>
                        <div className="space-y-2 mb-6">
                          <Badge variant="outline" className="border-green-500/30 text-green-300 text-xs">
                            MySQL, PostgreSQL
                          </Badge>
                          <Badge variant="outline" className="border-emerald-500/30 text-emerald-300 text-xs">
                            MongoDB, Redis
                          </Badge>
                        </div>
                        <Button 
                          className="w-full bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white border-0 rounded-xl font-medium shadow-lg shadow-green-500/25"
                          onClick={async() => {
                             let rand = Math.ceil(Math.random()*100);
                            await DeployOnVultr(`deploylite-container-database${rand}`)
                            window.open('/project/database', '_blank')}}
                        >
                          <Plus className="w-4 h-4 mr-2" />
                          Create Database
                        </Button>
                      </CardContent>
                    </Card>
                  </motion.div>

                  {/* Chatbot Builder */}
                  <motion.div variants={scaleIn} whileHover={{ scale: 1.02, y: -5 }}>
                    <Card className="bg-gradient-to-br from-black via-gray-900/90 to-black backdrop-blur-xl border border-pink-500/20 hover:border-pink-500/40 transition-all duration-300 cursor-pointer group h-full">
                      <CardHeader className="text-center pb-4">
                        <div className="mx-auto p-4 bg-gradient-to-r from-yellow-500/20 to-orange-500/20 rounded-2xl mb-4 group-hover:from-yellow-500/30 group-hover:to-orange-500/30 transition-all duration-300">
                          <FaRobot className="w-12 h-12 text-yellow-400" />
                        </div>
                        <CardTitle className="text-xl font-bold text-gray-100 group-hover:text-yellow-300 transition-colors">
                          Chatbot Builder
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="text-center">
                        <p className="text-gray-400 mb-4 text-sm">
                          Build AI-powered chatbots with custom knowledge bases
                        </p>
                        <div className="space-y-2 mb-6">
                          <Badge variant="outline" className="border-yellow-500/30 text-yellow-300 text-xs">
                            OpenAI, Google AI
                          </Badge>
                          <Badge variant="outline" className="border-orange-500/30 text-orange-300 text-xs">
                            Custom Training
                          </Badge>
                        </div>
                        <Button 
                          className="w-full bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-white border-0 rounded-xl font-medium shadow-lg shadow-yellow-500/25"
                          onClick={async() => {
                            let rand = Math.ceil(Math.random()*100);
                            await DeployOnVultr(`deploylite-container-chatbot${rand}`)
                            window.open('/project/chatbot', '_blank')
                          }}
                        >
                          <Plus className="w-4 h-4 mr-2" />
                          Create Chatbot
                        </Button>
                      </CardContent>
                    </Card>
                  </motion.div>
                </div>
              </motion.div>

              {/* Footer Info */}
              <motion.div variants={fadeIn}>
                <div className="text-center p-6 bg-gradient-to-r from-pink-500/10 to-purple-500/10 border border-pink-500/20 rounded-xl">
                  <div className="flex items-center justify-center gap-2 mb-3">
                    <CheckCircle className="w-5 h-5 text-green-400" />
                    <span className="text-green-400 font-medium">Vultr Connected</span>
                  </div>
                  <p className="text-gray-400 text-sm">
                    Your infrastructure will be deployed using Vultr's global cloud platform with high-performance SSD storage, 
                    100% KVM virtualization, and 20+ datacenter locations worldwide.
                  </p>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  )
}