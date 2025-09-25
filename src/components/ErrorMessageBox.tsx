import React from "react";

interface Props {
  showErrorContainer: boolean;
  error: string | null;
  errorColor: string;
  showAptosWalletMsg: boolean;
  setShowAptosWalletMsg: (show: boolean) => void;
}

const ErrorMessageBox: React.FC<Props> = ({
  showErrorContainer,
  error,
  errorColor,
  showAptosWalletMsg,
  setShowAptosWalletMsg,
}) => (
  <>
    {showErrorContainer && (
      <div className={`error-container bottom-right ${showErrorContainer ? "show" : ""}`}>
        {error && <p style={{ color: errorColor }}>{error}</p>}
      </div>
    )}
    {showAptosWalletMsg && (
      <div className="aptos-wallet-msg-box" style={{
        position: 'fixed',
        bottom: '30px',
        right: '30px',
        background: '#fff',
        border: '1px solid #ccc',
        borderRadius: '8px',
        padding: '20px',
        zIndex: 1000,
        boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
      }}>
        <span
          style={{
            position: 'absolute',
            top: '8px',
            right: '12px',
            cursor: 'pointer',
            fontWeight: 'bold',
            fontSize: '18px'
          }}
          onClick={() => setShowAptosWalletMsg(false)}
          aria-label="Close"
        >
          ×
        </span>
        <div>
          <b>Please install Petra wallet extension:</b>
          <br />
          <a
            href="https://chromewebstore.google.com/detail/petra-aptos-wallet/ejjladinnckdgjemekebdpeokbikhfci?hl=en"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: "#007bff", textDecoration: "underline" }}
          >
            https://chromewebstore.google.com/detail/petra-aptos-wallet/ejjladinnckdgjemekebdpeokbikhfci?hl=en
          </a>
        </div>
      </div>
    )}
  </>
);

export default ErrorMessageBox;
