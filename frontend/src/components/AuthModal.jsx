import React, { useState } from "react";
import { loginUser, registerUser, setAuthToken } from "../services/api";
import { syncGuestCartWithBackend } from "../services/cartStorage";

export default function AuthModal({
  isOpen,
  onClose,
  onSuccess,
  title = "Sign In to Your Account",
  description = "Sign in to access your account and proceed with checkout.",
}) {
  const [tab, setTab] = useState("login"); // 'login' | 'register'
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // Form states
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");

  if (!isOpen) return null;

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const data = await loginUser({ email: email.trim(), password });
      if (data?.access_token) {
        setAuthToken(data.access_token);
        // Synchronize guest cart with backend
        await syncGuestCartWithBackend();
        setSuccessMsg("Logged in successfully!");
        setTimeout(() => {
          if (onSuccess) onSuccess(data.access_token);
          onClose();
        }, 600);
      } else {
        throw new Error("No token returned from server");
      }
    } catch (err) {
      setError(err.message || "Failed to log in. Please check your credentials.");
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccessMsg(null);

    try {
      await registerUser({
        username: username.trim(),
        email: email.trim(),
        password,
      });

      // Automatically log in after registration
      const loginData = await loginUser({ email: email.trim(), password });
      if (loginData?.access_token) {
        setAuthToken(loginData.access_token);
        await syncGuestCartWithBackend();
        setSuccessMsg("Account created successfully!");
        setTimeout(() => {
          if (onSuccess) onSuccess(loginData.access_token);
          onClose();
        }, 600);
      } else {
        setSuccessMsg("Account created! Please sign in.");
        setTab("login");
      }
    } catch (err) {
      setError(err.message || "Registration failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn"
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
    >
      <div className="relative w-full max-w-md bg-surface border border-hairline rounded-lg p-6 sm:p-8 shadow-2xl space-y-6">
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 text-ink-soft hover:text-white p-1 rounded-sm transition-colors cursor-pointer"
          aria-label="Close modal"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Header */}
        <div className="text-center space-y-1">
          <div className="w-12 h-12 mx-auto rounded-full bg-forest/10 border border-forest/20 flex items-center justify-center text-forest mb-3">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          <h2 id="auth-modal-title" className="font-display text-2xl font-bold text-white">
            {tab === "login" ? title : "Create an Account"}
          </h2>
          <p className="text-xs text-ink-soft max-w-xs mx-auto leading-relaxed">
            {description}
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-hairline text-xs font-semibold uppercase tracking-wider">
          <button
            type="button"
            onClick={() => { setTab("login"); setError(null); }}
            className={`flex-1 py-2.5 text-center transition-colors border-b-2 cursor-pointer ${
              tab === "login" ? "border-forest text-forest" : "border-transparent text-ink-soft hover:text-white"
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => { setTab("register"); setError(null); }}
            className={`flex-1 py-2.5 text-center transition-colors border-b-2 cursor-pointer ${
              tab === "register" ? "border-forest text-forest" : "border-transparent text-ink-soft hover:text-white"
            }`}
          >
            Create Account
          </button>
        </div>

        {/* Notification / Error / Success alerts */}
        {error && (
          <div className="p-3 bg-rust/10 border border-rust/30 rounded-sm text-rust text-xs">
            {error}
          </div>
        )}
        {successMsg && (
          <div className="p-3 bg-forest/10 border border-forest/30 rounded-sm text-forest text-xs font-medium">
            {successMsg}
          </div>
        )}

        {/* ==================== LOGIN FORM ==================== */}
        {tab === "login" && (
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-ink mb-1.5">
                Email Address
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full bg-paper border border-hairline rounded-sm px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-forest"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-ink mb-1.5">
                Password
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-paper border border-hairline rounded-sm px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-forest"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-forest text-black hover:bg-forest-dark py-3 px-4 rounded-sm text-sm font-bold uppercase tracking-wider transition-all disabled:opacity-50 cursor-pointer"
            >
              {loading ? "Signing in..." : "Sign In"}
            </button>
          </form>
        )}

        {/* ==================== REGISTER FORM ==================== */}
        {tab === "register" && (
          <form onSubmit={handleRegister} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-ink mb-1.5">
                Username
              </label>
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="johndoe"
                className="w-full bg-paper border border-hairline rounded-sm px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-forest"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-ink mb-1.5">
                Email Address
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full bg-paper border border-hairline rounded-sm px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-forest"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-ink mb-1.5">
                Password
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-paper border border-hairline rounded-sm px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-forest"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-forest text-black hover:bg-forest-dark py-3 px-4 rounded-sm text-sm font-bold uppercase tracking-wider transition-all disabled:opacity-50 cursor-pointer"
            >
              {loading ? "Creating Account..." : "Create Account"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
