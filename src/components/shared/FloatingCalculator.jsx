
import { createPortal } from "react-dom";
import { useState } from "react";

export default function FloatingCalculator() {
  const [open, setOpen] = useState(false);
  const [display, setDisplay] = useState("0");
  const [previous, setPrevious] = useState(null);
  const [operator, setOperator] = useState(null);
  const [reset, setReset] = useState(false);

  const calculate = (a, b, op) => {
    switch (op) {
      case "+":
        return a + b;
      case "-":
        return a - b;
      case "×":
        return a * b;
      case "÷":
        return b === 0 ? NaN : a / b;
      default:
        return b;
    }
  };

  const formatResult = (value) => {
    if (!Number.isFinite(value)) return "Error";
    return String(Number(value.toPrecision(12)));
  };

  // Live result: "=" চাপার আগেই হিসাব দেখাবে
  const liveResult =
    operator !== null &&
    previous !== null &&
    !reset &&
    display !== "Error"
      ? formatResult(calculate(previous, Number(display), operator))
      : null;

  const number = (value) => {
    if (display === "Error" || reset) {
      setDisplay(value === "." ? "0." : value);
      setReset(false);
      return;
    }

    if (value === "." && display.includes(".")) return;

    setDisplay(
      display === "0" && value !== "." ? value : display + value
    );
  };

  const chooseOperator = (op) => {
    if (display === "Error") return;

    const current = Number(display);

    if (operator && previous !== null && !reset) {
      const result = calculate(previous, current, operator);

      if (!Number.isFinite(result)) {
        setDisplay("Error");
        setPrevious(null);
        setOperator(null);
        setReset(true);
        return;
      }

      setPrevious(result);
      setDisplay(formatResult(result));
    } else {
      setPrevious(current);
    }

    setOperator(op);
    setReset(true);
  };

  const equals = () => {
    if (operator === null || previous === null || display === "Error") {
      return;
    }

    const result = calculate(previous, Number(display), operator);

    setDisplay(formatResult(result));
    setPrevious(null);
    setOperator(null);
    setReset(true);
  };

  const clear = () => {
    setDisplay("0");
    setPrevious(null);
    setOperator(null);
    setReset(false);
  };

  const backspace = () => {
    if (reset || display === "Error") {
      setDisplay("0");
      setReset(false);
      return;
    }

    setDisplay(display.length > 1 ? display.slice(0, -1) : "0");
  };

  const keys = [
    ["AC", "back", "%", "÷"],
    ["7", "8", "9", "×"],
    ["4", "5", "6", "-"],
    ["1", "2", "3", "+"],
    ["00", "0", ".", "="],
  ];

  const handleKey = (key) => {
    if (key === "AC") {
      clear();
    } else if (key === "back") {
      backspace();
    } else if (key === "%") {
      if (display === "Error") return;
      setDisplay(formatResult(Number(display) / 100));
      setReset(false);
    } else if (key === "=") {
      equals();
    } else if (["+", "-", "×", "÷"].includes(key)) {
      chooseOperator(key);
    } else {
      number(key);
    }
  };

  const getButtonStyle = (key) => ({
    height: 49,
    border: "none",
    borderRadius: 11,
    background:
      key === "="
        ? "#13bac5"
        : ["÷", "×", "-", "+", "%"].includes(key)
        ? "#e0f7f8"
        : ["AC", "back"].includes(key)
        ? "#fee2e2"
        : "#f3f6fa",
    color:
      key === "="
        ? "#fff"
        : ["÷", "×", "-", "+", "%"].includes(key)
        ? "#078b94"
        : ["AC", "back"].includes(key)
        ? "#dc2626"
        : "#172554",
    fontSize: 17,
    fontWeight: 700,
    cursor: "pointer",
    transition: "0.15s",
  });

  if (typeof document === "undefined") return null;

  return createPortal(
    <>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        title="Calculator"
        aria-label={open ? "Close calculator" : "Open calculator"}
        aria-expanded={open}
        style={{
          position: "fixed",
          right: 54,
          bottom: 250,
          width: 56,
          height: 56,
          borderRadius: "50%",
          border: "none",
          background: "linear-gradient(135deg,#13bac5,#087fca)",
          color: "#fff",
          fontSize: 25,
          cursor: "pointer",
          boxShadow: "0 6px 22px rgba(19,186,197,.35)",
          zIndex: 1000,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {open ? "×" : (
          <svg
            aria-hidden="true"
            width="36"
            height="36"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="5" y="2.5" width="14" height="19" rx="2" />
            <path d="M8 6h8M8 10h2m4 0h2m-8 4h2m4 0h2m-8 4h2m4 0h2" />
          </svg>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Calculator"
          style={{
            position: "fixed",
            right: 24,
            bottom: 318,
            width: "min(310px, calc(100vw - 32px))",
            maxHeight: "calc(100vh - 120px)",
            overflowY: "auto",
            background: "#fff",
            borderRadius: 18,
            padding: 16,
            boxSizing: "border-box",
            boxShadow: "0 12px 45px rgba(15,23,42,.22)",
            border: "1px solid #e5eaf0",
            zIndex: 999,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 15,
            }}
          >
            <div>
              <strong style={{ fontSize: 16, color: "#172554" }}>
                Calculator
              </strong>
              <div style={{ fontSize: 11, color: "#94a3b8" }}>
                Quick calculation
              </div>
            </div>

            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close calculator"
              style={{
                border: "none",
                background: "#f1f5f9",
                borderRadius: 8,
                width: 30,
                height: 30,
                cursor: "pointer",
                fontSize: 19,
                color: "#64748b",
              }}
            >
              ×
            </button>
          </div>

          <div
            style={{
              background: "#101d36",
              borderRadius: 12,
              padding: "18px 14px",
              marginBottom: 14,
              textAlign: "right",
              minWidth: 0,
            }}
          >
            <div
              style={{
                color: "#8ca5c5",
                fontSize: 12,
                marginBottom: 8,
                minHeight: 15,
              }}
            >
              {operator !== null && previous !== null
                ? reset
                  ? `${previous} ${operator}`
                  : `${previous} ${operator} ${display}`
                : "PREBOTIX CALCULATOR"}
            </div>

            <div
              aria-live="polite"
              style={{
                color: liveResult === "Error" ? "#f87171" : "#fff",
                fontSize: 29,
                fontWeight: 700,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {liveResult !== null ? liveResult : display}
            </div>

            {liveResult !== null && liveResult !== "Error" && (
              <div
                style={{
                  fontSize: 10,
                  color: "#13bac5",
                  marginTop: 5,
                }}
              >
                LIVE RESULT
              </div>
            )}
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
              gap: 9,
            }}
          >
            {keys.flat().map((key, index) => (
              <button
                key={index}
                type="button"
                onClick={() => handleKey(key)}
                style={getButtonStyle(key)}
              >
                {key === "back" ? "⌫" : key}
              </button>
            ))}
          </div>

          <div
            style={{
              textAlign: "center",
              fontSize: 10,
              color: "#94a3b8",
              marginTop: 13,
            }}
          >
            PREBOTIX • QUICK CALCULATOR
          </div>
        </div>
      )}
    </>,
    document.body
  );
}
