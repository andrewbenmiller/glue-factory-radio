import React, { useState, useEffect } from 'react';
import './SplashGate.css';

const SPLASH_DOMAINS = ['radio.gluefactorymusic.com', 'www.radio.gluefactorymusic.com'];
const PASSWORD = 'gluefactory';
const STORAGE_KEY = 'gfr-authenticated';

interface SplashGateProps {
  children: React.ReactNode;
}

function SplashGate({ children }: SplashGateProps) {
  const [authenticated, setAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);

  const isSplashDomain = SPLASH_DOMAINS.includes(window.location.hostname);

  useEffect(() => {
    if (isSplashDomain && localStorage.getItem(STORAGE_KEY) === 'true') {
      setAuthenticated(true);
    }
  }, [isSplashDomain]);

  if (!isSplashDomain || authenticated) {
    return <>{children}</>;
  }

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === PASSWORD) {
      localStorage.setItem(STORAGE_KEY, 'true');
      setAuthenticated(true);
    } else {
      setError(true);
      setTimeout(() => setError(false), 2000);
    }
  };

  return (
    <div className="splash-gate">
      <div className="splash-gate-container">
        <div className="splash-gate-logo">
          <img src="/splash-logo.png" alt="Glue Factory Radio" />
        </div>

        {/* Password field */}
        <form className="splash-gate-password" onSubmit={handlePasswordSubmit}>
          <div className="splash-gate-password-wrapper">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
            />
          </div>
          {error && <div className="splash-gate-password-error">Incorrect password</div>}
        </form>
      </div>
    </div>
  );
}

export default SplashGate;
