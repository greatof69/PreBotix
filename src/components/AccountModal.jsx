
/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useState } from "react";
import { formatPrice } from "../utils/formatPrice";
import { UserRound, X, Eye, EyeOff } from "lucide-react";

export default function AccountModal({
  lang,
  accountMode,
  setAccountMode,
  accountUser,
  accountName,
  setAccountName,
  accountEmail,
  setAccountEmail,
  accountPassword,
  setAccountPassword,
  accountOtp,
  setAccountOtp,
  otpExpiresAt,
  accountNewPassword,
  setAccountNewPassword,
  accountMessage,
  setAccountMessage,
  accountLoading,
  setAccountOpen,
  submitAccount,
  verifyAccountOtp,
  resendAccountOtp,
  requestPasswordReset,
  resetAccountPassword,
  logoutAccount,
  myOrders = [],
  ordersLoading = false,
  ordersError = "",
  loadMyOrders,
  rememberMe = false,
  setRememberMe = () => {},
}) {
  const bn = lang === "bn";
  const t = (english, bangla) => (bn ? bangla : english);

  const otpMode = [
    "verify-registration",
    "verify-login",
    "reset-password",
  ].includes(accountMode);

  const [now, setNow] = useState(Date.now());
  const [showPassword, setShowPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);

  useEffect(() => {
    if (!otpMode || !otpExpiresAt) return undefined;

    const timer = setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => clearInterval(timer);
  }, [otpMode, otpExpiresAt]);

  const expiryTime = otpExpiresAt
    ? new Date(otpExpiresAt).getTime()
    : 0;

  const cooldown = expiryTime > 0
    ? Math.max(0, Math.ceil((expiryTime - now) / 1000))
    : 0;

  const minutes = String(Math.floor(cooldown / 60)).padStart(2, "0");
  const seconds = String(cooldown % 60).padStart(2, "0");

  useEffect(() => {
    if (accountMode === "dashboard" && accountUser) {
      loadMyOrders?.();
    }
  }, [accountMode, accountUser, loadMyOrders]);


  const titleMap = {
    login: t("Welcome back", "আবার স্বাগতম"),
    register: t("Create your account", "অ্যাকাউন্ট তৈরি করুন"),
    "verify-registration": t("Verify your email", "ইমেইল যাচাই করুন"),
    "verify-login": t("Login verification", "লগইন যাচাই"),
    "forgot-password": t("Forgot password?", "পাসওয়ার্ড ভুলে গেছেন?"),
    "reset-password": t("Reset password", "নতুন পাসওয়ার্ড দিন"),
    dashboard: t("Your dashboard", "আপনার ড্যাশবোর্ড"),
  };

  const closeModal = () => setAccountOpen(false);

  const handleResend = async () => {
    if (cooldown > 0 || accountLoading) return;

    await resendAccountOtp();
  };

  const switchMode = (mode) => {
    setAccountMode(mode);
    setAccountMessage("");
    setAccountOtp("");
  };

  const handleSubmit = (event) => {
    event.preventDefault();

    if (accountLoading) return;

    if (["verify-registration", "verify-login"].includes(accountMode)) {
      verifyAccountOtp(event);
      return;
    }

    if (accountMode === "forgot-password") {
      requestPasswordReset(event);
      return;
    }

    if (accountMode === "reset-password") {
      resetAccountPassword(event);
      return;
    }

    submitAccount(event);
  };

  return (
    <div
      className="account-overlay"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          closeModal();
        }
      }}
    >
      <section
        className="account-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="account-title"
      >
        <button
          type="button"
          className="account-close"
          aria-label={t("Close", "বন্ধ করুন")}
          onClick={closeModal}
        >
          <X size={20} />
        </button>

        <div className="account-modal-icon">
          <UserRound size={26} />
        </div>

        <span className="account-eyebrow">
          {t("PREBOTIX ACCOUNT", "PREBOTIX অ্যাকাউন্ট")}
        </span>

        <h2 id="account-title">
          {titleMap[accountMode] || titleMap.login}
        </h2>

        {accountMode === "dashboard" && accountUser ? (
          <>
            <p className="account-subtitle">
              {t("Welcome back", "স্বাগতম")},{" "}
              {accountUser.name || accountUser.email}
            </p>

            <div className="account-profile-card">
              <strong>
                {accountUser.name || t("Customer", "গ্রাহক")}
              </strong>

              <span>{accountUser.email}</span>

              <small>{t("Account profile", "অ্যাকাউন্ট প্রোফাইল")}</small>
            </div>

            <div className="account-stat-card">
              <span>{t("Total orders", "মোট অর্ডার")}</span>
              <strong>{myOrders.length}</strong>
            </div>

            <div className="account-orders">
              <div className="account-orders-heading">
                <h3>{t("My Orders", "আমার অর্ডার")}</h3>

                <button
                  type="button"
                  className="account-text-button"
                  onClick={loadMyOrders}
                  disabled={ordersLoading}
                >
                  {ordersLoading
                    ? t("Loading...", "লোড হচ্ছে...")
                    : t("Refresh", "রিফ্রেশ")}
                </button>
              </div>

              {ordersError && (
                <p className="account-message" role="alert">
                  {ordersError}
                </p>
              )}

              {ordersLoading && myOrders.length === 0 ? (
                <p>{t("Loading orders...", "অর্ডার লোড হচ্ছে...")}</p>
              ) : myOrders.length === 0 && !ordersError ? (
                <p>
                  {t(
                    "You haven't placed any orders yet.",
                    "আপনি এখনো কোনো অর্ডার করেননি।"
                  )}
                </p>
              ) : (
                myOrders.map((order) => (
                  <article className="account-order-card" key={order._id}>
                    <div className="account-order-top">
                      <strong>{order.orderNumber}</strong>
                      <span>{order.status}</span>
                    </div>

                    <small>
                      {order.createdAt
                        ? new Date(order.createdAt).toLocaleDateString(
                            bn ? "bn-BD" : "en-GB"
                          )
                        : ""}
                    </small>

                    <div className="account-order-items">
                      {(order.items || []).map((item, index) => (
                        <div
                          className="account-order-item"
                          key={`${order._id}-${item.productId}-${index}`}
                        >
                          <span>
                            {item.title} × {item.quantity}
                          </span>

                          <strong>
                            {formatPrice(
                              (item.price || 0) * (item.quantity || 0),
                              lang
                            )}
                          </strong>
                        </div>
                      ))}
                    </div>

                    <div className="account-order-total">
                      <span>{t("Total", "সর্বমোট")}</span>
                      <strong>
                        {formatPrice(order.total || 0, lang)}
                      </strong>
                    </div>
                  </article>
                ))
              )}
            </div>

            {accountMessage && (
              <p className="account-message" role="status">
                {accountMessage}
              </p>
            )}

            <button
              type="button"
              className="button button-primary account-submit"
              onClick={logoutAccount}
              disabled={accountLoading}
            >
              {t("Log out", "লগআউট")}
            </button>
          </>
        ) : (
          <>
            <p className="account-subtitle">
              {accountMode === "verify-registration"
                ? t(
                    "Enter the 6-digit code sent to your email.",
                    "আপনার ইমেইলে পাঠানো ৬ সংখ্যার কোডটি লিখুন।"
                  )
                : accountMode === "verify-login"
                  ? t(
                      "Enter the login OTP sent to your email.",
                      "লগইন সম্পন্ন করতে ইমেইলে পাঠানো OTP লিখুন।"
                    )
                  : accountMode === "forgot-password"
                    ? t(
                        "Enter your email to request a reset code.",
                        "রিসেট কোড পেতে আপনার ইমেইল দিন।"
                      )
                    : accountMode === "reset-password"
                      ? t(
                          "Enter your OTP and new password.",
                          "OTP এবং নতুন পাসওয়ার্ড লিখুন।"
                        )
                      : accountMode === "register"
                        ? t(
                            "Join the PreBotix maker community.",
                            "আপনার PreBotix অ্যাকাউন্ট তৈরি করুন।"
                          )
                        : t(
                            "Log in to your account.",
                            "আপনার অ্যাকাউন্টে লগইন করুন।"
                          )}
            </p>

            {["login", "register"].includes(accountMode) && (
              <div className="account-mode-tabs">
                <button
                  type="button"
                  className={accountMode === "login" ? "active" : ""}
                  onClick={() => switchMode("login")}
                >
                  {t("Login", "লগইন")}
                </button>

                <button
                  type="button"
                  className={accountMode === "register" ? "active" : ""}
                  onClick={() => switchMode("register")}
                >
                  {t("Register", "রেজিস্টার")}
                </button>
              </div>
            )}

            <form className="account-form" onSubmit={handleSubmit}>
              {accountMode === "register" && (
                <label>
                  {t("Full name", "পূর্ণ নাম")}

                  <input
                    autoComplete="name"
                    value={accountName}
                    onChange={(event) =>
                      setAccountName(event.target.value)
                    }
                    placeholder={t("Your name", "আপনার নাম")}
                    maxLength={100}
                    required
                  />
                </label>
              )}

              {![
                "verify-registration",
                "verify-login",
                "reset-password",
              ].includes(accountMode) && (
                <label>
                  {t("Email address", "ইমেইল ঠিকানা")}

                  <input
                    type="email"
                    autoComplete="email"
                    value={accountEmail}
                    onChange={(event) =>
                      setAccountEmail(event.target.value)
                    }
                    placeholder="you@example.com"
                    required
                  />
                </label>
              )}

              {["login", "register"].includes(accountMode) && (
                <label>
                  {t("Password", "পাসওয়ার্ড")}

                    <div className="account-password-wrap">
                      <input
                        type={showPassword ? "text" : "password"}
                        autoComplete={
                          accountMode === "register"
                            ? "new-password"
                            : "current-password"
                        }
                        value={accountPassword}
                        onChange={(event) => setAccountPassword(event.target.value)}
                        minLength={8}
                        maxLength={72}
                        placeholder={t("At least 8 characters", "কমপক্ষে ৮ অক্ষর")}
                        required
                      />

                      <button
                        type="button"
                        className="account-password-toggle"
                        onClick={() => setShowPassword((visible) => !visible)}
                        aria-label={showPassword ? "Hide password" : "Show password"}
                        aria-pressed={showPassword}
                      >
                        {showPassword ? <EyeOff size={19} /> : <Eye size={19} />}
                      </button>
                    </div>

                </label>
              )}

              {/* Remember Me: login screen only */}
              {accountMode === "login" && (
                <label className="account-remember">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(event) =>
                      setRememberMe(event.target.checked)
                    }
                  />

                  <span>
                    {t(
                      "Remember me on this device",
                      "এই ডিভাইসে আমাকে মনে রাখুন"
                    )}
                  </span>
                </label>
              )}

              {otpMode && (
                <label>
                  {t("6-digit OTP", "৬ সংখ্যার OTP")}

                  <input
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    value={accountOtp}
                    onChange={(event) =>
                      setAccountOtp(
                        event.target.value.replace(/\D/g, "").slice(0, 6)
                      )
                    }
                    placeholder="123456"
                    pattern="[0-9]{6}"
                    maxLength={6}
                    required
                  />
                </label>
              )}

              {accountMode === "reset-password" && (
                <label>
                  {t("New password", "নতুন পাসওয়ার্ড")}

                    <div className="account-password-wrap">
                      <input
                        type={showNewPassword ? "text" : "password"}
                        autoComplete="new-password"
                        value={accountNewPassword}
                        onChange={(event) => setAccountNewPassword(event.target.value)}
                        minLength={8}
                        maxLength={72}
                        placeholder={t("At least 8 characters", "কমপক্ষে ৮ অক্ষর")}
                        required
                      />

                      <button
                        type="button"
                        className="account-password-toggle"
                        onClick={() => setShowNewPassword((visible) => !visible)}
                        aria-label={showNewPassword ? "Hide password" : "Show password"}
                        aria-pressed={showNewPassword}
                      >
                        {showNewPassword ? <EyeOff size={19} /> : <Eye size={19} />}
                      </button>
                    </div>
                    
                </label>
              )}

              {accountMessage && (
                <p className="account-message" role="alert">
                  {accountMessage}
                </p>
              )}

              <button
                type="submit"
                className="button button-primary account-submit"
                disabled={accountLoading}
              >
                {accountLoading
                  ? t("Please wait...", "অপেক্ষা করুন...")
                  : accountMode === "register"
                    ? t("Create account", "অ্যাকাউন্ট তৈরি করুন")
                    : accountMode === "login"
                      ? t("Log in", "লগইন করুন")
                      : accountMode === "verify-registration"
                        ? t("Verify email", "ইমেইল যাচাই করুন")
                        : accountMode === "verify-login"
                          ? t("Verify and log in", "যাচাই করে লগইন করুন")
                          : accountMode === "forgot-password"
                            ? t("Send reset OTP", "রিসেট OTP পাঠান")
                            : t("Reset password", "পাসওয়ার্ড রিসেট করুন")}
              </button>
            </form>

            {accountMode === "login" && (
              <p className="account-subtitle">
                <button
                  type="button"
                  className="account-text-button"
                  onClick={() => switchMode("forgot-password")}
                >
                  {t("Forgot password?", "পাসওয়ার্ড ভুলে গেছেন?")}
                </button>
              </p>
            )}

            {otpMode && (
              <div className="account-resend">
                <button
                  type="button"
                  className="account-text-button"
                  onClick={handleResend}
                  disabled={cooldown > 0 || accountLoading}
                >
                  {t("Resend OTP", "আবার OTP পাঠান")}
                </button>

                <span className="account-resend-timer" aria-live="polite">
                  {cooldown > 0
                    ? t(
                        `Available in ${minutes}:${seconds}`,
                        `আবার পাঠাতে ${minutes}:${seconds}`
                      )
                    : t(
                        "You can resend now",
                        "এখন আবার OTP পাঠাতে পারবেন"
                      )}
                </span>
              </div>
            )}

            {accountMode === "forgot-password" && (
              <p className="account-subtitle">
                <button
                  type="button"
                  className="account-text-button"
                  onClick={() => switchMode("login")}
                >
                  {t("Back to login", "লগইনে ফিরে যান")}
                </button>
              </p>
            )}
          </>
        )}
      </section>
    </div>
  );
}
