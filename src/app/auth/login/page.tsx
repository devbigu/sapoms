"use client"

import { useEffect, useState, type FormEvent } from "react"
import { useRouter } from "next/navigation"
import { Eye, EyeOff, Mail, RotateCcw } from "lucide-react"
import { persistAuthenticatedSession, type StoredUser } from "@/lib/roleAccess"


const LOGO_SRC = "/omsons_logo.jpeg"

export default function Login() {
  const router = useRouter()
  const emailOtpEnabled = process.env.NEXT_PUBLIC_ENABLE_EMAIL_OTP === "true"

  const [showNotice, setShowNotice] = useState(true)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPw, setShowPw] = useState(false)
  const [otpMode, setOtpMode] = useState(false)
  const [otpRequested, setOtpRequested] = useState(false)
  const [otpCode, setOtpCode] = useState("")
  const [otpLoading, setOtpLoading] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    if (!showNotice) {
      return
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setShowNotice(false)
      }
    }

    window.addEventListener("keydown", handleKeyDown)

    return () => {
      window.removeEventListener("keydown", handleKeyDown)
    }
  }, [showNotice])

  const completeLogin = (userData: StoredUser) => {
    const session = persistAuthenticatedSession(localStorage, userData)
    if (!session || session.status !== "authenticated") {
      setError("Invalid credentials")
      return
    }

    const clientRole = session.role
    window.dispatchEvent(new Event("omsons-auth-changed"))

    setEmail("")
    setPassword("")
    setOtpCode("")
    setOtpMode(false)
    setOtpRequested(false)

    if (clientRole === "staff") router.push("/dashboard/staff")
    else if (clientRole === "dealer") router.push("/home")
    else if (clientRole === "admin") router.push("/dashboard/admin")
    else if (clientRole === "accountant") router.push("/dashboard/accountant")
  }

  const handleLogin = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError("")

    if (!email || !password) {
      setError("Email and password are required")
      return
    }

    try {
      setLoading(true)

      const formData = new FormData()
      formData.append("email", email)
      formData.append("password", password)

      const res = await fetch("/api/auth/login", {
        method: "POST",
        body: formData,
        credentials: "include",
      })
      const data = await res.json()
      const failureMessage = typeof data?.message === "string" ? data.message : "Invalid credentials"

      if (res.ok && data?.status) {
        completeLogin(data.data || { email })
      } else {
        setError(failureMessage)
      }
    } catch (err: unknown) {
      console.error("Login error:", err)

      setError("Server error")
    } finally {
      setLoading(false)
    }
  }

  const handleRequestOtp = async () => {
    setError("")
    if (!email) {
      setError("Email is required")
      return
    }

    try {
      setOtpLoading(true)
      const res = await fetch("/api/auth/email-otp/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
        credentials: "include",
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(typeof data?.message === "string" ? data.message : "Unable to send verification code")
        return
      }
      setOtpMode(true)
      setOtpRequested(true)
    } catch (err: unknown) {
      console.error("OTP request error:", err)
      setError("Server error")
    } finally {
      setOtpLoading(false)
    }
  }

  const handleVerifyOtp = async () => {
    setError("")
    if (!email || !otpCode) {
      setError("Email and verification code are required")
      return
    }

    try {
      setOtpLoading(true)
      const res = await fetch("/api/auth/email-otp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, otp: otpCode }),
        credentials: "include",
      })
      const data = await res.json().catch(() => ({}))
      const failureMessage = typeof data?.message === "string" ? data.message : "Invalid verification code"
      if (res.ok && data?.status) {
        completeLogin(data.data || { email })
      } else {
        setError(failureMessage)
      }
    } catch (err: unknown) {
      console.error("OTP verify error:", err)
      setError("Server error")
    } finally {
      setOtpLoading(false)
    }
  }
  return (
    <main className="h-screen overflow-hidden text-slate-950">
      <div className="flex h-full w-full">
        <section className="grid w-full overflow-hidden bg-white lg:grid-cols-[0.86fr_1.14fr]">

          {/* ── Form panel ─────────────────────────────────────────────── */}
          <form
            className="flex min-h-0 flex-col justify-center p-0"
            onSubmit={handleLogin}
          >
            <div className="mx-auto w-full max-w-[330px] px-8">

              {/* Header */}
              <div className="mb-4">
                <div className="mb-3 flex items-center gap-3">
                  <img
                    src={LOGO_SRC}
                    alt="Omsons Logo"
                    width={34}
                    height={34}
                    className="h-9 w-9 rounded-full bg-[#1d4ed8] object-contain p-1"
                  />
                  <div>
                    <p className="text-sm font-semibold text-slate-950">Omsons</p>
                    <p className="text-xs text-slate-400">Dealer network</p>
                  </div>
                </div>
                <h1 className="text-[26px] font-black leading-tight tracking-[-0.01em] text-slate-950">
                  Login
                </h1>
                <p className="mt-1 text-[13px] text-slate-500">
                  Sign in with your assigned account. Your role is detected automatically.
                </p>
              </div>

              {/* Fields */}
              <div className="space-y-3">
                <label className="block">
                  <span className="mb-1.5 block text-[12px] font-semibold text-slate-700">Email</span>
                  <input
                    type="text"
                    placeholder="Enter your email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="h-10 w-full rounded-full border border-slate-200 bg-white px-5 text-[13px] text-slate-900 shadow-sm outline-none transition placeholder:text-slate-300 focus:border-[#5b3ff2] focus:ring-4 focus:ring-[#5b3ff2]/10"
                  />
                </label>

                <label className="block">
                  <span className="mb-1.5 block text-[12px] font-semibold text-slate-700">Password</span>
                  <div className="relative">
                    <input
                      type={showPw ? "text" : "password"}
                      placeholder="Enter your password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoComplete="current-password"
                      className="h-10 w-full rounded-full border border-slate-200 bg-white px-5 pr-12 text-[13px] text-slate-900 shadow-sm outline-none transition placeholder:text-slate-300 focus:border-[#5b3ff2] focus:ring-4 focus:ring-[#5b3ff2]/10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPw((visible) => !visible)}
                      className="absolute right-4 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-full text-slate-400 transition hover:bg-slate-50 hover:text-slate-700"
                      aria-label={showPw ? "Hide password" : "Show password"}
                      title={showPw ? "Hide password" : "Show password"}
                    >
                      {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </label>
              </div>

              {/* Forgot password */}
              <div className="mt-2 flex justify-end">
                <button
                  type="button"
                  className="text-[11px] font-semibold text-[#4f35dc] hover:text-[#321fbd]"
                >
                  Forgot Password?
                </button>
              </div>

              {/* Error message */}
              {error && (
                <p className="mt-3 rounded-xl border border-red-100 bg-red-50 px-4 py-2.5 text-[12px] font-semibold text-red-600">
                  {error}
                </p>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                className="mt-4 h-10 w-full rounded-full bg-[#593df4] px-4 text-[13px] font-bold text-white shadow-[0_14px_28px_rgba(89,61,244,0.28)] transition hover:-translate-y-0.5 hover:bg-[#4b31de] active:translate-y-0 disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {loading ? "Signing in..." : "Login"}
              </button>

              {emailOtpEnabled && (
                <div className="mt-4 space-y-3">
                  <div className="flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-300">
                    <span className="h-px flex-1 bg-slate-100" />
                    <span>OR</span>
                    <span className="h-px flex-1 bg-slate-100" />
                  </div>

                  {!otpMode && (
                    <button
                      type="button"
                      onClick={handleRequestOtp}
                      disabled={otpLoading}
                      className="flex h-10 w-full items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-4 text-[13px] font-bold text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:border-[#593df4] hover:text-[#4b31de] active:translate-y-0 disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      <Mail size={15} />
                      {otpLoading ? "Sending code..." : "Login with Email OTP"}
                    </button>
                  )}

                  {otpMode && (
                    <div className="space-y-3">
                      <label className="block">
                        <span className="mb-1.5 block text-[12px] font-semibold text-slate-700">Verification Code</span>
                        <input
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]{6}"
                          maxLength={6}
                          placeholder="000000"
                          value={otpCode}
                          onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                          className="h-10 w-full rounded-full border border-slate-200 bg-white px-5 text-center text-[15px] font-bold tracking-[0.18em] text-slate-900 shadow-sm outline-none transition placeholder:text-slate-300 focus:border-[#5b3ff2] focus:ring-4 focus:ring-[#5b3ff2]/10"
                        />
                      </label>

                      <button
                        type="button"
                        onClick={handleVerifyOtp}
                        disabled={otpLoading || !otpRequested}
                        className="h-10 w-full rounded-full bg-[#593df4] px-4 text-[13px] font-bold text-white shadow-[0_14px_28px_rgba(89,61,244,0.28)] transition hover:-translate-y-0.5 hover:bg-[#4b31de] active:translate-y-0 disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-70"
                      >
                        {otpLoading ? "Verifying..." : "Verify & Login"}
                      </button>

                      <div className="flex items-center justify-between">
                        <button
                          type="button"
                          onClick={() => { setOtpMode(false); setOtpCode(""); setError("") }}
                          className="text-[11px] font-semibold text-slate-500 hover:text-slate-800"
                        >
                          Use Password
                        </button>
                        <button
                          type="button"
                          onClick={handleRequestOtp}
                          disabled={otpLoading}
                          className="flex items-center gap-1.5 text-[11px] font-semibold text-[#4f35dc] hover:text-[#321fbd] disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <RotateCcw size={12} />
                          Resend Code
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

{/* Footer */}
              <p className="mt-4 text-center text-[11px] text-slate-300">
                ©2026 Omsons. All rights reserved.
              </p>
            </div>
          </form>

          {/* ── Image panel ────────────────────────────────────────────── */}
          {/*
            overflow-hidden on the section clips the image.
            absolute inset-0 makes the img fill the div exactly.
            object-cover + object-left-center covers without distortion,
            cropping from the right side while keeping the subject visible.
          */}
          <div className="relative hidden bg-[#0150C6] lg:block">
            <img
              src="/login2.png"
              alt="Omsons laboratory glassware"
              className="absolute inset-0 h-full w-full object-cover"
            />
          </div>

        </section>
      </div>

      {showNotice && (
        <div>
          <div
  className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 px-4 py-6 backdrop-blur-md"
  onClick={() => setShowNotice(false)}
  aria-hidden="true"
>
  <div
    role="dialog"
    aria-modal="true"
    aria-labelledby="testing-phase-title"
    className="relative w-full max-w-[460px] rounded-3xl bg-zinc-100 p-6 text-center text-slate-900 shadow-[0_30px_80px_rgba(15,23,42,0.28)] ring-1 ring-black/5 sm:p-7"
    onClick={(event) => event.stopPropagation()}
  >
    {/* Close button */}
    <button
      type="button"
      onClick={() => setShowNotice(false)}
      aria-label="Close"
      className="absolute right-4 top-4 inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 focus:outline-none focus:ring-4 focus:ring-slate-100"
    >
    </button>

    {/* Icon */}
    <div className="mx-auto flex h-19 w-19 items-center justify-center rounded-full ">
      <img
        src={LOGO_SRC}
        alt="Omsons Logo"
        className="h-19 w-19 object-contain"
      />
    </div>

    <p className="mt-4 text-xs font-semibold uppercase tracking-[0.14em] text-black">
Welcome to the Omsons Partner Portal
    </p>

    <p
      id="testing-phase-title"
      className="mt-2 text-lg font-semibold tracking-[-0.01em] text-slate-950 sm:text-xl"
    >
      Thank You for Being With Us
    </p>

    <p className="mt-3 text-sm leading-6 text-slate-600 sm:text-[15px]">
     We appreciate your continued trust in Omsons. Our new Order Management System is designed to provide a seamless, transparent, and efficient ordering experience, empowering you to serve your customers with confidence.
    </p>

    <div className="mt-5 rounded-2xl  px-4 py-3 text-sm leading-6">
Together, we build success.    </div>

    <div className="mt-6 flex justify-center">
      {/* <button
        type="button"
        onClick={() => setShowNotice(false)}
        className="inline-flex h-11 w-full items-center justify-center rounded-full bg-amber-500 px-5 text-sm font-semibold text-white shadow-[0_12px_24px_rgba(245,158,11,0.28)] transition hover:bg-amber-600 focus:outline-none focus:ring-4 focus:ring-amber-200 sm:w-auto sm:px-8"
      >
        Let's Get Started
      </button> */}
    </div>
  </div>
</div>
        </div>
      )}
    </main>
  )
}
