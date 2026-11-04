import { useState } from "react";
import Site from "./site/Site";

// Change this before sharing with your testers
const TEST_PASSWORD = "akema-beta-2026";

function App() {
  const [unlocked, setUnlocked] = useState(
    () => sessionStorage.getItem("akema-unlocked") === "yes",
  );
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    if (password === TEST_PASSWORD) {
      sessionStorage.setItem("akema-unlocked", "yes");
      setUnlocked(true);
    } else {
      setError("Incorrect password. Please try again.");
      setPassword("");
    }
  };

  if (!unlocked) {
    return (
      <div style={styles.overlay}>
        <form style={styles.card} onSubmit={handleSubmit}>
          <div style={styles.icon}>🔒</div>
          <h2 style={styles.title}>Restricted Access</h2>
          <p style={styles.text}>
            This chat is in closed testing. Enter the access password to
            continue.
          </p>
          <input
            type="password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setError("");
            }}
            placeholder="Password"
            autoFocus
            style={styles.input}
          />
          {error && <p style={styles.error}>{error}</p>}
          <button type="submit" style={styles.button}>
            Unlock
          </button>
        </form>
      </div>
    );
  }

  // The demo website: Ask the Lion everywhere, the journey at #/journey
  return <Site />;
}

const styles = {
  overlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(15, 23, 42, 0.85)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "1rem",
    zIndex: 9999,
    fontFamily: "system-ui, sans-serif",
  },
  card: {
    background: "#ffffff",
    color: "#0f172a",
    width: "100%",
    maxWidth: "380px",
    padding: "2rem",
    borderRadius: "12px",
    boxShadow: "0 20px 50px rgba(0, 0, 0, 0.3)",
    textAlign: "center",
  },
  icon: { fontSize: "2.5rem", marginBottom: "0.5rem" },
  title: { margin: "0 0 0.5rem", fontSize: "1.4rem" },
  text: { margin: "0 0 1.25rem", color: "#475569", lineHeight: 1.5 },
  input: {
    width: "100%",
    boxSizing: "border-box",
    padding: "0.75rem",
    fontSize: "1rem",
    border: "1px solid #cbd5e1",
    borderRadius: "8px",
    marginBottom: "0.75rem",
  },
  error: { color: "#dc2626", fontSize: "0.9rem", margin: "0 0 0.75rem" },
  button: {
    width: "100%",
    padding: "0.75rem",
    fontSize: "1rem",
    fontWeight: 600,
    background: "#2563eb",
    color: "#ffffff",
    border: "none",
    borderRadius: "8px",
    cursor: "pointer",
  },
};

export default App;
