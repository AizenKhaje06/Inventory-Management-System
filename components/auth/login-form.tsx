"use client"

import { useState, useEffect } from "react"
import { Eye, EyeOff, Lock, User, ArrowRight, AlertCircle, Info, Package, Truck } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { CustomLoader } from "@/components/ui/custom-loader"
import type { UserRole, LogisticsSubRole } from "./role-selector"

interface Channel {
  id: string
  name: string
  label: string
}

interface Staff {
  id: string
  name: string
  identifier: string
}

interface Agent {
  id: string
  username: string
  displayName: string
  assignedChannel: string
  iconPath: string
}

interface LoginFormProps {
  role: UserRole
  onSubmit: (data: LoginFormData) => Promise<void>
  onForgotPassword: () => void
  // Staff-specific props
  channels?: Channel[]
  selectedChannel?: string
  onChannelChange?: (channel: string) => void
  channelsLoading?: boolean
  staffList?: Staff[]
  staffLoading?: boolean
  // Logistics-specific props
  logisticsSubRole?: LogisticsSubRole
  onLogisticsSubRoleChange?: (subRole: LogisticsSubRole) => void
}

export interface LoginFormData {
  username: string
  password: string
  rememberDevice: boolean
  role: UserRole
  logisticsSubRole?: LogisticsSubRole
}

export function LoginForm({ 
  role, 
  onSubmit, 
  onForgotPassword,
  channels = [],
  selectedChannel = "",
  onChannelChange,
  channelsLoading = false,
  staffList = [],
  staffLoading = false,
  logisticsSubRole = "packer",
  onLogisticsSubRoleChange
}: LoginFormProps) {
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [rememberDevice, setRememberDevice] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [capsLockOn, setCapsLockOn] = useState(false)
  const [passwordStrength, setPasswordStrength] = useState(0)

  // Password strength calculator
  const calculatePasswordStrength = (pwd: string) => {
    if (!pwd) return 0
    let strength = 0
    if (pwd.length >= 8) strength += 25
    if (pwd.length >= 12) strength += 25
    if (/[a-z]/.test(pwd) && /[A-Z]/.test(pwd)) strength += 25
    if (/[0-9]/.test(pwd)) strength += 15
    if (/[^a-zA-Z0-9]/.test(pwd)) strength += 10
    return Math.min(strength, 100)
  }

  const handlePasswordChange = (value: string) => {
    setPassword(value)
    setPasswordStrength(calculatePasswordStrength(value))
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    setCapsLockOn(e.getModifierState('CapsLock'))
  }

  const getPasswordStrengthColor = () => {
    if (passwordStrength < 40) return "bg-red-500"
    if (passwordStrength < 70) return "bg-amber-500"
    return "bg-green-500"
  }

  const getPasswordStrengthText = () => {
    if (passwordStrength < 40) return "Weak"
    if (passwordStrength < 70) return "Medium"
    return "Strong"
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)

    try {
      await onSubmit({
        username,
        password,
        rememberDevice,
        role,
        logisticsSubRole: role === 'logistics' ? logisticsSubRole : undefined
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  const getRoleLabel = () => {
    switch (role) {
      case "admin":
        return "admin dashboard"
      case "operations":
        return "warehouse operations"
      case "logistics":
        if (logisticsSubRole === "logistics-admin") return "logistics admin dashboard"
        return "packer dashboard"
      default:
        return "dashboard"
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold login-welcome-text mb-1">
          Welcome back
        </h2>
        <p className="text-slate-400 text-sm">
          Sign in to access {getRoleLabel()}
        </p>
      </div>

      {/* Operations role removed - no channel selector needed */}

      {/* Logistics Sub-Role Selector */}
      {role === 'logistics' && onLogisticsSubRoleChange && (
        <div className="space-y-2">
          <Label htmlFor="logistics-subrole" className="text-slate-200 font-medium">
            Logistics Role
          </Label>
          <div className="relative group">
            <Package className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 group-focus-within:text-blue-400 transition-colors duration-200 z-10 pointer-events-none" />
            <Select value={logisticsSubRole} onValueChange={onLogisticsSubRoleChange} disabled={loading}>
              <SelectTrigger className="pl-12 h-12 bg-slate-900/50 border-slate-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 transition-all duration-200 text-white hover:border-slate-600 disabled:opacity-50">
                <SelectValue placeholder="Select logistics role" />
              </SelectTrigger>
              <SelectContent className="bg-slate-900/95 backdrop-blur-xl border-slate-700/50 shadow-2xl">
                <SelectItem value="logistics-admin" className="text-white hover:bg-white/10 focus:bg-white/10 data-[state=checked]:bg-white/10 cursor-pointer">
                  <div className="flex items-center gap-3">
                    <div className="w-5 h-5 rounded-full bg-purple-500 flex items-center justify-center">
                      <Package className="w-3 h-3 text-white" />
                    </div>
                    <span>Logistics Admin</span>
                  </div>
                </SelectItem>
                <SelectItem value="packer" className="text-white hover:bg-white/10 focus:bg-white/10 data-[state=checked]:bg-white/10 cursor-pointer">
                  <div className="flex items-center gap-3">
                    <div className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center">
                      <Package className="w-3 h-3 text-white" />
                    </div>
                    <span>Packer</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {/* Error Alert */}
      {error && (
        <Alert className="border-red-800 bg-red-900/20 animate-in fade-in-0 slide-in-from-top-2 duration-300">
          <AlertCircle className="h-4 w-4 text-red-400" />
          <AlertDescription className="text-red-400 ml-2">
            {error}
          </AlertDescription>
        </Alert>
      )}

      {/* Username Field - Manual Input for All Roles */}
      <div className="space-y-2">
        <Label htmlFor="username" className="text-slate-200 font-medium">
          Username
        </Label>
        <div className="relative group">
          <User className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 group-focus-within:text-blue-400 transition-colors duration-200" />
          <Input
            id="username"
            type="text"
            placeholder="Enter your username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            disabled={loading}
            className="pl-12 h-12 bg-slate-900/50 border-slate-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 transition-all duration-200 text-white hover:border-slate-600 disabled:opacity-50"
            required
            autoComplete="username"
            aria-label="Username"
          />
        </div>
      </div>

      {/* Password Field - ENHANCED */}
      <div className="space-y-2">
        <Label htmlFor="password" className="text-slate-200 font-medium">
          Password
        </Label>
        <div className="relative group">
          <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 group-focus-within:text-blue-400 transition-colors duration-200" />
          <Input
            id="password"
            type={showPassword ? "text" : "password"}
            placeholder="Enter your password"
            value={password}
            onChange={(e) => handlePasswordChange(e.target.value)}
            onKeyDown={handleKeyPress}
            onKeyUp={handleKeyPress}
            disabled={loading}
            className="pl-12 pr-16 h-12 bg-slate-900/50 border-slate-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 transition-all duration-200 font-mono text-sm tracking-wide text-white hover:border-slate-600 disabled:opacity-50"
            required
            autoComplete="current-password"
            aria-label="Password"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            disabled={loading}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-700 transition-all duration-200 disabled:opacity-50"
            tabIndex={-1}
            aria-label={showPassword ? "Hide" : "Show"}
          >
            {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
          </button>
        </div>

        {/* Password Strength Indicator */}
        {password && (
          <div className="space-y-1 animate-in fade-in-0 slide-in-from-top-2 duration-300">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">Password strength</span>
              <span className={cn(
                "font-medium",
                passwordStrength < 40 && "text-red-400",
                passwordStrength >= 40 && passwordStrength < 70 && "text-amber-400",
                passwordStrength >= 70 && "text-green-400"
              )}>
                {getPasswordStrengthText()}
              </span>
            </div>
            <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
              <div 
                className={cn("h-full transition-all duration-300 rounded-full", getPasswordStrengthColor())}
                style={{ width: `${passwordStrength}%` }}
              />
            </div>
          </div>
        )}

        {/* Caps Lock Warning */}
        {capsLockOn && (
          <div className="flex items-center gap-2 text-xs text-amber-400 animate-in fade-in-0 slide-in-from-top-2 duration-300">
            <Info className="h-3.5 w-3.5" />
            <span>Caps Lock is on</span>
          </div>
        )}
      </div>

      {/* Remember Device & Forgot Password */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Checkbox 
            id="remember" 
            checked={rememberDevice}
            onCheckedChange={(checked) => setRememberDevice(checked as boolean)}
            disabled={loading}
            aria-label="Remember this device"
          />
          <Label 
            htmlFor="remember" 
            className="text-sm text-slate-300 cursor-pointer font-normal hover:text-white transition-colors"
          >
            Remember this device
          </Label>
        </div>
        <button
          type="button"
          onClick={onForgotPassword}
          disabled={loading}
          className="text-sm text-blue-400 hover:text-blue-300 transition-colors font-medium disabled:opacity-50"
        >
          Forgot password?
        </button>
      </div>

      {/* Submit Button - ENHANCED MICRO-INTERACTIONS */}
      <Button
        type="submit"
        disabled={loading || !username || !password}
        className="w-full h-12 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-semibold shadow-lg hover:shadow-xl transition-all duration-200 group hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 active:scale-[0.98]"
      >
        {loading ? (
          <>
            <CustomLoader size="sm" className="mr-2" />
            Signing in...
          </>
        ) : (
          <>
            Sign In
            <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform duration-200" />
          </>
        )}
      </Button>
    </form>
  )
}
