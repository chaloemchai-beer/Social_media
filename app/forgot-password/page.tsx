"use client";

import React, { useState, FormEvent } from "react";
import Link from "next/link";

type Step = "email" | "sent";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [step, setStep] = useState<Step>("email");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      // TODO: wire up to your reset-password API endpoint
      // await fetch("/api/auth/forgot-password", {
      //   method: "POST",
      //   headers: { "Content-Type": "application/json" },
      //   body: JSON.stringify({ email }),
      // });
      await new Promise((r) => setTimeout(r, 1000)); // simulate request
      setStep("sent");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left panel */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-700 flex-col justify-between p-12 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-72 h-72 bg-white/10 rounded-full -translate-x-1/2 -translate-y-1/2" />
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-white/10 rounded-full translate-x-1/3 translate-y-1/3" />

        {/* Logo */}
        <div className="relative z-10 flex items-center gap-3">
          <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
            <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 15H9V8h2v9zm4 0h-2V8h2v9z" />
            </svg>
          </div>
          <span className="text-white text-xl font-bold tracking-tight">SocialHub</span>
        </div>

        {/* Center content */}
        <div className="relative z-10">
          <div className="w-20 h-20 bg-white/15 rounded-3xl flex items-center justify-center mb-8 backdrop-blur-sm">
            <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
            </svg>
          </div>
          <h1 className="text-4xl font-bold text-white leading-tight mb-4">
            Forgot your<br />password?
          </h1>
          <p className="text-purple-200 text-lg leading-relaxed">
            No worries! Enter your email and we&apos;ll send you a link to reset your password.
          </p>
          <div className="mt-8 space-y-3">
            {[
              "Check your inbox for the reset link",
              "Link expires after 30 minutes",
              "Contact support if you need help",
            ].map((item) => (
              <div key={item} className="flex items-center gap-3">
                <div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
                  <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <span className="text-purple-100 text-sm">{item}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="relative z-10">
          <p className="text-purple-200 text-sm italic">
            &ldquo;Security is not a product, but a process.&rdquo;
          </p>
        </div>
      </div>

      {/* Right panel */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-gray-950">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="flex lg:hidden items-center gap-2 mb-8 justify-center">
            <div className="w-9 h-9 bg-violet-600 rounded-xl flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 15H9V8h2v9zm4 0h-2V8h2v9z" />
              </svg>
            </div>
            <span className="text-white text-xl font-bold">SocialHub</span>
          </div>

          {step === "email" ? (
            <>
              {/* Back button */}
              <Link
                href="/login"
                className="inline-flex items-center gap-2 text-gray-400 hover:text-white text-sm mb-8 transition-colors group"
              >
                <svg className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                Back to sign in
              </Link>

              <div className="mb-8">
                <div className="w-14 h-14 bg-violet-600/20 border border-violet-500/30 rounded-2xl flex items-center justify-center mb-5">
                  <svg className="w-7 h-7 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                  </svg>
                </div>
                <h2 className="text-3xl font-bold text-white mb-2">Reset password</h2>
                <p className="text-gray-400">
                  Enter the email associated with your account and we&apos;ll send a reset link.
                </p>
              </div>

              {error && (
                <div className="mb-6 flex items-start gap-3 bg-red-500/10 border border-red-500/20 rounded-xl p-4">
                  <svg className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-red-400 text-sm">{error}</p>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-2">
                  <label htmlFor="email" className="block text-sm font-medium text-gray-300">
                    Email address
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <input
                      id="email"
                      name="email"
                      type="email"
                      autoComplete="email"
                      required
                      className="w-full pl-11 pr-4 py-3 bg-gray-900 border border-gray-800 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all text-sm"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 px-4 bg-violet-600 hover:bg-violet-500 disabled:bg-violet-800 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-all duration-200 flex items-center justify-center gap-2 text-sm"
                >
                  {loading ? (
                    <>
                      <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Sending...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                      </svg>
                      Send reset link
                    </>
                  )}
                </button>
              </form>

              <p className="text-center text-sm text-gray-500 mt-6">
                Remember your password?{" "}
                <Link href="/login" className="text-violet-400 hover:text-violet-300 font-medium transition-colors">
                  Sign in
                </Link>
              </p>
            </>
          ) : (
            /* Success state */
            <div className="text-center">
              <div className="w-20 h-20 bg-green-500/15 border border-green-500/30 rounded-3xl flex items-center justify-center mx-auto mb-6">
                <svg className="w-10 h-10 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>

              <h2 className="text-3xl font-bold text-white mb-3">Check your email</h2>
              <p className="text-gray-400 mb-2">
                We sent a password reset link to
              </p>
              <p className="text-violet-400 font-medium mb-8">{email}</p>

              <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 text-left space-y-3 mb-8">
                {[
                  { icon: "1", text: "Open the email from SocialHub" },
                  { icon: "2", text: "Click the reset password link" },
                  { icon: "3", text: "Create your new password" },
                ].map((item) => (
                  <div key={item.icon} className="flex items-center gap-3">
                    <div className="w-6 h-6 rounded-full bg-violet-600/30 border border-violet-500/30 flex items-center justify-center flex-shrink-0">
                      <span className="text-violet-400 text-xs font-bold">{item.icon}</span>
                    </div>
                    <span className="text-gray-300 text-sm">{item.text}</span>
                  </div>
                ))}
              </div>

              <p className="text-gray-500 text-sm mb-6">
                Didn&apos;t receive the email?{" "}
                <button
                  onClick={() => setStep("email")}
                  className="text-violet-400 hover:text-violet-300 font-medium transition-colors"
                >
                  Try again
                </button>
              </p>

              <Link
                href="/login"
                className="inline-flex items-center gap-2 py-3 px-6 bg-gray-900 hover:bg-gray-800 border border-gray-800 hover:border-gray-700 text-gray-300 hover:text-white font-medium rounded-xl transition-all duration-200 text-sm"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                Back to sign in
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
