import React, { useState, useEffect } from 'react';
import './SplashGate.css';

const SPLASH_DOMAINS = ['gluefactoryradio.com', 'www.gluefactoryradio.com'];
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

        {/* Mailchimp email signup */}
        <div className="splash-gate-form">
          <div id="mc_embed_signup">
            <form
              action="https://gluefactoryradio.us3.list-manage.com/subscribe/post?u=59fdb08d951a9fe15136d1bcf&amp;id=d929eeaa44&amp;f_id=00625ee1f0"
              method="post"
              id="mc-embedded-subscribe-form"
              name="mc-embedded-subscribe-form"
              target="_self"
              noValidate
            >
              <div id="mc_embed_signup_scroll">
                <div className="indicates-required">
                  <span className="asterisk">*</span> indicates required
                </div>
                <div className="splash-gate-form-group">
                  <div className="splash-gate-input-wrapper">
                    <div className="mc-field-group">
                      <label htmlFor="mce-EMAIL">
                        Email Address <span className="asterisk">*</span>
                      </label>
                      <input
                        type="email"
                        name="EMAIL"
                        className="required email"
                        id="mce-EMAIL"
                        required
                        placeholder="Enter your email to be notified"
                      />
                    </div>
                    <button
                      type="submit"
                      className="splash-gate-submit-arrow"
                      aria-label="Subscribe"
                    >
                      &rarr;
                    </button>
                  </div>
                </div>
                <div id="mce-responses" className="clear foot">
                  <div className="response" id="mce-error-response" style={{ display: 'none' }} />
                  <div className="response" id="mce-success-response" style={{ display: 'none' }} />
                </div>
                {/* Honeypot field for bot protection */}
                <div aria-hidden="true" style={{ position: 'absolute', left: '-5000px' }}>
                  <input
                    type="text"
                    name="b_59fdb08d951a9fe15136d1bcf_d929eeaa44"
                    tabIndex={-1}
                    defaultValue=""
                  />
                </div>
                <div className="optionalParent">
                  <div className="clear foot">
                    <input
                      type="submit"
                      name="subscribe"
                      id="mc-embedded-subscribe"
                      className="button"
                      value="Subscribe"
                    />
                  </div>
                </div>
              </div>
            </form>
          </div>
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
