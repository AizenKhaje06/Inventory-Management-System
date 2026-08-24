"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Lock, Eye, EyeOff, AlertCircle, Shield } from "lucide-react"
import { toast } from "sonner"

export default function MinimalistLoginPage() {
  const [mounted, setMounted] = useState(false)
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [rememberDevice, setRememberDevice] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  
  const router = useRouter()

  useEffect(() => {
    setMounted(true)
    
    if (typeof window !== 'undefined') {
      const teamLeaderKeys = [
        'teamLeaderSession',
        'x-team-leader-role',
        'x-team-leader-user-id',
        'x-team-leader-channel'
      ]
      
      teamLeaderKeys.forEach(key => {
        if (localStorage.getItem(key)) {
          localStorage.removeItem(key)
        }
      })
      
      const remembered = localStorage.getItem("rememberedUsername")
      if (remembered) {
        setUsername(remembered)
        setRememberDevice(true)
      }
    }
    
    const hasLogoutMarker = document.cookie.includes('__logout_marker__=true')
    
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search)
      const logoutParam = urlParams.get('logout')

      
      if (logoutParam || hasLogoutMarker) {
        document.cookie = '__logout_marker__=; path=/; max-age=0'
        
        try {
          localStorage.clear()
          sessionStorage.clear()
        } catch (error) {
          console.error('[Login Page] Error clearing storage:', error)
        }
        
        if (logoutParam) {
          window.history.replaceState({}, '', '/')
        }
      }
    }
  }, [])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)

    try {
      const response = await fetch('/api/auth/unified-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username,
          password,
          rememberDevice
        })
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        if (response.status === 429) {
          throw new Error(data.error || "Too many login attempts. Please wait before trying again.")
        }
        throw new Error(data.error || "Invalid credentials")
      }

      if (typeof window !== 'undefined') {
        const { user, redirectPath, sessionId } = data

        if (rememberDevice) {
          localStorage.setItem("rememberedUsername", username)
        } else {
          localStorage.removeItem("rememberedUsername")
        }

        localStorage.setItem("isLoggedIn", "true")
        localStorage.setItem("username", user.username)
        localStorage.setItem("userRole", user.role)
        localStorage.setItem("displayName", user.displayName)
        localStorage.setItem("sessionId", sessionId)


        if (user.profileImage) {
          localStorage.setItem("profileImage", user.profileImage)
        }
        // assignedChannel removed - no longer used in simplified system

        localStorage.setItem("currentUser", JSON.stringify(user))

        toast.success(`Welcome back, ${user.displayName || user.username}! 🎉`, {
          description: 'Redirecting to your dashboard...',
          duration: 1000,
        })

        router.push(redirectPath)
      }
    } catch (error) {
      console.error("Login error:", error)
      setError(error instanceof Error ? error.message : "Login failed. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  if (!mounted) {
    return null
  }

  return (
    <div className="h-screen w-full flex overflow-hidden bg-[#0a0a0f] relative">
      
      {/* Corporate Building Background - Left Side Only with Gradient */}
      <div className="fixed inset-0 pointer-events-none">
        <div 
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage: `url('/Corporate Building.png')`,
            maskImage: 'linear-gradient(to right, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.4) 50%, transparent 75%)',
            WebkitMaskImage: 'linear-gradient(to right, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.4) 50%, transparent 75%)'
          }}
        />
        {/* Dark overlay on left for text readability */}
        <div 
          className="absolute inset-0 bg-gradient-to-r from-black/60 via-black/30 to-black"
        />
      </div>

      {/* Left Section - Minimalist Branding */}
      <div className="hidden lg:flex lg:w-1/2 relative z-10 flex-col justify-between p-12 xl:pl-20 xl:pr-16 xl:py-16">
        
        {/* Logo & Brand */}
        <div className="space-y-8">
          <div className="space-y-2">
            <img 
              src="/Vertex-icon.png" 
              alt="Vertex" 
              className="h-12 w-auto object-contain opacity-90"
              loading="eager"
            />
          </div>

          <div className="space-y-6 max-w-xl">
            <div className="inline-block px-3 py-1 bg-amber-500/10 border border-amber-500/20 rounded-full">
              <span className="text-xs font-medium text-amber-400/90 tracking-wide">ENTERPRISE GRADE SOLUTION</span>
            </div>
            
            <h1 className="text-6xl xl:text-7xl font-light leading-[1.1] tracking-tight">
              <span className="text-white/95 font-extralight">Unified</span>
              <br />
              <span className="text-amber-400 font-medium">Inventory</span>
              <br />
              <span className="text-white/95 font-extralight">Management</span>
            </h1>

            
            <p className="text-lg text-slate-400 font-light leading-relaxed">
              Complete multi-channel e-commerce platform for enterprise operations.
            </p>

            {/* Channel badges with logos - closer to text above */}
            <div className="flex flex-wrap gap-3 pt-1">
              <div className="flex items-center gap-2 px-3 py-1.5 border border-slate-700/50 text-slate-400 rounded-md text-xs font-light">
                <img src="/Shopee.png" alt="Shopee" className="h-4 w-4 object-contain" />
                <span>Shopee</span>
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 border border-slate-700/50 text-slate-400 rounded-md text-xs font-light">
                <img src="/Lazada.png" alt="Lazada" className="h-4 w-4 object-contain" />
                <span>Lazada</span>
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 border border-slate-700/50 text-slate-400 rounded-md text-xs font-light">
                <img src="/facebook.png" alt="Facebook" className="h-4 w-4 object-contain" />
                <span>Facebook</span>
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 border border-slate-700/50 text-slate-400 rounded-md text-xs font-light">
                <img src="/tiktok.png" alt="TikTok" className="h-4 w-4 object-contain" />
                <span>TikTok</span>
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 border border-slate-700/50 text-slate-400 rounded-md text-xs font-light">
                <img src="/Physical Store.png" alt="Physical Store" className="h-4 w-4 object-contain" />
                <span>Physical Store</span>
              </div>
            </div>
          </div>
        </div>

        {/* Core Features - New Addition */}
        <div className="space-y-4">
          <h3 className="text-sm font-bold uppercase tracking-wider" style={{ color: '#ffffff', textShadow: '0 2px 10px rgba(0,0,0,0.5)' }}>Core Features</h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center gap-2 text-sm">
              <div className="w-2 h-2 rounded-full bg-amber-400 shadow-lg shadow-amber-400/50"></div>
              <span className="font-normal" style={{ color: '#ffffff', textShadow: '0 1px 5px rgba(0,0,0,0.5)' }}>Real-time Tracking</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <div className="w-2 h-2 rounded-full bg-amber-400 shadow-lg shadow-amber-400/50"></div>
              <span className="font-normal" style={{ color: '#ffffff', textShadow: '0 1px 5px rgba(0,0,0,0.5)' }}>Multi-Channel Sync</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <div className="w-2 h-2 rounded-full bg-amber-400 shadow-lg shadow-amber-400/50"></div>
              <span className="font-normal" style={{ color: '#ffffff', textShadow: '0 1px 5px rgba(0,0,0,0.5)' }}>Automated Processing</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <div className="w-2 h-2 rounded-full bg-amber-400 shadow-lg shadow-amber-400/50"></div>
              <span className="font-normal" style={{ color: '#ffffff', textShadow: '0 1px 5px rgba(0,0,0,0.5)' }}>Advanced Analytics</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <div className="w-2 h-2 rounded-full bg-amber-400 shadow-lg shadow-amber-400/50"></div>
              <span className="font-normal" style={{ color: '#ffffff', textShadow: '0 1px 5px rgba(0,0,0,0.5)' }}>Role-Based Access</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <div className="w-2 h-2 rounded-full bg-amber-400 shadow-lg shadow-amber-400/50"></div>
              <span className="font-normal" style={{ color: '#ffffff', textShadow: '0 1px 5px rgba(0,0,0,0.5)' }}>Secure Encryption</span>
            </div>
          </div>
        </div>

        {/* Premium Closing Message */}
        <div className="space-y-2">
          <p className="text-slate-500 text-sm font-light leading-relaxed">
            Trusted by enterprise teams to streamline operations and maximize efficiency across all sales channels.
          </p>
          <p className="text-amber-400/70 text-xs font-medium">
            © 2024 Vertex Inventory System. All rights reserved.
          </p>
        </div>
      </div>


      {/* Right Section - Premium Login Form */}
      <div className="w-full lg:w-1/2 relative z-10 flex items-center justify-end lg:pr-40 xl:pr-48 px-6 sm:px-8 lg:px-0">
        
        {/* Mobile Logo */}
        <div className="lg:hidden absolute top-8 left-6">
          <img 
            src="/Vertex-icon.png" 
            alt="Vertex" 
            className="h-10 w-auto object-contain opacity-90"
            loading="eager"
          />
        </div>

        <div className="w-full max-w-md">
          
          {/* Login Card - Glassmorphism */}
          <div className="relative">
            
            {/* Enhanced glow for glassmorphism */}
            <div className="absolute -inset-[2px] bg-gradient-to-br from-amber-500/30 via-blue-500/20 to-purple-500/20 rounded-3xl blur-2xl opacity-60"></div>
            
            {/* Glassmorphism Card */}
            <div className="relative bg-white/[0.03] border border-white/[0.15] rounded-3xl p-10 backdrop-blur-2xl shadow-2xl" style={{
              background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.05) 0%, rgba(255, 255, 255, 0.01) 100%)',
              boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.37), inset 0 1px 1px 0 rgba(255, 255, 255, 0.1)'
            }}>
              
              {/* Header */}
              <div className="mb-10 text-center">
                <div className="flex items-center justify-center gap-3 mb-3">
                  <div className="p-2.5 bg-gradient-to-br from-amber-500 to-amber-600 rounded-xl shadow-xl shadow-amber-600/50">
                    <Lock className="h-6 w-6 text-black" strokeWidth={3} />
                  </div>
                  <h2 className="text-3xl font-bold" style={{ color: '#ffffff', textShadow: '0 2px 15px rgba(0,0,0,0.7)' }}>Secure Login</h2>
                </div>
                <p className="text-sm font-normal" style={{ color: '#ffffff', opacity: 0.9, textShadow: '0 1px 5px rgba(0,0,0,0.5)' }}>Access your enterprise dashboard</p>
              </div>

              {/* Error Alert */}
              {error && (
                <Alert variant="destructive" className="mb-6 border-red-500/20 bg-red-950/20 rounded-xl">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription className="text-sm">{error}</AlertDescription>
                </Alert>
              )}

              {/* Login Form */}
              <form onSubmit={handleLogin} className="space-y-6">
                
                {/* Username */}
                <div className="space-y-3">
                  <Label htmlFor="username" className="font-light text-sm" style={{ color: '#cbd5e1' }}>
                    Username
                  </Label>
                  <Input
                    id="username"
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                    placeholder="Enter your username"
                    className="h-12 bg-white/[0.05] border-white/[0.2] hover:border-white/[0.3] focus:border-amber-500/60 text-white placeholder:text-slate-500 rounded-xl transition-all backdrop-blur-sm font-light shadow-inner"
                  />
                </div>


                {/* Password */}
                <div className="space-y-3">
                  <Label htmlFor="password" className="text-slate-400 font-light text-sm">
                    Password
                  </Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      placeholder="Enter your password"
                      className="h-12 bg-white/[0.05] border-white/[0.2] hover:border-white/[0.3] focus:border-amber-500/60 text-white placeholder:text-slate-500 rounded-xl pr-12 transition-all backdrop-blur-sm font-light shadow-inner"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-amber-400 transition-colors"
                    >
                      {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                </div>

                {/* Remember */}
                <div className="flex items-center gap-2">
                  <input
                    id="remember"
                    type="checkbox"
                    checked={rememberDevice}
                    onChange={(e) => setRememberDevice(e.target.checked)}
                    className="rounded border-white/[0.2] bg-white/[0.05] text-amber-500 focus:ring-amber-500/50 focus:ring-offset-0 cursor-pointer backdrop-blur-sm flex-shrink-0"
                    style={{ width: '16px', height: '16px', minWidth: '16px', minHeight: '16px' }}
                  />
                  <Label htmlFor="remember" className="text-sm font-light cursor-pointer" style={{ color: '#cbd5e1' }}>
                    Remember this device
                  </Label>
                </div>

                {/* Submit Button */}
                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full h-12 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-medium text-base shadow-lg shadow-amber-600/20 hover:shadow-amber-500/30 transition-all duration-300 rounded-xl"
                >
                  {loading ? (
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin"></div>
                      <span>Signing In...</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Lock className="h-4 w-4" />
                      <span>Sign In Securely</span>
                    </div>
                  )}
                </Button>
              </form>

              {/* Security Footer with Glassmorphism */}
              <div className="mt-8 pt-6 border-t border-white/[0.1]">
                <div className="flex items-center justify-center gap-2 text-slate-500 text-xs">
                  <Shield className="h-3.5 w-3.5" />
                  <span className="font-light">256-bit Encrypted Connection</span>
                </div>
              </div>
            </div>
          </div>

          {/* Footer with Glassmorphism touch */}
          <p className="text-center text-slate-500 text-xs mt-8 font-light backdrop-blur-sm">
            © 2024 Vertex Inventory System. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  )
}
